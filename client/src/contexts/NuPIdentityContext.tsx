import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface NuPIdentityUser {
  id: string;
  email: string;
  name?: string;
  picture?: string;
  permissions?: string[];
}

interface NuPIdentityContextType {
  isEnabled: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  user: NuPIdentityUser | null;
  error: Error | null;
  login: () => void;
  logout: () => Promise<void>;
  getAccessToken: () => string | null;
  getUserId: () => string | null;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (...permissions: string[]) => boolean;
  hasAllPermissions: (...permissions: string[]) => boolean;
  refreshSession: () => Promise<boolean>;
}

const NuPIdentityContext = createContext<NuPIdentityContextType | undefined>(undefined);

const NUPIDENTITY_ISSUER = import.meta.env.VITE_NUPIDENTITY_ISSUER;
const NUPIDENTITY_CLIENT_ID = import.meta.env.VITE_NUPIDENTITY_CLIENT_ID;
const NUPIDENTITY_ENABLED = !!(NUPIDENTITY_ISSUER && NUPIDENTITY_CLIENT_ID);

interface NuPIdentityProviderProps {
  children: ReactNode;
}

export function NuPIdentityProvider({ children }: NuPIdentityProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<NuPIdentityUser | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const checkSession = useCallback(async () => {
    if (!NUPIDENTITY_ENABLED) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/auth/sso/me', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setAccessToken(data.accessToken || null);
        setIsAuthenticated(true);
        setError(null);
      } else {
        setUser(null);
        setAccessToken(null);
        setIsAuthenticated(false);
      }
    } catch (err) {
      console.error('[NuPIdentity] Error checking session:', err);
      setError(err instanceof Error ? err : new Error('Session check failed'));
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const login = useCallback(() => {
    if (!NUPIDENTITY_ENABLED) {
      console.warn('[NuPIdentity] SSO not enabled');
      return;
    }
    window.location.href = '/auth/sso/login';
  }, []);

  const logout = useCallback(async () => {
    if (!NUPIDENTITY_ENABLED) {
      return;
    }

    try {
      await fetch('/auth/sso/logout', {
        method: 'POST',
        credentials: 'include',
      });
      setUser(null);
      setAccessToken(null);
      setIsAuthenticated(false);
      window.location.href = '/login';
    } catch (err) {
      console.error('[NuPIdentity] Logout error:', err);
    }
  }, []);

  const getAccessToken = useCallback(() => accessToken, [accessToken]);

  const getUserId = useCallback(() => user?.id || null, [user]);

  const hasPermission = useCallback((permission: string) => {
    if (!user?.permissions) return false;
    const fullPermission = permission.includes(':') ? permission : `nup-aim:${permission}`;
    return user.permissions.includes(fullPermission);
  }, [user]);

  const hasAnyPermission = useCallback((...permissions: string[]) => {
    return permissions.some(p => hasPermission(p));
  }, [hasPermission]);

  const hasAllPermissions = useCallback((...permissions: string[]) => {
    return permissions.every(p => hasPermission(p));
  }, [hasPermission]);

  const refreshSession = useCallback(async () => {
    if (!NUPIDENTITY_ENABLED) return false;

    try {
      const response = await fetch('/auth/sso/refresh', {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        await checkSession();
        return true;
      }
      return false;
    } catch (err) {
      console.error('[NuPIdentity] Refresh error:', err);
      return false;
    }
  }, [checkSession]);

  const value: NuPIdentityContextType = {
    isEnabled: NUPIDENTITY_ENABLED,
    isAuthenticated,
    isLoading,
    user,
    error,
    login,
    logout,
    getAccessToken,
    getUserId,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    refreshSession,
  };

  return (
    <NuPIdentityContext.Provider value={value}>
      {children}
    </NuPIdentityContext.Provider>
  );
}

export function useNuPIdentity() {
  const context = useContext(NuPIdentityContext);
  if (context === undefined) {
    throw new Error('useNuPIdentity must be used within a NuPIdentityProvider');
  }
  return context;
}

export function useNuPIdentityUser() {
  const { user } = useNuPIdentity();
  return user;
}

export function useIsNuPIdentityAuthenticated() {
  const { isAuthenticated } = useNuPIdentity();
  return isAuthenticated;
}

export function useNuPIdentityPermissions() {
  const { user } = useNuPIdentity();
  return user?.permissions || [];
}

export function useHasNuPIdentityPermission(permission: string) {
  const { hasPermission } = useNuPIdentity();
  return hasPermission(permission);
}

export function isNuPIdentityEnabled() {
  return NUPIDENTITY_ENABLED;
}
