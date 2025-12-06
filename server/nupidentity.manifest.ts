export const manifest = {
  system: {
    id: 'nup-aim',
    name: 'NuP-AIM',
    description: 'Sistema de Análise de Impacto de Mudanças',
    version: '1.0.0',
  },
  functions: [
    { key: 'dashboard.view', name: 'Ver Dashboard', category: 'Dashboard' },
    
    { key: 'analysis.view', name: 'Ver Análises', category: 'Análises' },
    { key: 'analysis.create', name: 'Criar Análises', category: 'Análises' },
    { key: 'analysis.edit', name: 'Editar Análises', category: 'Análises' },
    { key: 'analysis.delete', name: 'Excluir Análises', category: 'Análises' },
    { key: 'analysis.export', name: 'Exportar Análises', category: 'Análises' },
    
    { key: 'projects.view', name: 'Ver Projetos', category: 'Projetos' },
    { key: 'projects.create', name: 'Criar Projetos', category: 'Projetos' },
    { key: 'projects.edit', name: 'Editar Projetos', category: 'Projetos' },
    { key: 'projects.delete', name: 'Excluir Projetos', category: 'Projetos' },
    
    { key: 'users.view', name: 'Ver Usuários', category: 'Usuários' },
    { key: 'users.create', name: 'Criar Usuários', category: 'Usuários' },
    { key: 'users.edit', name: 'Editar Usuários', category: 'Usuários' },
    { key: 'users.delete', name: 'Excluir Usuários', category: 'Usuários' },
    
    { key: 'profiles.view', name: 'Ver Perfis', category: 'Perfis' },
    { key: 'profiles.create', name: 'Criar Perfis', category: 'Perfis' },
    { key: 'profiles.edit', name: 'Editar Perfis', category: 'Perfis' },
    { key: 'profiles.delete', name: 'Excluir Perfis', category: 'Perfis' },
    
    { key: 'custom-fields.view', name: 'Ver Campos Personalizados', category: 'Campos Personalizados' },
    { key: 'custom-fields.manage', name: 'Gerenciar Campos Personalizados', category: 'Campos Personalizados' },
    
    { key: 'settings.manage', name: 'Gerenciar Configurações', category: 'Admin' },
  ],
};
