import { createContext, useContext, useState } from 'react';
import { authAdmin, authAgency } from '../api/client';

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  });
  const [loading, setLoading] = useState(false);

  const loginAdmin = async (username, password) => {
    setLoading(true);
    try {
      const { data } = await authAdmin(username, password);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user); return data.user;
    } finally { setLoading(false); }
  };

  const loginAgency = async (identifier, password) => {
    setLoading(true);
    try {
      const { data } = await authAgency(identifier, password);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user); return data.user;
    } finally { setLoading(false); }
  };

  const logout = () => {
    localStorage.removeItem('token'); localStorage.removeItem('user'); setUser(null);
  };

  return <Ctx.Provider value={{ user, loginAdmin, loginAgency, logout, loading }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
