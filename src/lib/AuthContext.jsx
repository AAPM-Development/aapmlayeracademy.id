import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { nativeApi } from '@/api/nativeClient';
import { ConfirmDialog } from '@/components/primitives';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const sessionLogoutInFlight = useRef(false);

  const checkUserAuth = useCallback(async () => {
    try {
      setIsLoadingAuth(true);
      const currentUser = await nativeApi.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setAuthError(null);
      setAuthChecked(true);
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
      setAuthChecked(true);
      if (error.status !== 401) {
        setAuthError({
          type: 'unknown',
          message: error.message || 'Gagal memeriksa sesi login.'
        });
      }
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  const checkAppState = useCallback(async () => {
    setAuthError(null);
    await checkUserAuth();
  }, [checkUserAuth]);

  useEffect(() => {
    checkAppState();
  }, [checkAppState]);

  useEffect(() => {
    const handleSessionExpired = () => {
      if (isAuthenticated && !sessionLogoutInFlight.current) {
        setSessionExpired(true);
      }
    };

    window.addEventListener('aapm:session-expired', handleSessionExpired);
    return () => window.removeEventListener('aapm:session-expired', handleSessionExpired);
  }, [isAuthenticated]);

  const logout = useCallback(async (shouldRedirect = true) => {
    try {
      if (isAuthenticated) await nativeApi.auth.logout();
    } catch (error) {
      if (error.status !== 401) console.error('Logout failed:', error);
    }
    setUser(null);
    setIsAuthenticated(false);
    
    if (shouldRedirect) {
      window.location.href = '/login';
    }
  }, [isAuthenticated]);

  const handleSessionLogout = useCallback(() => {
    if (sessionLogoutInFlight.current) return;
    sessionLogoutInFlight.current = true;
    setSessionExpired(false);
    void logout().finally(() => {
      sessionLogoutInFlight.current = false;
    });
  }, [logout]);

  const navigateToLogin = () => {
    const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.location.href = `/login?returnTo=${encodeURIComponent(returnTo || '/')}`;
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings: false,
      authError,
      appPublicSettings: null,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState
    }}>
      <ConfirmDialog
        open={sessionExpired}
        onOpenChange={(open) => {
          setSessionExpired(open);
          if (!open) handleSessionLogout();
        }}
        title="Sesi Anda berakhir"
        description="Sesi login sudah tidak aktif. Masuk lagi untuk melanjutkan."
        confirmLabel="Masuk lagi"
        cancelLabel="Keluar"
        icon="solar:history-2-bold-duotone"
        onConfirm={handleSessionLogout}
      />
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
