import { N as NuPIdentityConfig, O as OIDCDiscoveryDocument, J as JWKS, T as TokenPayload, b as TokenSet, U as UserInfo, S as SystemManifest, a as SystemRegistrationResult, c as UserSystemPermissions } from './index-B_NFA8jC.mjs';
import { Request, Response, RequestHandler } from 'express';

declare class NuPIdentityClient {
    private config;
    private discoveryDocument;
    private jwks;
    private jwksLastFetch;
    private readonly JWKS_CACHE_TTL;
    constructor(config: NuPIdentityConfig);
    discover(retries?: number): Promise<OIDCDiscoveryDocument>;
    getJWKS(): Promise<JWKS>;
    private getPublicKey;
    verifyToken(token: string): Promise<TokenPayload>;
    getAuthorizationUrl(options?: {
        state?: string;
        nonce?: string;
        redirectUri?: string;
        scopes?: string[];
        codeChallenge?: string;
        codeChallengeMethod?: 'S256' | 'plain';
    }): string;
    exchangeCode(code: string, redirectUri?: string, codeVerifier?: string): Promise<TokenSet>;
    getUserInfo(accessToken: string): Promise<UserInfo>;
    refreshToken(refreshToken: string): Promise<TokenSet>;
    getLogoutUrl(options?: {
        idTokenHint?: string;
        postLogoutRedirectUri?: string;
    }): string;
    registerSystem(manifest: SystemManifest, apiKey: string): Promise<SystemRegistrationResult>;
    syncFunctions(systemId: string, manifest: SystemManifest, accessToken: string): Promise<SystemRegistrationResult>;
    getUserPermissions(userId: string, systemId: string, accessToken: string): Promise<UserSystemPermissions>;
    static generateCodeVerifier(): string;
    static generateCodeChallenge(verifier: string): string;
    static generateState(): string;
    static generateNonce(): string;
}

declare global {
    namespace Express {
        interface Request {
            user?: TokenPayload;
            userId?: string;
            accessToken?: string;
        }
    }
}
interface NuPIdentityMiddlewareOptions extends NuPIdentityConfig {
    tokenExtractor?: (req: Request) => string | null;
    onError?: (error: Error, req: Request, res: Response) => void;
    optional?: boolean;
}
declare function requireNuPAuth(options: NuPIdentityMiddlewareOptions): RequestHandler;
declare function attachUser(options: NuPIdentityMiddlewareOptions): RequestHandler;
declare function ensureScope(...requiredScopes: string[]): RequestHandler;
declare function ensureOrganization(organizationId?: string): RequestHandler;
declare function ensurePermission(options: NuPIdentityMiddlewareOptions, ...requiredPermissions: string[]): RequestHandler[];
declare function ensureAnyPermission(options: NuPIdentityMiddlewareOptions, ...anyPermissions: string[]): RequestHandler[];
interface AuthRoutesOptions extends NuPIdentityMiddlewareOptions {
    successRedirect?: string;
    failureRedirect?: string;
}
declare function createAuthRoutes(options: AuthRoutesOptions, expressApp: {
    Router: () => any;
}): Promise<any>;

export { type AuthRoutesOptions as A, NuPIdentityClient as N, ensureAnyPermission as a, attachUser as b, ensureScope as c, ensureOrganization as d, ensurePermission as e, createAuthRoutes as f, type NuPIdentityMiddlewareOptions as g, requireNuPAuth as r };
