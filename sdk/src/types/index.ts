export interface NuPIdentityConfig {
  issuer: string;
  clientId: string;
  clientSecret?: string;
  redirectUri?: string;
  scopes?: string[];
  audience?: string;
}

export interface TokenPayload {
  sub: string;
  userId?: string;
  id?: string;
  email?: string;
  name?: string;
  organizationId?: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string | string[];
  nonce?: string;
  scope?: string;
  [key: string]: unknown;
}

export interface OIDCDiscoveryDocument {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  jwks_uri: string;
  registration_endpoint?: string;
  scopes_supported: string[];
  response_types_supported: string[];
  grant_types_supported: string[];
  subject_types_supported: string[];
  id_token_signing_alg_values_supported: string[];
  claims_supported: string[];
  end_session_endpoint?: string;
}

export interface JWK {
  kty: string;
  use: string;
  kid: string;
  alg: string;
  n?: string;
  e?: string;
}

export interface JWKS {
  keys: JWK[];
}

export interface TokenSet {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
}

export interface UserInfo {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  organizationId?: string;
  [key: string]: unknown;
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserInfo | null;
  error: Error | null;
}

export interface NuPIdentityError extends Error {
  code: string;
  statusCode?: number;
}

export function getUserId(payload: TokenPayload): string {
  return payload.userId ?? payload.id ?? payload.sub;
}

export interface SystemFunction {
  key: string;
  name: string;
  category?: string;
  description?: string;
  endpoint?: string;
}

export interface SystemManifest {
  system: {
    id: string;
    name: string;
    description?: string;
    version?: string;
    apiUrl?: string;
    callbackUrl?: string;
  };
  functions: SystemFunction[];
}

export interface SystemRegistrationResult {
  success: boolean;
  message: string;
  system: {
    id: string;
    name: string;
    description?: string;
    apiUrl?: string;
    isActive?: boolean;
    createdAt?: string;
    updatedAt?: string;
  };
  functionsSync: {
    total: number;
    created: number;
    updated: number;
    removed: number;
    removedList?: string[];
  };
  integration?: {
    status: string;
    nextSteps: string[];
    endpoints?: Record<string, string>;
    jwtSecretInstructions?: string;
  };
}

export interface UserSystemPermissions {
  userId: string;
  organizationId: string | null;
  systemId: string;
  systemName: string;
  permissions: Array<{
    functionId: string;
    functionKey: string;
    name: string;
    category: string;
    source: string;
  }>;
  functionKeys: string[];
  total: number;
}
