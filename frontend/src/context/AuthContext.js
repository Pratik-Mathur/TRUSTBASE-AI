import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('trustbaseai_token');
    if (!token) { setLoading(false); return; }
    axios
      .get('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => setUser(res.data))
      .catch(() => localStorage.removeItem('trustbaseai_token'))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const res = await axios.post('/api/auth/login', { email, password });
    localStorage.setItem('trustbaseai_token', res.data.token);
    setUser(res.data.user);
    return res.data;
  };

  const register = async (name, email, password) => {
    const res = await axios.post('/api/auth/register', { name, email, password });
    if (res.data.token) localStorage.setItem('trustbaseai_token', res.data.token);
    setUser(res.data.user);
    return res.data;
  };

  const logout = async () => {
    localStorage.removeItem('trustbaseai_token');
    setUser(null);
  };

  const getAuthHeaders = () => {
    const token = localStorage.getItem('trustbaseai_token');
    return { Authorization: `Bearer ${token}` };
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated: !!user, login, register, logout, getAuthHeaders }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
