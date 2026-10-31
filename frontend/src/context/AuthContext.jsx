
import React, { createContext, useContext, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '../shared/api/authApi';
import { portalForRole } from '../shared/utils/portal';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [sessions, setSessions] = useState(() => {
    const getStored = (portal) => {
      try {
        const token = localStorage.getItem(`${portal}_token`) || null;
        const userStr = localStorage.getItem(`${portal}_user`);
        const user = userStr ? JSON.parse(userStr) : null;
        return { token, user };
      } catch {
        return { token: null, user: null };
      }
    };

    return {
      officer: getStored('officer'),
      bureau: getStored('bureau'),
    };
  });

  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const login = async (email, password, portal) => {
    setLoading(true);
    try {
      const res = await authApi.login({ email, password, portal });
      if (res?.success && res?.token) {
        const assignedPortal = res.portal || portalForRole(res.user?.role) || portal;

        if (!['officer', 'bureau'].includes(assignedPortal)) {
          throw new Error('Invalid portal for this account');
        }

        localStorage.setItem(`${assignedPortal}_token`, res.token);
        localStorage.setItem(`${assignedPortal}_user`, JSON.stringify(res.user));

        setSessions((prev) => ({
          ...prev,
          [assignedPortal]: { token: res.token, user: res.user },
        }));

        queryClient.clear();
        return res.user;
      }
      throw new Error(res?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const logout = useCallback((portal) => {
    queryClient.clear();

    if (portal && sessions[portal]) {
      localStorage.removeItem(`${portal}_token`);
      localStorage.removeItem(`${portal}_user`);
      setSessions((prev) => ({
        ...prev,
        [portal]: { token: null, user: null },
      }));
      window.location.href = `/${portal}/login`;
    } else {
      ['officer', 'bureau'].forEach((p) => {
        localStorage.removeItem(`${p}_token`);
        localStorage.removeItem(`${p}_user`);
      });

      setSessions({
        officer: { token: null, user: null },
        bureau: { token: null, user: null },
      });

      window.location.href = '/login';
    }
  }, [sessions, queryClient]);

  const getPortalAuth = useCallback((portal) => {
    const session = sessions[portal] || { token: null, user: null };
    return {
      token: session.token,
      user: session.user,
      role: session.user?.role,
      isAuthenticated: Boolean(session.token && session.user),
      loading,
    };
  }, [sessions, loading]);

  return (
    <AuthContext.Provider
      value={{
        sessions,
        loading,
        login,
        logout,
        getPortalAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
