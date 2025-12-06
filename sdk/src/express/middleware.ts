import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { NuPIdentityClient } from '../core/client';
import type { NuPIdentityConfig, TokenPayload, UserInfo } from '../types';
import { getUserId } from '../types';

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
      userId?: string;
      accessToken?: string;
    }
  }
}

export interface NuPIdentityMiddlewareOptions extends NuPIdentityConfig {
  tokenExtractor?: (req: Request) => string | null;
  onError?: (error: Error, req: Request, res: Response) => void;
  optional?: boolean;
}

const clientCache = new Map<string, { client: NuPIdentityClient; initPromise: Promise<void> }>();

function getCacheKey(config: NuPIdentityConfig): string {
  return `${config.issuer}:${config.clientId}`;
}

async function initializeClient(config: NuPIdentityConfig): Promise<NuPIdentityClient> {
  const cacheKey = getCacheKey(config);
  
  let cached = clientCache.get(cacheKey);
  
  if (!cached) {
    const client = new NuPIdentityClient(config);
    const initPromise = client.discover().then(() => {
      console.log(`[NuPIdentity] Client initialized for ${config.issuer}`);
    }).catch((error) => {
      console.error('[NuPIdentity] Client initialization failed:', error);
      clientCache.delete(cacheKey);
      throw error;
    });
    
    cached = { client, initPromise };
    clientCache.set(cacheKey, cached);
  }
  
  await cached.initPromise;
  return cached.client;
}

function defaultTokenExtractor(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  if (req.cookies?.access_token) {
    return req.cookies.access_token;
  }

  if (req.query?.access_token && typeof req.query.access_token === 'string') {
    return req.query.access_token;
  }

  return null;
}

function defaultErrorHandler(error: Error, req: Request, res: Response): void {
  console.error('[NuPIdentity] Authentication error:', error.message);
  res.status(401).json({
    error: 'Unauthorized',
    message: error.message,
  });
}

export function requireNuPAuth(options: NuPIdentityMiddlewareOptions): RequestHandler {
  const tokenExtractor = options.tokenExtractor ?? defaultTokenExtractor;
  const onError = options.onError ?? defaultErrorHandler;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = tokenExtractor(req);

      if (!token) {
        if (options.optional) {
          return next();
        }
        throw new Error('No access token provided');
      }

      const client = await initializeClient(options);
      const payload = await client.verifyToken(token);

      req.user = payload;
      req.userId = getUserId(payload);
      req.accessToken = token;

      next();
    } catch (error) {
      if (options.optional) {
        return next();
      }
      onError(error as Error, req, res);
    }
  };
}

export function attachUser(options: NuPIdentityMiddlewareOptions): RequestHandler {
  return requireNuPAuth({ ...options, optional: true });
}

export function ensureScope(...requiredScopes: string[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'No user attached' });
      return;
    }

    const tokenScopes = req.user.scope?.split(' ') ?? [];
    const hasAllScopes = requiredScopes.every((scope) => tokenScopes.includes(scope));

    if (!hasAllScopes) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Missing required scopes: ${requiredScopes.join(', ')}`,
      });
      return;
    }

    next();
  };
}

export function ensureOrganization(organizationId?: string): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'No user attached' });
      return;
    }

    const userOrgId = req.user.organizationId;

    if (!userOrgId) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'User does not belong to any organization',
      });
      return;
    }

    if (organizationId && userOrgId !== organizationId) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'User does not belong to the required organization',
      });
      return;
    }

    next();
  };
}

export function ensurePermission(
  options: NuPIdentityMiddlewareOptions,
  ...requiredPermissions: string[]
): RequestHandler[] {
  const authMiddleware = requireNuPAuth({ ...options, optional: false });
  
  const permissionMiddleware: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
    const userPermissions = (req.user as any)?.permissions as string[] | undefined;
    
    if (!userPermissions || userPermissions.length === 0) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'No permissions found in token',
        required: requiredPermissions,
      });
      return;
    }

    const hasAllPermissions = requiredPermissions.every((perm) => 
      userPermissions.includes(perm)
    );

    if (!hasAllPermissions) {
      const missing = requiredPermissions.filter((perm) => !userPermissions.includes(perm));
      res.status(403).json({
        error: 'Forbidden',
        message: `Missing required permissions: ${missing.join(', ')}`,
        required: requiredPermissions,
        missing,
      });
      return;
    }

    next();
  };

  return [authMiddleware, permissionMiddleware];
}

export function ensureAnyPermission(
  options: NuPIdentityMiddlewareOptions,
  ...anyPermissions: string[]
): RequestHandler[] {
  const authMiddleware = requireNuPAuth({ ...options, optional: false });
  
  const permissionMiddleware: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
    const userPermissions = (req.user as any)?.permissions as string[] | undefined;
    
    if (!userPermissions || userPermissions.length === 0) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'No permissions found in token',
        required: anyPermissions,
      });
      return;
    }

    const hasAnyPermission = anyPermissions.some((perm) => 
      userPermissions.includes(perm)
    );

    if (!hasAnyPermission) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Requires at least one of: ${anyPermissions.join(', ')}`,
        required: anyPermissions,
      });
      return;
    }

    next();
  };

  return [authMiddleware, permissionMiddleware];
}

export interface AuthRoutesOptions extends NuPIdentityMiddlewareOptions {
  successRedirect?: string;
  failureRedirect?: string;
}

