import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [pengguna, setPengguna] = useState(null);
  const [siap, setSiap] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setSiap(true);
      return;
    }
    api
      .get('/api/auth/me')
      .then((r) => setPengguna(r.data))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setSiap(true));
  }, []);

  async function masuk(email, password) {
    const { data } = await api.post('/api/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    setPengguna(data.pengguna);
    return data.pengguna;
  }

  function keluar() {
    localStorage.removeItem('token');
    setPengguna(null);
  }

  return (
    <AuthContext.Provider value={{ pengguna, masuk, keluar, siap }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
