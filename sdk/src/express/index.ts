export {
  requireNuPAuth,
  attachUser,
  ensureScope,
  ensureOrganization,
  ensurePermission,
  ensureAnyPermission,
  createAuthRoutes,
  NuPIdentityClient,
} from './middleware';

export {
  setupNuPIdentity,
  defineManifest,
  defineFunction,
} from './setup';

export type { NuPIdentityMiddlewareOptions, AuthRoutesOptions } from './middleware';
export type { NuPIdentitySetupOptions, NuPIdentityApp } from './setup';
