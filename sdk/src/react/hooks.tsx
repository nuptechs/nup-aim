import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react';
import type { AuthState, UserInfo, TokenPayload } from '../types';
import { getUserId } from '../types';

export interface OIDCEndpoints {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  end_session_endpoint?: string;
}

export interface NuPIdentityProviderConfig {
  issuer: string;
  clientId: string;
  redirectUri?: string;
  scopes?: string[];
  endpoints?: Partial<OIDCEndpoints>;
  onLoginSuccess?: (user: UserInfo) => void;
  onLogoutSuccess?: () => void;
  onError?: (error: Error) => void;
}

interface NuPIdentityContextType extends AuthState {
  login: () => void;
  logout: () => Promise<void>;
  getAccessToken: () => string | null;
  getUserId: () => string | null;
  refreshSession: () => Promise<boolean>;
}

const NuPIdentityContext = createContext<NuPIdentityContextType | null>(null);

const TOKEN_STORAGE_KEY = 'nupidentity_access_token';
const REFRESH_TOKEN_KEY = 'nupidentity_refresh_token';
const ID_TOKEN_KEY = 'nupidentity_id_token';

function parseJwt(token: string): TokenPayload | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  const payload = parseJwt(token);
  if (!payload?.exp) return true;
  return payload.exp * 1000 < Date.now();
}

