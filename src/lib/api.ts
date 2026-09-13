/**
 * Resolves the backend API URL dynamically.
 */
export const getApiUrl = (path: string): string => {
  const hostname = window.location.hostname;
  const isCloudflare = hostname.includes("pages.dev") || hostname.includes("workers.dev");
  
  // Jika berjalan di Cloudflare, arahkan ke Worker API Anda sendiri (jika ada)
  // Ganti URL ini dengan URL Worker API D1 Anda (contoh: https://api.backcharge-assa.workers.dev)
  // Jika kosong (""), ia akan memanggil domainnya sendiri (cocok jika frontend & backend digabung)
  let base = "";
  
  if (isCloudflare) {
    // DEFAULT SEMENTARA: Masih mengarah ke server AI Studio
    // UBAH BARIS DI BAWAH INI menjadi URL Worker Anda agar tidak bergantung pada AI Studio
    base = "https://api.backcharge-assa.workers.dev/";
  }

  return `${base}${path}`;
};
