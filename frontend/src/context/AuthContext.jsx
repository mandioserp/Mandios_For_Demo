import { createContext, useState, useEffect, useContext, useCallback } from 'react';
import api from '../utils/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      setUser(null);
    }
    setUser(null);
  }, []);

  const isImpersonated = Boolean(user?.isImpersonated);

  const impersonateTenant = async (businessId) => {
    try {
      const res = await api.post(`/super-admin/businesses/${businessId}/impersonate`);
      const { business } = res.data;
      const profile = await api.get('/auth/profile');
      setUser(profile.data);

      return { success: true, business };
    } catch (err) {
      return { 
        success: false, 
        error: err.response?.data?.error || 'Failed to start support impersonation session.' 
      };
    }
  };

  const exitImpersonation = async () => {
    try {
      await api.post('/auth/exit-impersonation');
      const res = await api.get('/auth/profile');
      setUser(res.data);
      return { success: true };
    } catch {
      return { success: false, error: 'Failed to restore Super Admin session.' };
    }
  };

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await api.get('/auth/profile');
        if (res.data) {
          setUser(res.data);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, []);

  const login = async (identifier, password, role) => {
    try {
      const res = await api.post('/auth/login', { identifier, email: identifier, password, role });
      const { user: receivedUser } = res.data;
      if (!receivedUser) return { success: false, error: 'Authentication failed.' };
      setUser(receivedUser);
      return { success: true };
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Authentication failed. Please check credentials.';
      return { success: false, error: errMsg };
    }
  };

  const refreshProfile = async () => {
    try {
      const res = await api.get('/auth/profile');
      if (res.data) {
        setUser(res.data);
      }
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        logout();
      }
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      login, 
      logout, 
      refreshProfile,
      impersonateTenant,
      exitImpersonation,
      isImpersonated
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