function generateRandomString(length: number): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256(message: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  return crypto.subtle.digest('SHA-256', data);
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

const DISCOVERY_CACHE_KEY = 'nupidentity_discovery';
const DISCOVERY_CACHE_TTL = 5 * 60 * 1000;

interface CachedDiscovery {
  endpoints: OIDCEndpoints;
  timestamp: number;
}

export function NuPIdentityProvider({
  children,
  config,
}: {
  children: ReactNode;
  config: NuPIdentityProviderConfig;
}) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    error: null,
  });

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [endpoints, setEndpoints] = useState<OIDCEndpoints | null>(null);

  const getEndpoints = useCallback(async (): Promise<OIDCEndpoints> => {
    if (config.endpoints?.authorization_endpoint && 
        config.endpoints?.token_endpoint && 
        config.endpoints?.userinfo_endpoint) {
      return config.endpoints as OIDCEndpoints;
    }

    const cached = sessionStorage.getItem(DISCOVERY_CACHE_KEY);
    if (cached) {
      try {
        const parsed: CachedDiscovery = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < DISCOVERY_CACHE_TTL) {
          return parsed.endpoints;
        }
      } catch {}
    }

    try {
      const response = await fetch(`${config.issuer}/.well-known/openid-configuration`);
      if (!response.ok) {
        throw new Error('Discovery failed');
      }
      const discovery = await response.json();
      const discoveredEndpoints: OIDCEndpoints = {
        authorization_endpoint: discovery.authorization_endpoint,
        token_endpoint: discovery.token_endpoint,
        userinfo_endpoint: discovery.userinfo_endpoint,
        end_session_endpoint: discovery.end_session_endpoint,
      };
      
      sessionStorage.setItem(DISCOVERY_CACHE_KEY, JSON.stringify({
        endpoints: discoveredEndpoints,
        timestamp: Date.now(),
      }));
      
      return discoveredEndpoints;
    } catch (error) {
      console.warn('[NuPIdentity] Discovery failed, using default endpoints');
      return {
        authorization_endpoint: `${config.issuer}/api/oidc/authorize`,
        token_endpoint: `${config.issuer}/api/oidc/token`,
        userinfo_endpoint: `${config.issuer}/api/oidc/userinfo`,
        end_session_endpoint: `${config.issuer}/api/oidc/logout`,
      };
    }
  }, [config.issuer, config.endpoints]);

  const fetchUserInfo = useCallback(async (token: string): Promise<UserInfo | null> => {
    try {
      const eps = await getEndpoints();
      const response = await fetch(eps.userinfo_endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user info');
      }

      return await response.json();
    } catch (error) {
      console.error('[NuPIdentity] Failed to fetch user info:', error);
      return null;
    }
  }, [getEndpoints]);

  const initializeSession = useCallback(async () => {
    try {
      const storedToken = sessionStorage.getItem(TOKEN_STORAGE_KEY);

      if (storedToken && !isTokenExpired(storedToken)) {
        const user = await fetchUserInfo(storedToken);

        if (user) {
          setAccessToken(storedToken);
          setState({
            isAuthenticated: true,
            isLoading: false,
            user,
            error: null,
          });
          return;
        }
      }

      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      sessionStorage.removeItem(REFRESH_TOKEN_KEY);
      sessionStorage.removeItem(ID_TOKEN_KEY);

      setState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: null,
      });
    } catch (error) {
      console.error('[NuPIdentity] Session initialization error:', error);
      setState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: error as Error,
      });
    }
  }, [fetchUserInfo]);

  const handleCallback = useCallback(async () => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const returnedState = params.get('state');
    const error = params.get('error');

    const clearOAuthState = () => {
      sessionStorage.removeItem('nupidentity_state');
      sessionStorage.removeItem('nupidentity_code_verifier');
      sessionStorage.removeItem('nupidentity_nonce');
    };

    if (error) {
      const errorDesc = params.get('error_description') || error;
      clearOAuthState();
      config.onError?.(new Error(errorDesc));
      return false;
    }

    if (!code || !returnedState) {
      return false;
    }

    const storedState = sessionStorage.getItem('nupidentity_state');
    const storedVerifier = sessionStorage.getItem('nupidentity_code_verifier');
    const storedNonce = sessionStorage.getItem('nupidentity_nonce');

    if (returnedState !== storedState) {
      clearOAuthState();
      config.onError?.(new Error('Invalid state parameter - possible CSRF attack'));
      return false;
    }

    try {
      const eps = await getEndpoints();
      
      const tokenResponse = await fetch(eps.token_endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: config.clientId,
          redirect_uri: config.redirectUri || window.location.origin + '/callback',
          code_verifier: storedVerifier || '',
        }),
      });

      if (!tokenResponse.ok) {
        clearOAuthState();
        throw new Error('Token exchange failed');
      }

      const tokens = await tokenResponse.json();

      if (tokens.id_token && storedNonce) {
        const idTokenPayload = parseJwt(tokens.id_token);
        if (idTokenPayload && idTokenPayload.nonce !== storedNonce) {
          clearOAuthState();
          throw new Error('Invalid nonce in ID token - possible replay attack');
        }
      }

      clearOAuthState();

      sessionStorage.setItem(TOKEN_STORAGE_KEY, tokens.access_token);
      if (tokens.refresh_token) {
        sessionStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
      }
      if (tokens.id_token) {
        sessionStorage.setItem(ID_TOKEN_KEY, tokens.id_token);
      }

      window.history.replaceState({}, document.title, window.location.pathname);

      setAccessToken(tokens.access_token);

      const user = await fetchUserInfo(tokens.access_token);
      if (user) {
        setState({
          isAuthenticated: true,
          isLoading: false,
          user,
          error: null,
        });
        config.onLoginSuccess?.(user);
      }

      return true;
    } catch (error) {
      console.error('[NuPIdentity] Callback handling error:', error);
      clearOAuthState();
      config.onError?.(error as Error);
      return false;
    }
  }, [config, fetchUserInfo, getEndpoints]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('code') && params.has('state')) {
      handleCallback();
    } else {
      initializeSession();
    }
  }, [handleCallback, initializeSession]);

  const login = useCallback(async () => {
    try {
      const eps = await getEndpoints();
      
      const state = generateRandomString(32);
      const nonce = generateRandomString(32);
      const codeVerifier = generateRandomString(64);
      const codeChallenge = base64UrlEncode(await sha256(codeVerifier));

      sessionStorage.setItem('nupidentity_state', state);
      sessionStorage.setItem('nupidentity_code_verifier', codeVerifier);
      sessionStorage.setItem('nupidentity_nonce', nonce);

      const scopes = config.scopes || ['openid', 'profile', 'email'];
      const redirectUri = config.redirectUri || window.location.origin + '/callback';

      const authUrl = new URL(eps.authorization_endpoint);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('client_id', config.clientId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('scope', scopes.join(' '));
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('nonce', nonce);
      authUrl.searchParams.set('code_challenge', codeChallenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');

      window.location.href = authUrl.toString();
    } catch (error) {
      console.error('[NuPIdentity] Login error:', error);
      config.onError?.(error as Error);
    }
  }, [config, getEndpoints]);

  const logout = useCallback(async () => {
    const idToken = sessionStorage.getItem(ID_TOKEN_KEY);

    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    sessionStorage.removeItem(ID_TOKEN_KEY);

    setAccessToken(null);
    setState({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      error: null,
    });

    config.onLogoutSuccess?.();

    if (idToken) {
      try {
        const eps = await getEndpoints();
        const logoutEndpoint = eps.end_session_endpoint || `${config.issuer}/api/oidc/logout`;
        const logoutUrl = new URL(logoutEndpoint);
        logoutUrl.searchParams.set('id_token_hint', idToken);
        logoutUrl.searchParams.set('post_logout_redirect_uri', window.location.origin);
        window.location.href = logoutUrl.toString();
      } catch {
        const logoutUrl = new URL(`${config.issuer}/api/oidc/logout`);
        logoutUrl.searchParams.set('id_token_hint', idToken);
        logoutUrl.searchParams.set('post_logout_redirect_uri', window.location.origin);
        window.location.href = logoutUrl.toString();
      }
    }
  }, [config, getEndpoints]);

  const getAccessToken = useCallback(() => accessToken, [accessToken]);

  const getUserIdFromToken = useCallback(() => {
    if (!accessToken) return null;
    const payload = parseJwt(accessToken);
    return payload ? getUserId(payload) : null;
  }, [accessToken]);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    const refreshToken = sessionStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) return false;

    try {
      const eps = await getEndpoints();
      
      const response = await fetch(eps.token_endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: config.clientId,
        }),
      });

      if (!response.ok) return false;

      const tokens = await response.json();

      sessionStorage.setItem(TOKEN_STORAGE_KEY, tokens.access_token);
      if (tokens.refresh_token) {
        sessionStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
      }

      setAccessToken(tokens.access_token);
      return true;
    } catch {
      return false;
    }
  }, [config, getEndpoints]);

  const contextValue: NuPIdentityContextType = {
    ...state,
    login,
    logout,
    getAccessToken,
    getUserId: getUserIdFromToken,
    refreshSession,
  };

  return (
    <NuPIdentityContext.Provider value={contextValue}>
      {children}
    </NuPIdentityContext.Provider>
  );
}

export function useNuPIdentity(): NuPIdentityContextType {
  const context = useContext(NuPIdentityContext);
  if (!context) {
    throw new Error('useNuPIdentity must be used within a NuPIdentityProvider');
  }
  return context;
}

export function useUser(): UserInfo | null {
  const { user } = useNuPIdentity();
  return user;
}

export function useIsAuthenticated(): boolean {
  const { isAuthenticated } = useNuPIdentity();
  return isAuthenticated;
}

export function useAccessToken(): string | null {
  const { getAccessToken } = useNuPIdentity();
  return getAccessToken();
}

export function usePermissions(): string[] {
  const token = useAccessToken();
  if (!token) return [];
  
  const payload = parseJwt(token);
  return (payload as any)?.permissions ?? [];
}

export function useHasPermission(permission: string): boolean {
  const permissions = usePermissions();
  return permissions.includes(permission);
}

export function useHasAllPermissions(...requiredPermissions: string[]): boolean {
  const permissions = usePermissions();
  return requiredPermissions.every((perm) => permissions.includes(perm));
}

export function useHasAnyPermission(...anyPermissions: string[]): boolean {
  const permissions = usePermissions();
  return anyPermissions.some((perm) => permissions.includes(perm));
}

export { NuPIdentityContext };
