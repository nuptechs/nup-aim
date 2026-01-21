import React, { useState, useEffect } from 'react';
import { 
  FileText, Users, FolderOpen, AlertTriangle, Shield,
  TrendingUp, Clock, ArrowRight, Plus, Activity
} from 'lucide-react';
import { useAuth } from '../contexts/ApiAuthContext';
import { apiClient } from '../lib/apiClient';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { Badge } from './ui/Badge';
import { Progress, CircularProgress } from './ui/Progress';
import { SkeletonLoader } from './ui/LoadingSpinner';

interface DashboardStats {
  totalAnalyses: number;
  totalProjects: number;
  totalUsers: number;
  totalImpacts: number;
  totalRisks: number;
  recentAnalyses: any[];
}

interface DashboardProps {
  onNavigate?: (view: string) => void;
  onNewAnalysis?: () => void;
  onSelectAnalysis?: (analysisId: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate, onNewAnalysis, onSelectAnalysis }) => {
  const { hasPermission } = useAuth();
  const token = apiClient.getToken();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/dashboard/stats', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        const data = await response.json();
        if (data.success) {
          setStats(data.stats);
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [token]);

  if (isLoading) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
              <SkeletonLoader height={20} width="70%" className="mb-3" />
              <SkeletonLoader height={40} width="50%" className="mb-2" />
              <SkeletonLoader height={16} width="40%" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const quickActions = [
    {
      icon: Plus,
      label: 'Nova Análise',
      description: 'Criar nova análise de impacto',
      color: 'primary' as const,
      onClick: onNewAnalysis,
      permission: hasPermission('ANALYSIS', 'CREATE'),
    },
    {
      icon: FileText,
      label: 'Minhas Análises',
      description: 'Gerenciar análises existentes',
      color: 'secondary' as const,
      onClick: () => onNavigate?.('analyses'),
      permission: hasPermission('ANALYSIS', 'VIEW'),
    },
    {
      icon: FolderOpen,
      label: 'Projetos',
      description: 'Gerenciar projetos',
      color: 'success' as const,
      onClick: () => onNavigate?.('projects'),
      permission: hasPermission('PROJECTS', 'MANAGE'),
    },
    {
      icon: Users,
      label: 'Usuários',
      description: 'Gerenciar usuários',
      color: 'warning' as const,
      onClick: () => onNavigate?.('users'),
      permission: hasPermission('USERS', 'MANAGE'),
    },
  ].filter(action => action.permission);

  const activityData = [
    { label: 'Análises criadas', value: 75 },
    { label: 'Em revisão', value: 45 },
    { label: 'Aprovadas', value: 80 },
    { label: 'Pendentes', value: 30 },
  ];

  const colorConfig = {
    primary: {
      iconBg: 'bg-blue-50 dark:bg-blue-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
      gradient: 'from-blue-500/10 to-blue-600/5',
    },
    secondary: {
      iconBg: 'bg-indigo-50 dark:bg-indigo-900/30',
      iconColor: 'text-indigo-600 dark:text-indigo-400',
      gradient: 'from-indigo-500/10 to-indigo-600/5',
    },
    success: {
      iconBg: 'bg-emerald-50 dark:bg-emerald-900/30',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      gradient: 'from-emerald-500/10 to-emerald-600/5',
    },
    warning: {
      iconBg: 'bg-amber-50 dark:bg-amber-900/30',
      iconColor: 'text-amber-600 dark:text-amber-400',
      gradient: 'from-amber-500/10 to-amber-600/5',
    },
    danger: {
      iconBg: 'bg-rose-50 dark:bg-rose-900/30',
      iconColor: 'text-rose-600 dark:text-rose-400',
      gradient: 'from-rose-500/10 to-rose-600/5',
    },
  };

  const statCards = [
    {
      title: 'Minhas Análises',
      value: stats?.totalAnalyses || 0,
      icon: FileText,
      color: 'primary' as const,
      onClick: () => onNavigate?.('analyses'),
    },
    ...(hasPermission('PROJECTS', 'MANAGE') ? [{
      title: 'Projetos Ativos',
      value: stats?.totalProjects || 0,
      icon: FolderOpen,
      color: 'success' as const,
      onClick: () => onNavigate?.('projects'),
    }] : []),
    {
      title: 'Impactos Identificados',
      value: stats?.totalImpacts || 0,
      icon: AlertTriangle,
      color: 'warning' as const,
      onClick: () => onNavigate?.('analyses'),
    },
    {
      title: 'Riscos Mapeados',
      value: stats?.totalRisks || 0,
      icon: Shield,
      color: 'danger' as const,
      onClick: () => onNavigate?.('analyses'),
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Dashboard
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Visão geral do sistema de análise de impacto
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Clock className="w-4 h-4" />
          <span>Última atualização: {new Date().toLocaleTimeString('pt-BR')}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          const config = colorConfig[stat.color];
          return (
            <button
              key={index}
              onClick={stat.onClick}
              className={`
                relative overflow-hidden text-left
                bg-white dark:bg-gray-800 
                border border-gray-200 dark:border-gray-700 
                rounded-2xl p-5
                min-h-[120px]
                hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600
                transition-all duration-200
                group
              `}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${config.gradient} opacity-0 group-hover:opacity-100 transition-opacity`} />
              <div className="relative flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{stat.title}</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-2">{stat.value}</p>
                </div>
                <div className={`flex-shrink-0 w-12 h-12 ${config.iconBg} rounded-xl flex items-center justify-center ml-3`}>
                  <Icon className={`w-6 h-6 ${config.iconColor}`} />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {quickActions.map((action, index) => {
                  const Icon = action.icon;
                  const config = colorConfig[action.color];
                  return (
                    <button
                      key={index}
                      onClick={action.onClick}
                      className={`
                        flex items-center gap-4 p-4
                        bg-gray-50 dark:bg-gray-700/30
                        border border-gray-100 dark:border-gray-700
                        rounded-xl
                        hover:bg-gray-100 dark:hover:bg-gray-700/50
                        hover:border-gray-200 dark:hover:border-gray-600
                        transition-all duration-200
                        min-h-[80px]
                        group
                      `}
                    >
                      <div className={`w-11 h-11 ${config.iconBg} rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform`}>
                        <Icon className={`w-5 h-5 ${config.iconColor}`} />
                      </div>
                      <div className="text-left min-w-0 flex-1">
                        <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{action.label}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{action.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {hasPermission('DASHBOARD', 'VIEW_PROGRESS') && (
          <div className="lg:col-span-5">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Progresso do Mês</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center">
                  <CircularProgress
                    value={68}
                    size={140}
                    strokeWidth={12}
                    variant="primary"
                    label="Concluído"
                  />
                  <div className="mt-6 w-full space-y-3">
                    {activityData.map((item, index) => (
                      <div key={index}>
                        <div className="flex justify-between text-sm mb-1.5">
                          <span className="text-gray-600 dark:text-gray-400">{item.label}</span>
                          <span className="font-medium text-gray-900 dark:text-gray-100">{item.value}%</span>
                        </div>
                        <Progress value={item.value} size="sm" variant="gradient" />
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader
            action={
              <button 
                onClick={() => onNavigate?.('analyses')}
                className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1 font-medium"
              >
                Ver todas <ArrowRight className="w-4 h-4" />
              </button>
            }
          >
            <CardTitle>Análises Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.recentAnalyses && stats.recentAnalyses.length > 0 ? (
              <div className="space-y-2">
                {stats.recentAnalyses.slice(0, 5).map((analysis: any, index: number) => (
                  <button
                    key={analysis.id || index}
                    onClick={() => analysis.id && onSelectAnalysis?.(analysis.id)}
                    className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 border border-transparent hover:border-gray-200 dark:hover:border-gray-600 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-all text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                          {analysis.title || `Análise ${index + 1}`}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {analysis.author || 'Autor não definido'}
                        </p>
                      </div>
                    </div>
                    <Badge variant="primary" size="sm" className="flex-shrink-0 ml-3">
                      v{analysis.version || '1.0'}
                    </Badge>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-10">
                <div className="w-14 h-14 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-7 h-7 text-gray-400" />
                </div>
                <p className="text-gray-500 dark:text-gray-400 mb-3">
                  Nenhuma análise recente
                </p>
                {hasPermission('ANALYSIS', 'CREATE') && (
                  <button
                    onClick={onNewAnalysis}
                    className="text-sm text-primary-600 dark:text-primary-400 hover:underline font-medium"
                  >
                    Criar primeira análise
                  </button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {hasPermission('DASHBOARD', 'VIEW_STATS') && (
          <Card>
            <CardHeader>
              <CardTitle>Estatísticas do Sistema</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-100 dark:border-blue-800/30">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-white dark:bg-gray-800 rounded-xl shadow-sm flex items-center justify-center">
                      <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">Usuários Ativos</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Total cadastrados</p>
                    </div>
                  </div>
                  <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                    {stats?.totalUsers || 0}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800/30 text-center">
                    <div className="w-10 h-10 bg-white dark:bg-gray-800 rounded-xl shadow-sm flex items-center justify-center mx-auto mb-2">
                      <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">95%</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Taxa de Sucesso</p>
                  </div>
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800/30 text-center">
                    <div className="w-10 h-10 bg-white dark:bg-gray-800 rounded-xl shadow-sm flex items-center justify-center mx-auto mb-2">
                      <Activity className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">24</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Ações Pendentes</p>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-700 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Capacidade do Sistema
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">45%</span>
                  </div>
                  <Progress value={45} variant="gradient" animated />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
