import { createContext, useContext, useEffect, useState } from 'react';

const KUNCI = 'umkmscan-pengaturan-v1';

const bawaan = {
  namaToko: '',
  noWaPemilik: '',
  tampilkanModalDiKasir: false,
  bunyiKlik: true,
  strukHeader: '',
  strukFooter: 'Terima kasih sudah belanja!',
  ukuranKertas: '58mm',
  sidebarRapatDefault: false,
  kontenLebar: true,
};

const PengaturanContext = createContext(null);

export function PengaturanProvider({ children }) {
  const [pengaturan, setPengaturan] = useState(() => {
    try {
      const mentah = localStorage.getItem(KUNCI);
      return mentah ? { ...bawaan, ...JSON.parse(mentah) } : bawaan;
    } catch {
      return bawaan;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(KUNCI, JSON.stringify(pengaturan));
    } catch {}
  }, [pengaturan]);

  function ubah(patch) {
    setPengaturan((p) => ({ ...p, ...patch }));
  }

  function reset() {
    setPengaturan(bawaan);
  }

  return (
    <PengaturanContext.Provider value={{ pengaturan, ubah, reset }}>
      {children}
    </PengaturanContext.Provider>
  );
}

export function usePengaturan() {
  return useContext(PengaturanContext);
}