export function createAuthRoutes(options: AuthRoutesOptions) {
  const express = require('express');
  const cookieParser = require('cookie-parser');
  const router = express.Router();
  
  router.use(cookieParser());
  
  const OAUTH_STATE_COOKIE = 'nupidentity_oauth_state';
  const OAUTH_VERIFIER_COOKIE = 'nupidentity_code_verifier';
  const OAUTH_NONCE_COOKIE = 'nupidentity_nonce';
  
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 10 * 60 * 1000,
    path: '/',
  };

  router.get('/login', async (req: Request, res: Response) => {
    try {
      const client = await initializeClient(options);

      const state = NuPIdentityClient.generateState();
      const nonce = NuPIdentityClient.generateNonce();
      const codeVerifier = NuPIdentityClient.generateCodeVerifier();
      const codeChallenge = NuPIdentityClient.generateCodeChallenge(codeVerifier);

      res.cookie(OAUTH_STATE_COOKIE, state, cookieOptions);
      res.cookie(OAUTH_VERIFIER_COOKIE, codeVerifier, cookieOptions);
      res.cookie(OAUTH_NONCE_COOKIE, nonce, cookieOptions);

      const authUrl = client.getAuthorizationUrl({
        state,
        nonce,
        codeChallenge,
        codeChallengeMethod: 'S256',
        redirectUri: options.redirectUri,
      });

      res.redirect(authUrl);
    } catch (error) {
      console.error('[NuPIdentity] Login error:', error);
      if (options.failureRedirect) {
        res.redirect(options.failureRedirect + '?error=login_failed');
      } else {
        res.status(500).json({ error: 'Failed to initiate login' });
      }
    }
  });

  router.get('/callback', async (req: Request, res: Response) => {
    const clearOAuthCookies = () => {
      res.clearCookie(OAUTH_STATE_COOKIE);
      res.clearCookie(OAUTH_VERIFIER_COOKIE);
      res.clearCookie(OAUTH_NONCE_COOKIE);
    };
    
    try {
      const { code, state, error, error_description } = req.query;

      if (error) {
        clearOAuthCookies();
        throw new Error(`OAuth error: ${error} - ${error_description}`);
      }

      if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
        clearOAuthCookies();
        throw new Error('Missing code or state parameter');
      }

      const storedState = req.cookies?.[OAUTH_STATE_COOKIE];
      const storedVerifier = req.cookies?.[OAUTH_VERIFIER_COOKIE];
      const storedNonce = req.cookies?.[OAUTH_NONCE_COOKIE];
      
      if (!storedState || !storedVerifier) {
        clearOAuthCookies();
        throw new Error('Missing OAuth state cookies - session may have expired');
      }
      
      if (state !== storedState) {
        clearOAuthCookies();
        throw new Error('Invalid state parameter - possible CSRF attack');
      }

      clearOAuthCookies();

      const client = await initializeClient(options);
      const tokens = await client.exchangeCode(
        code,
        options.redirectUri,
        storedVerifier
      );

      if (tokens.id_token && storedNonce) {
        try {
          const idTokenPayload = JSON.parse(
            Buffer.from(tokens.id_token.split('.')[1], 'base64url').toString()
          );
          if (idTokenPayload.nonce !== storedNonce) {
            throw new Error('Invalid nonce in ID token - possible replay attack');
          }
        } catch (nonceError) {
          if ((nonceError as Error).message.includes('nonce')) {
            throw nonceError;
          }
          console.warn('[NuPIdentity] Could not validate nonce:', nonceError);
        }
      }

      res.cookie('access_token', tokens.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: (tokens.expires_in ?? 3600) * 1000,
      });

      if (tokens.refresh_token) {
        res.cookie('refresh_token', tokens.refresh_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });
      }
      
      if (tokens.id_token) {
        res.cookie('id_token', tokens.id_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: (tokens.expires_in ?? 3600) * 1000,
        });
      }

      res.redirect(options.successRedirect ?? '/');
    } catch (error) {
      console.error('[NuPIdentity] Callback error:', error);
      if (options.failureRedirect) {
        const errorMsg = encodeURIComponent((error as Error).message);
        res.redirect(`${options.failureRedirect}?error=${errorMsg}`);
      } else {
        res.status(500).json({ error: 'Authentication failed', message: (error as Error).message });
      }
    }
  });

  router.get('/me', requireNuPAuth(options), async (req: Request, res: Response) => {
    try {
      if (!req.accessToken) {
        throw new Error('No access token');
      }

      const client = await initializeClient(options);
      const userInfo = await client.getUserInfo(req.accessToken);

      res.json(userInfo);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get user info' });
    }
  });

  router.post('/logout', (req: Request, res: Response) => {
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    res.json({ success: true });
  });

  router.post('/refresh', async (req: Request, res: Response) => {
    try {
      const refreshToken = req.cookies?.refresh_token;
      if (!refreshToken) {
        throw new Error('No refresh token');
      }

      const client = await initializeClient(options);
      const tokens = await client.refreshToken(refreshToken);

      res.cookie('access_token', tokens.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: (tokens.expires_in ?? 3600) * 1000,
      });

      res.json({ success: true, expires_in: tokens.expires_in });
    } catch (error) {
      res.status(401).json({ error: 'Token refresh failed' });
    }
  });

  return router;
}

export { NuPIdentityClient };
