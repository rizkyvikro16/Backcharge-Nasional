/**
 * Google Drive Integration Helper
 * 
 * Meliputi tiga metode pengunggahan:
 * 1. Google Apps Script (Sangat Direkomendasikan & Bebas Error)
 * 2. Akun Layanan / Service Account (Stabil, berjalan di server latar belakang)
 * 3. Client OAuth 2.0 (Login menggunakan akun Google pribadi pengguna)
 */

// Helper untuk mengubah File/Blob menjadi Base64 string
const toBase64 = (file: File | Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = reader.result as string;
      // Hapus prefix data:*/*;base64, agar hanya menyisakan string base64 murni
      const base64Clean = base64String.split(',')[1];
      resolve(base64Clean);
    };
    reader.onerror = (error) => reject(error);
  });
};

/**
 * Memeriksa apakah token OAuth Google tersimpan di browser dan masih aktif.
 */
export const checkGoogleToken = (): string | null => {
  const token = localStorage.getItem('google_oauth_token');
  const expiresAt = localStorage.getItem('google_oauth_expires');
  
  if (!token) return null;
  
  // Jika ada waktu kadaluarsa, periksa apakah sudah lewat
  if (expiresAt) {
    if (Date.now() > parseInt(expiresAt, 10)) {
      logoutGoogleDrive();
      return null;
    }
  }
  
  return token;
};

/**
 * Keluar / menghapus token login Google Drive dari browser.
 */
export const logoutGoogleDrive = (): void => {
  localStorage.removeItem('google_oauth_token');
  localStorage.removeItem('google_oauth_expires');
};

/**
 * Menghubungkan akun Google dengan melakukan pengalihan (redirect) ke OAuth Google.
 * @param customClientId Client ID kustom pilihan pengguna (jika diinput manual)
 */
export const initiateGoogleOAuth = (customClientId?: string): void => {
  const clientId = customClientId || (import.meta as any).env.VITE_GOOGLE_CLIENT_ID;
  
  if (!clientId) {
    throw new Error("Client ID tidak ditemukan di environment variables!");
  }

  // Tentukan redirect URI sesuai origin aplikasi saat ini
  const redirectUri = window.location.origin + window.location.pathname;
  const scope = "https://www.googleapis.com/auth/drive";
  const responseType = "token";
  
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=${responseType}&scope=${encodeURIComponent(scope)}&prompt=select_account`;
  
  window.location.href = authUrl;
};

/**
 * Memeriksa apakah integrasi Google Apps Script aktif (ada URL di env).
 */
export const checkAppsScriptStatus = (): boolean => {
  return !!(import.meta as any).env.VITE_GOOGLE_APPS_SCRIPT_URL;
};

/**
 * Memeriksa apakah integrasi Service Account aktif (dideteksi via API Backend).
 */
export const checkServiceAccountStatus = async (): Promise<boolean> => {
  try {
    const response = await fetch('/api/health');
    if (!response.ok) return false;
    const data = await response.json();
    return !!data.serviceAccountConnected;
  } catch (err) {
    console.error('Gagal mengecek status akun layanan:', err);
    return false;
  }
};

/**
 * Mengunggah file ke Google Drive menggunakan metode prioritas terbaik yang aktif.
 * 
 * Alur prioritas:
 * 1. Google Apps Script (jika VITE_GOOGLE_APPS_SCRIPT_URL ada di env)
 * 2. Service Account Backend (jika kredensial terpasang di backend)
 * 3. Client OAuth (jika user login secara mandiri)
 * 
 * @param file Berkas yang ingin diunggah
 * @param filename Nama berkas akhir di Google Drive
 * @param token Token OAuth opsional
 */
export const uploadFileToDrive = async (
  file: File | Blob, 
  filename: string, 
  token: string | null = null
): Promise<string> => {
  // 1. PRIORITAS UTAMA: Google Apps Script Web App (Bebas Isu CORS, sangat mudah diatur)
  const appsScriptUrl = (import.meta as any).env.VITE_GOOGLE_APPS_SCRIPT_URL;
  if (appsScriptUrl && appsScriptUrl.trim() !== '') {
    try {
      console.log('Mengunggah ke Google Drive via Google Apps Script...');
      const base64Data = await toBase64(file);
      
      const response = await fetch(appsScriptUrl, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8', // Apps Script CORS menyukai Content-Type plain/text atau raw
        },
        body: JSON.stringify({
          fileBase64: base64Data,
          fileName: filename,
          mimeType: file.type || 'image/jpeg'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      if (data.status === 'success' && data.fileUrl) {
        console.log('Unggah via Apps Script sukses!', data.fileUrl);
        return data.fileUrl;
      } else {
        throw new Error(data.message || 'Respons gagal dari Apps Script');
      }
    } catch (err: any) {
      console.error('Gagal mengunggah via Apps Script:', err);
      throw new Error(`Apps Script Upload Gagal: ${err.message || err}`);
    }
  }

  // 2. PRIORITAS KEDUA: Service Account (Berjalan di backend Express aman)
  const isServiceAccountActive = await checkServiceAccountStatus();
  if (isServiceAccountActive) {
    try {
      console.log('Mengunggah ke Google Drive via Service Account Backend...');
      const formData = new FormData();
      formData.append('file', file, filename);

      const response = await fetch('/api/upload-to-drive', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || response.statusText);
      }

      const data = await response.json();
      if (data.webViewLink) {
        console.log('Unggah via Service Account sukses!', data.webViewLink);
        return data.webViewLink;
      } else {
        throw new Error('Respons backend tidak valid (webViewLink kosong)');
      }
    } catch (err: any) {
      console.error('Gagal mengunggah via Service Account:', err);
      throw new Error(`Service Account Upload Gagal: ${err.message || err}`);
    }
  }

  // 3. PRIORITAS KETIGA: Client OAuth (Pengguna login manual via browser)
  const activeToken = token || checkGoogleToken();
  if (activeToken) {
    try {
      console.log('Mengunggah ke Google Drive via Client OAuth...');
      
      // Tahap 1: Buat file metadata
      const metadata = {
        name: filename,
        mimeType: file.type || 'image/jpeg'
      };

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', file);

      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${activeToken}`
        },
        body: form
      });

      if (!response.ok) {
        if (response.status === 401) {
          logoutGoogleDrive();
          throw new Error('Token Google Drive kedaluwarsa. Silakan hubungkan kembali.');
        }
        const errText = await response.text();
        throw new Error(`Google API error: ${errText}`);
      }

      const data = await response.json();
      
      // Atur izin file agar dapat dilihat publik (agar Google AI Studio / Gemini dapat membaca URL-nya)
      try {
        await fetch(`https://www.googleapis.com/drive/v3/files/${data.id}/permissions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${activeToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            role: 'reader',
            type: 'anyone'
          })
        });
      } catch (permErr) {
        console.warn('Gagal mengubah hak akses file menjadi publik:', permErr);
      }

      const fileUrl = data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`;
      console.log('Unggah via Client OAuth sukses!', fileUrl);
      return fileUrl;

    } catch (err: any) {
      console.error('Gagal mengunggah via Client OAuth:', err);
      throw new Error(`Client OAuth Upload Gagal: ${err.message || err}`);
    }
  }

  throw new Error("Tidak ada metode integrasi Google Drive yang aktif (Apps Script, Service Account, maupun login OAuth)");
};
