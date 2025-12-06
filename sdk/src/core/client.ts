import * as crypto from 'crypto';
import type {
  NuPIdentityConfig,
  OIDCDiscoveryDocument,
  JWKS,
  JWK,
  TokenSet,
  UserInfo,
  TokenPayload,
  SystemManifest,
  SystemRegistrationResult,
  UserSystemPermissions,
} from '../types';

export class NuPIdentityClient {
  private config: NuPIdentityConfig;
  private discoveryDocument: OIDCDiscoveryDocument | null = null;
  private jwks: JWKS | null = null;
  private jwksLastFetch: number = 0;
  private readonly JWKS_CACHE_TTL = 5 * 60 * 1000;

  constructor(config: NuPIdentityConfig) {
    if (!config.issuer) {
      throw new Error('[NuPIdentity] issuer is required');
    }
    if (!config.clientId) {
      throw new Error('[NuPIdentity] clientId is required');
    }

    this.config = {
      ...config,
      issuer: config.issuer.replace(/\/$/, ''),
      scopes: config.scopes ?? ['openid', 'profile', 'email'],
    };
  }

  async discover(): Promise<OIDCDiscoveryDocument> {
    if (this.discoveryDocument) {
      return this.discoveryDocument;
    }

    const url = `${this.config.issuer}/.well-known/openid-configuration`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Discovery failed: ${response.status} ${response.statusText}`);
      }
      
      this.discoveryDocument = await response.json() as OIDCDiscoveryDocument;
      console.log('[NuPIdentity] Discovery document loaded successfully');
      return this.discoveryDocument;
    } catch (error) {
      console.error('[NuPIdentity] Failed to fetch discovery document:', error);
      throw new Error(`[NuPIdentity] Failed to discover OIDC configuration: ${error}`);
    }
  }

  async getJWKS(): Promise<JWKS> {
    const now = Date.now();
    
    if (this.jwks && (now - this.jwksLastFetch) < this.JWKS_CACHE_TTL) {
      return this.jwks;
    }

    const discovery = await this.discover();
    
    try {
      const response = await fetch(discovery.jwks_uri);
      if (!response.ok) {
        throw new Error(`JWKS fetch failed: ${response.status}`);
      }
      
      this.jwks = await response.json() as JWKS;
      this.jwksLastFetch = now;
      console.log('[NuPIdentity] JWKS loaded successfully');
      return this.jwks;
    } catch (error) {
      console.error('[NuPIdentity] Failed to fetch JWKS:', error);
      throw new Error(`[NuPIdentity] Failed to fetch JWKS: ${error}`);
    }
  }

  private async getPublicKey(kid: string): Promise<crypto.KeyObject> {
    const jwks = await this.getJWKS();
    const jwk = jwks.keys.find((k) => k.kid === kid);

    if (!jwk) {
      this.jwks = null;
      const refreshedJwks = await this.getJWKS();
      const refreshedJwk = refreshedJwks.keys.find((k) => k.kid === kid);
      
      if (!refreshedJwk) {
        throw new Error(`[NuPIdentity] Key with kid "${kid}" not found in JWKS`);
      }
      
      return crypto.createPublicKey({ key: refreshedJwk as unknown as crypto.JsonWebKey, format: 'jwk' });
    }

    return crypto.createPublicKey({ key: jwk as unknown as crypto.JsonWebKey, format: 'jwk' });
  }

  async verifyToken(token: string): Promise<TokenPayload> {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('[NuPIdentity] Invalid token format');
    }

    const [headerB64, payloadB64, signatureB64] = parts;

    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString());
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString()) as TokenPayload;

    if (header.alg !== 'RS256') {
      throw new Error(`[NuPIdentity] Unsupported algorithm: ${header.alg}`);
    }

    const publicKey = await this.getPublicKey(header.kid);

    const signatureInput = `${headerB64}.${payloadB64}`;
    const signature = Buffer.from(signatureB64, 'base64url');

    const isValid = crypto.verify(
      'RSA-SHA256',
      Buffer.from(signatureInput),
      publicKey,
      signature
    );

    if (!isValid) {
      throw new Error('[NuPIdentity] Invalid token signature');
    }

    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) {
      throw new Error('[NuPIdentity] Token has expired');
    }

    if (payload.iss && payload.iss !== this.config.issuer) {
      throw new Error(`[NuPIdentity] Invalid issuer: expected ${this.config.issuer}, got ${payload.iss}`);
    }

    return payload;
  }

  getAuthorizationUrl(options?: {
    state?: string;
    nonce?: string;
    redirectUri?: string;
    scopes?: string[];
    codeChallenge?: string;
    codeChallengeMethod?: 'S256' | 'plain';
  }): string {
    const discovery = this.discoveryDocument;
    if (!discovery) {
      throw new Error('[NuPIdentity] Call discover() first');
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: options?.redirectUri ?? this.config.redirectUri ?? '',
      scope: (options?.scopes ?? this.config.scopes ?? ['openid']).join(' '),
    });

    if (options?.state) params.set('state', options.state);
    if (options?.nonce) params.set('nonce', options.nonce);
    if (options?.codeChallenge) {
      params.set('code_challenge', options.codeChallenge);
      params.set('code_challenge_method', options.codeChallengeMethod ?? 'S256');
    }
    if (this.config.audience) {
      params.set('audience', this.config.audience);
    }

    return `${discovery.authorization_endpoint}?${params.toString()}`;
  }

  async exchangeCode(
    code: string,
    redirectUri?: string,
    codeVerifier?: string
  ): Promise<TokenSet> {
    const discovery = await this.discover();

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: this.config.clientId,
      redirect_uri: redirectUri ?? this.config.redirectUri ?? '',
    });

    if (this.config.clientSecret) {
      body.set('client_secret', this.config.clientSecret);
    }

    if (codeVerifier) {
      body.set('code_verifier', codeVerifier);
    }

    const response = await fetch(discovery.token_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`[NuPIdentity] Token exchange failed: ${error}`);
    }

    return response.json() as Promise<TokenSet>;
  }

  async getUserInfo(accessToken: string): Promise<UserInfo> {
    const discovery = await this.discover();

    const response = await fetch(discovery.userinfo_endpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`[NuPIdentity] UserInfo request failed: ${response.status}`);
    }

    return response.json() as Promise<UserInfo>;
  }

  async refreshToken(refreshToken: string): Promise<TokenSet> {
    const discovery = await this.discover();

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.config.clientId,
    });

    if (this.config.clientSecret) {
      body.set('client_secret', this.config.clientSecret);
    }

    const response = await fetch(discovery.token_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new Error('[NuPIdentity] Token refresh failed');
    }

    return response.json() as Promise<TokenSet>;
  }

  getLogoutUrl(options?: { idTokenHint?: string; postLogoutRedirectUri?: string }): string {
    const discovery = this.discoveryDocument;
    if (!discovery?.end_session_endpoint) {
      throw new Error('[NuPIdentity] Logout endpoint not available');
    }

    const params = new URLSearchParams();
    
    if (options?.idTokenHint) {
      params.set('id_token_hint', options.idTokenHint);
    }
    if (options?.postLogoutRedirectUri) {
      params.set('post_logout_redirect_uri', options.postLogoutRedirectUri);
    }

    const queryString = params.toString();
    return queryString 
      ? `${discovery.end_session_endpoint}?${queryString}` 
      : discovery.end_session_endpoint;
  }

  async registerSystem(
    manifest: SystemManifest,
    apiKey: string
  ): Promise<SystemRegistrationResult> {
    const url = `${this.config.issuer}/api/systems/register`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-System-API-Key': apiKey,
      },
      body: JSON.stringify(manifest),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(`[NuPIdentity] System registration failed: ${error.message || error.error}`);
    }

    const result = await response.json() as SystemRegistrationResult;
    console.log(`[NuPIdentity] System registered: ${manifest.system.id} - ${result.functionsSync.created} created, ${result.functionsSync.updated} updated`);
    return result;
  }

  async syncFunctions(
    systemId: string,
    manifest: SystemManifest,
    accessToken: string
  ): Promise<SystemRegistrationResult> {
    const url = `${this.config.issuer}/api/systems/${systemId}/sync-functions`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(manifest),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(`[NuPIdentity] Function sync failed: ${error.message || error.error}`);
    }

    return response.json() as Promise<SystemRegistrationResult>;
  }

  async getUserPermissions(
    userId: string,
    systemId: string,
    accessToken: string
  ): Promise<UserSystemPermissions> {
    const url = `${this.config.issuer}/api/validate/users/${userId}/systems/${systemId}/permissions`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`[NuPIdentity] Failed to get user permissions: ${response.status}`);
    }

    return response.json() as Promise<UserSystemPermissions>;
  }

  static generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  static generateCodeChallenge(verifier: string): string {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
  }

  static generateState(): string {
    return crypto.randomBytes(16).toString('base64url');
  }

  static generateNonce(): string {
    return crypto.randomBytes(16).toString('base64url');
  }
}
