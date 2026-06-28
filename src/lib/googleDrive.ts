// Service for automatic Google Drive uploads to prevent Supabase database bloat
// PT Adi Sarana Armada, Tbk - Backcharge System

export interface GoogleDriveFile {
  id: string;
  name: string;
  webViewLink: string;
}

// Retrive Client ID from environment variables
const CLIENT_ID = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '';

/**
 * Initiates the Google OAuth2 flow via redirect/popup to request access to upload files to Google Drive.
 */
export const initiateGoogleOAuth = (customClientId?: string) => {
  const clientId = customClientId || CLIENT_ID;
  if (!clientId) {
    throw new Error('Google Client ID belum dikonfigurasi. Harap tambahkan VITE_GOOGLE_CLIENT_ID di environment variables.');
  }

  const redirectUri = window.location.origin + window.location.pathname;
  const scope = 'https://www.googleapis.com/auth/drive.file';
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(scope)}&prompt=consent`;
  
  // Open the auth URL
  window.location.href = authUrl;
};

/**
 * Checks if there's an OAuth access token in the URL hash (from callback) or stored in sessionStorage.
 */
export const checkGoogleToken = (): string | null => {
  // 1. Check URL hash first
  const hash = window.location.hash;
  if (hash) {
    const params = new URLSearchParams(hash.substring(1));
    const token = params.get('access_token');
    if (token) {
      sessionStorage.setItem('google_drive_access_token', token);
      // Clean up the URL hash to make it look clean
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      return token;
    }
  }

  // 2. Check sessionStorage
  return sessionStorage.getItem('google_drive_access_token');
};

/**
 * Disconnects the Google Drive session by clearing token.
 */
export const logoutGoogleDrive = () => {
  sessionStorage.removeItem('google_drive_access_token');
};

/**
 * Uploads a file/blob to Google Drive and makes it viewable to anyone with the link
 */
export const uploadFileToDrive = async (
  file: File | Blob, 
  filename: string, 
  token: string
): Promise<string> => {
  try {
    // 1. Create a metadata part
    const metadata = {
      name: filename,
      mimeType: file.type || 'image/jpeg'
    };

    const formData = new FormData();
    formData.append(
      'metadata',
      new Blob([JSON.stringify(metadata)], { type: 'application/json' })
    );
    formData.append('file', file);

    // 2. POST to upload endpoint
    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google Drive Upload Gagal: ${response.statusText} (${errText})`);
    }

    const data = await response.json();
    const fileId = data.id;

    // 3. Update permissions to let anyone with link read/view this file
    const permissionResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          role: 'reader',
          type: 'anyone'
        })
      }
    );

    if (!permissionResponse.ok) {
      console.warn('Gagal mengubah hak akses file menjadi publik, tautan mungkin hanya bisa diakses oleh pengunggah saja.');
    }

    // 4. Return the shareable webViewLink
    return data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;
  } catch (err: any) {
    console.error('Error during Google Drive operations:', err);
    throw err;
  }
};
