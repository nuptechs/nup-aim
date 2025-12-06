import * as react_jsx_runtime from 'react/jsx-runtime';
import * as react from 'react';
import { ReactNode } from 'react';
import { U as UserInfo, A as AuthState } from '../index-B_NFA8jC.js';

interface OIDCEndpoints {
    authorization_endpoint: string;
    token_endpoint: string;
    userinfo_endpoint: string;
    end_session_endpoint?: string;
}
interface NuPIdentityProviderConfig {
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
declare const NuPIdentityContext: react.Context<NuPIdentityContextType | null>;
declare function NuPIdentityProvider({ children, config, }: {
    children: ReactNode;
    config: NuPIdentityProviderConfig;
}): react_jsx_runtime.JSX.Element;
declare function useNuPIdentity(): NuPIdentityContextType;
declare function useUser(): UserInfo | null;
declare function useIsAuthenticated(): boolean;
declare function useAccessToken(): string | null;
declare function usePermissions(): string[];
declare function useHasPermission(permission: string): boolean;
declare function useHasAllPermissions(...requiredPermissions: string[]): boolean;
declare function useHasAnyPermission(...anyPermissions: string[]): boolean;

export { NuPIdentityContext, NuPIdentityProvider, type NuPIdentityProviderConfig, type OIDCEndpoints, useAccessToken, useHasAllPermissions, useHasAnyPermission, useHasPermission, useIsAuthenticated, useNuPIdentity, usePermissions, useUser };
