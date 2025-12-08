import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthContextType, User, Profile, Permission } from '../types/auth';
import { NuPIdentityProvider, useNuPIdentity } from './NuPIdentityContext';
import { apiClient } from '../lib/apiClient';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

const SESSION_TIMEOUT = 30 * 60 * 1000;
const ACTIVITY_CHECK_INTERVAL = 60 * 1000;
const LAST_ACTIVITY_KEY = 'nup_aim_last_activity';

const SSOAuthBridge: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const nupIdentity = useNuPIdentity();
  const [profile, setProfile] = useState<Profile | null>(null);

  const user: User | null = nupIdentity.user ? {
    id: nupIdentity.user.id,
    username: nupIdentity.user.name || nupIdentity.user.email.split('@')[0],
    email: nupIdentity.user.email,
    password: '',
    profileId: 'sso-profile',
    isActive: true,
    isEmailVerified: true,
    createdAt: new Date().toISOString(),
  } : null;

  useEffect(() => {
    if (user) {
      const permissions: Permission[] = (nupIdentity.user?.permissions || []).map((perm, idx) => {
        const parts = perm.replace('nup-aim:', '').split('_');
        return {
          id: String(idx + 1),
          module: parts[0]?.toUpperCase() || 'ANALYSIS',
          action: parts[1]?.toUpperCase() || 'VIEW',
          allowed: true,
        };
      });

      setProfile({
        id: 'sso-profile',
        name: 'SSO User',
        description: 'Profile from NuPIdentity SSO',
        isDefault: true,
        createdAt: new Date().toISOString(),
        permissions,
      });
    } else {
      setProfile(null);
    }
  }, [user, nupIdentity.user?.permissions]);

  const hasPermission = useCallback((module: string, action: string): boolean => {
    const permission = `nup-aim:${module.toLowerCase()}_${action.toLowerCase()}`;
    return nupIdentity.hasPermission(permission);
  }, [nupIdentity.hasPermission]);

  const login = useCallback(async (_username: string, _password: string): Promise<{ success: boolean; message?: string }> => {
    nupIdentity.login();
    return { success: true, message: 'Redirecting to SSO...' };
  }, [nupIdentity.login]);

  const logout = useCallback((): void => {
    nupIdentity.logout();
  }, [nupIdentity.logout]);

  const verifyEmail = useCallback(async (_token: string): Promise<{ success: boolean; message: string }> => {
    return { success: true, message: 'Email verified via SSO' };
  }, []);

  const resendVerificationEmail = useCallback(async (_email: string): Promise<{ success: boolean; message: string }> => {
    return { success: false, message: 'Not available with SSO authentication' };
  }, []);

  const value: AuthContextType = {
    user,
    profile,
    isAuthenticated: nupIdentity.isAuthenticated,
    login,
    logout,
    hasPermission,
    verifyEmail,
    resendVerificationEmail,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

const LocalAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const updateLastActivity = () => {
    localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
  };

  const isSessionExpired = (): boolean => {
    const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
    if (!lastActivity) return true;
    return Date.now() - parseInt(lastActivity) > SESSION_TIMEOUT;
  };

  const clearSession = () => {
    apiClient.logout();
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    localStorage.removeItem('nup_aim_current_user');
    setUser(null);
    setProfile(null);
  };

  const checkSessionExpiry = useCallback(() => {
    if (user && isSessionExpired()) {
      console.log('Session expired due to inactivity');
      clearSession();
      alert('Sua sessão expirou por inatividade. Faça login novamente.');
    }
  }, [user]);

  useEffect(() => {
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    const handleActivity = () => {
      if (user) updateLastActivity();
    };

    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    const sessionCheckInterval = setInterval(checkSessionExpiry, ACTIVITY_CHECK_INTERVAL);

    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
      clearInterval(sessionCheckInterval);
    };
  }, [user, checkSessionExpiry]);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = localStorage.getItem('nup_aim_auth_token');
        if (!token || isSessionExpired()) {
          clearSession();
          setIsLoading(false);
          return;
        }

        const currentUser = localStorage.getItem('nup_aim_current_user');
        if (currentUser) {
          const userData = JSON.parse(currentUser);
          setUser(userData);
          
          setProfile({
            id: 'admin-profile',
            name: 'Administrador',
            description: 'Perfil de administrador com acesso completo',
            isDefault: false,
            createdAt: new Date().toISOString(),
            permissions: [
              { id: '1', module: 'ANALYSIS', action: 'CREATE', allowed: true },
              { id: '2', module: 'ANALYSIS', action: 'EDIT', allowed: true },
              { id: '3', module: 'ANALYSIS', action: 'DELETE', allowed: true },
              { id: '4', module: 'ANALYSIS', action: 'VIEW', allowed: true },
              { id: '5', module: 'TEMPLATE', action: 'CREATE', allowed: true },
              { id: '6', module: 'TEMPLATE', action: 'EDIT', allowed: true },
              { id: '7', module: 'TEMPLATE', action: 'DELETE', allowed: true },
              { id: '8', module: 'TEMPLATE', action: 'VIEW', allowed: true },
            ],
          });
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        clearSession();
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (username: string, password: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const response = await apiClient.login(username, password);
      
      if (response.success && response.data) {
        const userData: User = {
          id: response.data.user?.id || '1',
          username: response.data.user?.name || username.split('@')[0],
          email: response.data.user?.email || username,
          password: '',
          profileId: 'admin-profile',
          isActive: true,
          isEmailVerified: true,
          createdAt: new Date().toISOString(),
        };

        setUser(userData);
        localStorage.setItem('nup_aim_current_user', JSON.stringify(userData));
        updateLastActivity();
        return { success: true };
      }
      return { success: false, message: 'Login failed' };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: 'Login error occurred' };
    }
  };

  const logout = (): void => {
    clearSession();
  };

  const hasPermission = (module: string, action: string): boolean => {
    if (!profile?.permissions) return false;
    return profile.permissions.some(
      p => p.module === module && p.action === action && p.allowed
    );
  };

  const verifyEmail = async (token: string): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await response.json();
      return { success: data.success, message: data.message || 'Email verified' };
    } catch {
      return { success: false, message: 'Verification failed' };
    }
  };

  const resendVerificationEmail = async (email: string): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      return { success: data.success, message: data.message || 'Email sent' };
    } catch {
      return { success: false, message: 'Failed to send email' };
    }
  };

  const value: AuthContextType = {
    user,
    profile,
    isAuthenticated: !!user,
    login,
    logout,
    hasPermission,
    verifyEmail,
    resendVerificationEmail,
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [ssoEnabled, setSsoEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuthMode = async () => {
      try {
        const response = await fetch('/api/auth/mode');
        if (response.ok) {
          const data = await response.json();
          setSsoEnabled(data.mode === 'sso');
        } else {
          setSsoEnabled(false);
        }
      } catch {
        setSsoEnabled(false);
      }
    };
    checkAuthMode();
  }, []);

  if (ssoEnabled === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Inicializando...</p>
        </div>
      </div>
    );
  }

  if (ssoEnabled) {
    return (
      <NuPIdentityProvider>
        <SSOAuthBridge>
          {children}
        </SSOAuthBridge>
      </NuPIdentityProvider>
    );
  }

  return (
    <LocalAuthProvider>
      {children}
    </LocalAuthProvider>
  );
};

export default AuthProvider;
