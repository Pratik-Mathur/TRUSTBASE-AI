import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabase';
const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const session = data?.session || null;
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email, name: session.user.user_metadata?.name || '' });
        localStorage.setItem('trustbaseai_token', session.access_token || '');
      }
      setLoading(false);
    });
  }, []);

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw { response: { data: { detail: error.message } } };
    const token = data.session?.access_token || '';
    localStorage.setItem('trustbaseai_token', token);
    const u = data.user;
    const result = { token, user: { id: u.id, email: u.email, name: u.user_metadata?.name || '' } };
    setUser(result.user);
    return result;
  };

  const register = async (name, email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
    if (error) throw { response: { data: { detail: error.message } } };
    const token = data.session?.access_token || '';
    const u = data.user;
    const result = { token, user: { id: u.id, email: u.email, name } };
    if (token) {
      localStorage.setItem('trustbaseai_token', token);
    }
    setUser(result.user);
    return result;
  };

  const logout = async () => {
    await supabase.auth.signOut();
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
