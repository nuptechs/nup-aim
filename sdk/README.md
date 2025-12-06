# @nupidentity/sdk

SDK oficial do NuPIdentity para integração SSO/OIDC simplificada.

## Pré-requisitos

Antes de integrar, você precisa ter:

1. **Acesso ao painel NuPIdentity** (URL do issuer)
2. **Um Client OIDC criado** no painel (client_id e client_secret)
3. **Uma API Key de sistema** (para registro automático de funcionalidades)

## Instalação

### Via npm (quando publicado)
```bash
npm install @nupidentity/sdk
```

### Instalação local (copiando a pasta sdk)

Se você copiou a pasta `sdk` para seu projeto:

```bash
# 1. Entre na pasta do SDK
cd sdk

# 2. Instale as dependências do SDK
npm install

# 3. Compile o SDK
npm run build

# 4. Volte para a raiz do projeto
cd ..

# 5. No package.json do seu projeto, adicione:
# "dependencies": {
#   "@nupidentity/sdk": "file:./sdk"
# }

# 6. Instale as dependências do projeto
npm install
```

## Variáveis de Ambiente Necessárias

### Backend (Node.js/Express)

```env
# URL do servidor NuPIdentity (obrigatório)
NUPIDENTITY_ISSUER=https://identify.nuptechs.com

# ID do cliente OIDC criado no painel (obrigatório)
NUPIDENTITY_CLIENT_ID=seu-client-id

# Secret do cliente (obrigatório para fluxos com backend)
NUPIDENTITY_CLIENT_SECRET=seu-client-secret

# Chave API para registrar sistema e funções (obrigatório para permissões)
NUPIDENTITY_API_KEY=sua-api-key

# URL pública da sua aplicação (para callbacks)
APP_URL=https://sua-app.com
```

### Frontend (React/Vite)

```env
# URL do servidor NuPIdentity
VITE_NUPIDENTITY_ISSUER=https://identify.nuptechs.com

# ID do cliente OIDC
VITE_NUPIDENTITY_CLIENT_ID=seu-client-id
```

## Como Obter as Credenciais

### 1. Criar um Cliente OIDC

1. Acesse o painel NuPIdentity
2. Vá em **Sistemas** > **Adicionar Cliente**
3. Preencha:
   - **Client ID**: identificador único (ex: `minha-app`)
   - **Redirect URIs**: URLs de callback (ex: `https://sua-app.com/auth/callback`)
   - **Logout URIs**: URLs pós-logout (ex: `https://sua-app.com/login`)
4. Salve e copie o **Client Secret** gerado

### 2. Obter a API Key do Sistema

1. No painel NuPIdentity, vá em **Sistemas**
2. Clique em **Gerar API Key**
3. Copie a chave gerada (ela só é mostrada uma vez!)

---

## Integração Completa (Recomendado)

A forma mais fácil de integrar é usando `setupNuPIdentity`. Com uma única chamada, você:
- Registra seu sistema e suas funcionalidades automaticamente
- Configura as rotas de autenticação
- Obtém middlewares prontos para verificar permissões

### Passo 1: Estrutura de Arquivos

```
seu-projeto/
├── sdk/                          # Pasta do SDK (copiada)
│   ├── dist/                     # Arquivos compilados
│   ├── src/
│   └── package.json
├── src/
│   ├── nupidentity.manifest.ts   # Definição do sistema
│   ├── server.ts                 # Backend Express
│   └── App.tsx                   # Frontend React
├── package.json
└── .env
```

### Passo 2: Definir o Manifesto do Sistema

Crie o arquivo `src/nupidentity.manifest.ts`:

```typescript
import { defineManifest } from '@nupidentity/sdk/express';

export const manifest = defineManifest({
  system: {
    id: 'meu-sistema',           // Deve ser único, use kebab-case
    name: 'Meu Sistema',
    description: 'Descrição do sistema',
    version: '1.0.0',
  },
  functions: [
    // Defina todas as funcionalidades/permissões do seu sistema
    { key: 'dashboard.view', name: 'Ver Dashboard', category: 'Dashboard' },
    { key: 'users.view', name: 'Ver Usuários', category: 'Usuários' },
    { key: 'users.create', name: 'Criar Usuários', category: 'Usuários' },
    { key: 'users.edit', name: 'Editar Usuários', category: 'Usuários' },
    { key: 'users.delete', name: 'Excluir Usuários', category: 'Usuários' },
    { key: 'settings.manage', name: 'Gerenciar Configurações', category: 'Admin' },
  ],
});
```

### Passo 3: Configurar o Backend

