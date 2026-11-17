import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { clearToken, getToken, setToken } from '../lib/api.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [guestProfile, setGuestProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadSession = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setGuestProfile(null);
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get('/auth/me');
      setUser(data.user);
      setGuestProfile(data.guestProfile);
    } catch {
      clearToken();
      setUser(null);
      setGuestProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSession();
    const unauthorized = () => {
      setUser(null);
      setGuestProfile(null);
    };
    window.addEventListener('luxurystay:unauthorized', unauthorized);
    return () => window.removeEventListener('luxurystay:unauthorized', unauthorized);
  }, [loadSession]);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    setToken(data.token);
    setUser(data.user);
    setGuestProfile(null);
    if (data.user.role === 'guest') {
      try {
        const me = await api.get('/auth/me');
        setGuestProfile(me.data.guestProfile);
      } catch {
        /* profile can be loaded later */
      }
    }
    return data.user;
  };

  const register = async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    setToken(data.token);
    setUser(data.user);
    setGuestProfile(null);
    return data.user;
  };

  const completeSetup = async (payload) => {
    const { data } = await api.post('/setup', payload);
    setToken(data.token);
    setUser(data.user);
    setGuestProfile(null);
    return data.user;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* ignore network errors on logout */
    }
    clearToken();
    setUser(null);
    setGuestProfile(null);
  };

  const refresh = async () => {
    const { data } = await api.get('/auth/me');
    setUser(data.user);
    setGuestProfile(data.guestProfile);
    return data;
  };

  const value = useMemo(
    () => ({ user, guestProfile, loading, login, register, completeSetup, logout, refresh, setUser }),
    [user, guestProfile, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
};

const ROLE_HOME = {
  admin: '/app',
  manager: '/app',
  receptionist: '/app/front-desk',
  housekeeping: '/app/housekeeping',
  guest: '/app/my-stay',
};

export const homeForRole = (role) => ROLE_HOME[role] || '/app';
