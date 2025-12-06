export { NuPIdentityClient } from './core/client';

export {
  requireNuPAuth,
  attachUser,
  ensureScope,
  ensureOrganization,
  ensurePermission,
  ensureAnyPermission,
  createAuthRoutes,
} from './express/middleware';

export type {
  NuPIdentityMiddlewareOptions,
} from './express/middleware';

export type {
  NuPIdentityConfig,
  TokenPayload,
  OIDCDiscoveryDocument,
  JWK,
  JWKS,
  TokenSet,
  UserInfo,
  AuthState,
  NuPIdentityError,
} from './types';

export { getUserId } from './types';