```typescript
import express from 'express';
import cookieParser from 'cookie-parser';
import { setupNuPIdentity } from '@nupidentity/sdk/express';
import { manifest } from './nupidentity.manifest';

const app = express();

// IMPORTANTE: cookie-parser é necessário para o SDK
app.use(cookieParser());
app.use(express.json());

async function start() {
  // Setup automático: registra sistema, configura rotas, etc.
  const nup = await setupNuPIdentity(app, {
    issuer: process.env.NUPIDENTITY_ISSUER!,
    clientId: process.env.NUPIDENTITY_CLIENT_ID!,
    clientSecret: process.env.NUPIDENTITY_CLIENT_SECRET,
    redirectUri: process.env.APP_URL + '/auth/callback',
    systemApiKey: process.env.NUPIDENTITY_API_KEY!,
    manifest,
    authRoutePrefix: '/auth',
    successRedirect: '/dashboard',
    failureRedirect: '/login',
    failOnSyncError: false, // true em produção
  });

  // Verificar se registro foi bem sucedido
  if (!nup.isRegistered) {
    console.warn('Sistema não registrado! Permissões não funcionarão.');
  }

  // Rotas criadas automaticamente:
  // GET  /auth/login    - Inicia login (redireciona para NuPIdentity)
  // GET  /auth/callback - Callback OAuth (processa retorno)
  // GET  /auth/me       - Dados do usuário logado
  // POST /auth/logout   - Logout
  // POST /auth/refresh  - Renovar token

  // Proteger rota com autenticação
  app.get('/api/profile', nup.requireAuth, (req, res) => {
    res.json({ user: req.user });
  });

  // Proteger rota com permissão específica (prefixo automático)
  app.get('/api/users', 
    ...nup.ensurePermission('users.view'),  // Equivale a 'meu-sistema:users.view'
    (req, res) => {
      res.json({ users: [] });
    }
  );

  // Exigir qualquer uma das permissões
  app.delete('/api/users/:id',
    ...nup.ensureAnyPermission('users.delete', 'settings.manage'),
    (req, res) => {
      res.json({ deleted: true });
    }
  );

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on :${PORT}`));
}

start().catch(console.error);
```

### Passo 4: Configurar o Frontend

```tsx
import { NuPIdentityProvider, useNuPIdentity, useHasPermission } from '@nupidentity/sdk/react';

function App() {
  return (
    <NuPIdentityProvider config={{
      issuer: import.meta.env.VITE_NUPIDENTITY_ISSUER,
      clientId: import.meta.env.VITE_NUPIDENTITY_CLIENT_ID,
    }}>
      <MainContent />
    </NuPIdentityProvider>
  );
}

function MainContent() {
  const { isAuthenticated, user, login, logout, isLoading } = useNuPIdentity();
  
  // Formato: 'systemId:functionKey'
  const canManageUsers = useHasPermission('meu-sistema:users.create');

  if (isLoading) return <div>Carregando...</div>;

  if (!isAuthenticated) {
    return <button onClick={login}>Entrar</button>;
  }

  return (
    <div>
      <p>Olá, {user?.name}!</p>
      {canManageUsers && <button>Gerenciar Usuários</button>}
      <button onClick={logout}>Sair</button>
    </div>
  );
}

export default App;
```

### Passo 5: Configurar no Painel NuPIdentity

1. Acesse o painel do NuPIdentity
2. Veja seu sistema registrado automaticamente em **Sistemas**
3. Vá em **Permissões** e configure quais usuários/times têm acesso a cada funcionalidade
4. Pronto! Os tokens já incluirão as permissões configuradas

---

## Configuração Simples (Só Autenticação)

Se você só precisa de autenticação sem sistema de permissões:

### Backend Express (sem permissões)

```typescript
import express from 'express';
import cookieParser from 'cookie-parser';
import { requireNuPAuth, createAuthRoutes } from '@nupidentity/sdk';

const app = express();
app.use(cookieParser());
app.use(express.json());

const authConfig = {
  issuer: process.env.NUPIDENTITY_ISSUER!,
  clientId: process.env.NUPIDENTITY_CLIENT_ID!,
  clientSecret: process.env.NUPIDENTITY_CLIENT_SECRET,
  redirectUri: process.env.APP_URL + '/auth/callback',
  successRedirect: '/dashboard',
  failureRedirect: '/login',
};

// Criar rotas de autenticação
app.use('/auth', createAuthRoutes(authConfig));

// Proteger rotas com autenticação
app.use('/api', requireNuPAuth(authConfig));

// Acessar dados do usuário
app.get('/api/profile', (req, res) => {
  res.json({
    userId: req.userId,
    email: req.user?.email,
    name: req.user?.name,
  });
});

app.listen(3000);
```

### Frontend React (sem permissões)

```tsx
import { NuPIdentityProvider, useNuPIdentity } from '@nupidentity/sdk/react';

function App() {
  return (
    <NuPIdentityProvider config={{
      issuer: import.meta.env.VITE_NUPIDENTITY_ISSUER,
      clientId: import.meta.env.VITE_NUPIDENTITY_CLIENT_ID,
    }}>
      <MainContent />
    </NuPIdentityProvider>
  );
}

function MainContent() {
  const { isAuthenticated, user, login, logout, isLoading } = useNuPIdentity();

  if (isLoading) return <div>Carregando...</div>;

  if (!isAuthenticated) {
    return <button onClick={login}>Entrar com NuPIdentity</button>;
  }

  return (
    <div>
      <p>Bem-vindo, {user?.name}!</p>
      <button onClick={logout}>Sair</button>
    </div>
  );
}
```

---

## API Completa

### Middleware Express

#### `requireNuPAuth(options)`
Protege rotas e valida tokens JWT automaticamente.

```typescript
import { requireNuPAuth } from '@nupidentity/sdk';

app.use('/api/protected', requireNuPAuth({
  issuer: 'https://identify.nuptechs.com',
  clientId: 'seu-client-id',
  clientSecret: 'seu-secret', // Opcional para validação adicional
}));

// req.user contém os dados do token
// req.userId contém o ID do usuário (userId ?? id ?? sub)
// req.accessToken contém o token original
```

#### `attachUser(options)`
Mesmo que `requireNuPAuth`, mas não bloqueia se não houver token.

```typescript
import { attachUser } from '@nupidentity/sdk';

app.use(attachUser({
  issuer: 'https://identify.nuptechs.com',
  clientId: 'seu-client-id',
}));

app.get('/api/content', (req, res) => {
  if (req.user) {
    // Usuário autenticado
  } else {
    // Usuário anônimo
  }
});
```

#### `ensureScope(...scopes)`
Verifica se o token tem os escopos necessários.

```typescript
import { requireNuPAuth, ensureScope } from '@nupidentity/sdk';

app.get('/api/admin', 
  requireNuPAuth(options),
  ensureScope('admin', 'write'),
  (req, res) => {
    // Só executa se o token tiver os escopos 'admin' e 'write'
  }
);
```

#### `ensureOrganization(orgId?)`
Verifica se o usuário pertence a uma organização.

```typescript
import { requireNuPAuth, ensureOrganization } from '@nupidentity/sdk';

app.get('/api/org/:orgId', 
  requireNuPAuth(options),
  ensureOrganization(), // Verifica se pertence a qualquer org
  (req, res) => { ... }
);
```

#### `ensurePermission(options, ...permissions)`
Verifica se o usuário tem TODAS as permissões listadas.

```typescript
import { ensurePermission } from '@nupidentity/sdk';

// Já inclui autenticação automaticamente
app.post('/api/courses', 
  ...ensurePermission(authConfig, 'meu-sistema:courses.create'),
  (req, res) => { ... }
);
```

#### `ensureAnyPermission(options, ...permissions)`
Verifica se o usuário tem QUALQUER UMA das permissões.

```typescript
import { ensureAnyPermission } from '@nupidentity/sdk';

app.get('/api/admin', 
  ...ensureAnyPermission(authConfig, 'meu-sistema:admin', 'meu-sistema:super-admin'),
  (req, res) => { ... }
);
```

#### `createAuthRoutes(options)`
Cria rotas de autenticação prontas para uso.

```typescript
import { createAuthRoutes } from '@nupidentity/sdk';

app.use('/auth', createAuthRoutes({
  issuer: 'https://identify.nuptechs.com',
  clientId: 'seu-client-id',
  clientSecret: 'seu-secret',
  redirectUri: 'https://seu-app.com/auth/callback',
  successRedirect: '/dashboard',
  failureRedirect: '/login',
}));

// Rotas criadas:
// GET  /auth/login    - Inicia fluxo de login
// GET  /auth/callback - Processa retorno do OAuth
// GET  /auth/me       - Retorna dados do usuário
// POST /auth/logout   - Faz logout
// POST /auth/refresh  - Renova o token
```

### React Hooks

#### `useNuPIdentity()`
Hook principal com todas as funcionalidades.

```tsx
const {
  isAuthenticated, // boolean - usuário está logado?
  isLoading,       // boolean - carregando estado inicial?
  user,            // UserInfo | null - dados do usuário
  error,           // Error | null - erro se houver
  login,           // () => void - inicia login
  logout,          // () => Promise<void> - faz logout
  getAccessToken,  // () => string | null - retorna token atual
  getUserId,       // () => string | null - retorna ID do usuário
  refreshSession,  // () => Promise<boolean> - renova sessão
} = useNuPIdentity();
```

#### `useUser()`
Retorna apenas os dados do usuário.

```tsx
const user = useUser();
// user?.email, user?.name, etc.
```

#### `useIsAuthenticated()`
Retorna apenas o estado de autenticação.

```tsx
const isAuthenticated = useIsAuthenticated();
```

#### `useAccessToken()`
Retorna apenas o token de acesso.

```tsx
const token = useAccessToken();
// Use para chamar APIs protegidas
```

#### `usePermissions()`
Retorna array com todas as permissões do usuário.

```tsx
const permissions = usePermissions();
// ['meu-sistema:users.view', 'meu-sistema:users.create', ...]
```

#### `useHasPermission(permission)`
Verifica se o usuário tem uma permissão específica.

```tsx
const canCreate = useHasPermission('meu-sistema:users.create');
```

#### `useHasAllPermissions(...permissions)`
Verifica se tem TODAS as permissões.

```tsx
const canManage = useHasAllPermissions(
  'meu-sistema:users.view',
  'meu-sistema:users.edit'
);
```

#### `useHasAnyPermission(...permissions)`
Verifica se tem QUALQUER UMA das permissões.

```tsx
const isAdmin = useHasAnyPermission(
  'meu-sistema:admin',
  'meu-sistema:super-admin'
);
```

### Cliente de Baixo Nível

Para casos avançados, use o `NuPIdentityClient` diretamente:

```typescript
import { NuPIdentityClient } from '@nupidentity/sdk';

const client = new NuPIdentityClient({
  issuer: 'https://identify.nuptechs.com',
  clientId: 'seu-client-id',
});

// Descobrir endpoints OIDC
await client.discover();

// Validar um token
const payload = await client.verifyToken(accessToken);
console.log(payload.sub, payload.email);

// Trocar código por tokens
const tokens = await client.exchangeCode(code, redirectUri, codeVerifier);

// Obter informações do usuário
const userInfo = await client.getUserInfo(tokens.access_token);

// Renovar token
const newTokens = await client.refreshToken(tokens.refresh_token);

// Registrar sistema (requer API Key)
const result = await client.registerSystem(manifest, apiKey);
```

---

## Troubleshooting

### Erro: "Cannot find module '@nupidentity/sdk'"

1. Verifique se compilou o SDK: `cd sdk && npm run build`
2. Verifique o package.json: `"@nupidentity/sdk": "file:./sdk"`
3. Reinstale: `npm install`

### Erro: "Invalid issuer" ou "Token validation failed"

1. Verifique se NUPIDENTITY_ISSUER está correto
2. A URL deve ser exatamente igual (com ou sem trailing slash)
3. Verifique se o servidor NuPIdentity está acessível

### Erro: "Invalid redirect_uri"

1. Verifique se a URL de callback está registrada no cliente OIDC
2. URLs devem ser exatamente iguais (incluindo protocolo e porta)

### Erro: "System registration failed"

1. Verifique se NUPIDENTITY_API_KEY está correta
2. A API Key pode ter expirado - gere uma nova no painel
3. Verifique se o system.id do manifesto é único

### Cookies não funcionam

1. Certifique-se de usar `app.use(cookieParser())` ANTES das rotas
2. Em produção, verifique se o domínio está correto
3. Verifique se está usando HTTPS em produção

### Permissões não aparecem no token

1. Verifique se o sistema foi registrado (console mostra `[NuPIdentity] Sync complete`)
2. Verifique se as permissões foram atribuídas no painel NuPIdentity
3. Faça logout e login novamente para obter um novo token

---

## Segurança

- Validação de assinatura RS256 via JWKS
- Cache de JWKS com TTL de 5 minutos
- Validação de expiração do token
- Validação do issuer
- Suporte a PKCE para clientes públicos
- Cookies HttpOnly para armazenamento seguro
- Proteção contra CSRF via state parameter

---

## Dependências

### Peer Dependencies (devem estar no seu projeto)

```json
{
  "express": ">=4.0.0",
  "react": ">=17.0.0"
}
```

### Dependências adicionais recomendadas

```bash
npm install cookie-parser
```

---

## Formato das Permissões

As permissões seguem o formato `{systemId}:{functionKey}`:

- `meu-sistema:users.view` - Ver usuários no sistema "meu-sistema"
- `nup-study:courses.create` - Criar cursos no NuP-Study

Isso permite que um usuário tenha permissões em múltiplos sistemas.

---

## Hierarquia de Permissões

O NuPIdentity resolve permissões nesta ordem (maior para menor prioridade):

1. **User Overrides** - Permissões específicas do usuário
2. **Team Profiles** - Permissões herdadas via times
3. **User Profiles** - Perfis atribuídos diretamente ao usuário
4. **Global Profiles** - Perfis marcados como globais

---

## Suporte

- Documentação: https://docs.nuptechs.com/identity
- Issues: https://github.com/nuptechs/nupidentity-sdk/issues
