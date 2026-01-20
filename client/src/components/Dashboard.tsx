import React, { useState, useEffect } from 'react';
import { 
  FileText, Users, FolderOpen, AlertTriangle, Shield,
  TrendingUp, Clock, ArrowRight, Plus, Activity
} from 'lucide-react';
import { useAuth } from '../contexts/ApiAuthContext';
import { apiClient } from '../lib/apiClient';
import { Card, CardHeader, CardTitle, CardContent, StatCard } from './ui/Card';
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
      <div className="space-y-6 animate-fade-in">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <SkeletonLoader height={24} width="60%" className="mb-2" />
              <SkeletonLoader height={36} width="40%" className="mb-3" />
              <SkeletonLoader height={16} width="80%" />
            </Card>
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
      color: 'primary',
      onClick: onNewAnalysis,
      permission: hasPermission('ANALYSIS', 'CREATE'),
    },
    {
      icon: FileText,
      label: 'Minhas Análises',
      description: 'Gerenciar análises existentes',
      color: 'secondary',
      onClick: () => onNavigate?.('analyses'),
      permission: hasPermission('ANALYSIS', 'VIEW'),
    },
    {
      icon: FolderOpen,
      label: 'Projetos',
      description: 'Gerenciar projetos',
      color: 'success',
      onClick: () => onNavigate?.('projects'),
      permission: hasPermission('PROJECTS', 'MANAGE'),
    },
    {
      icon: Users,
      label: 'Usuários',
      description: 'Gerenciar usuários',
      color: 'warning',
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

      <div className={`grid grid-cols-1 md:grid-cols-2 ${hasPermission('PROJECTS', 'MANAGE') ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-6`}>
        <div className="animate-fade-in-up stagger-1">
          <StatCard
            title="Minhas Análises"
            value={stats?.totalAnalyses || 0}
            icon={<FileText className="w-6 h-6" />}
            color="primary"
          />
        </div>
        {hasPermission('PROJECTS', 'MANAGE') && (
          <div className="animate-fade-in-up stagger-2">
            <StatCard
              title="Projetos Ativos"
              value={stats?.totalProjects || 0}
              icon={<FolderOpen className="w-6 h-6" />}
              color="success"
            />
          </div>
        )}
        <div className="animate-fade-in-up stagger-3">
          <StatCard
            title="Impactos Identificados"
            value={stats?.totalImpacts || 0}
            icon={<AlertTriangle className="w-6 h-6" />}
            color="warning"
          />
        </div>
        <div className="animate-fade-in-up stagger-4">
          <StatCard
            title="Riscos Mapeados"
            value={stats?.totalRisks || 0}
            icon={<Shield className="w-6 h-6" />}
            color="danger"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 animate-fade-in-up stagger-5">
          <Card>
            <CardHeader>
              <CardTitle>Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {quickActions.map((action, index) => {
                  const Icon = action.icon;
                  const colorClasses = {
                    primary: 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/30',
                    secondary: 'bg-secondary-50 dark:bg-secondary-900/20 text-secondary-600 dark:text-secondary-400 hover:bg-secondary-100 dark:hover:bg-secondary-900/30',
                    success: 'bg-success-50 dark:bg-success-900/20 text-success-600 dark:text-success-400 hover:bg-success-100 dark:hover:bg-success-900/30',
                    warning: 'bg-warning-50 dark:bg-warning-900/20 text-warning-600 dark:text-warning-400 hover:bg-warning-100 dark:hover:bg-warning-900/30',
                  };

                  return (
                    <button
                      key={index}
                      onClick={action.onClick}
                      className={`
                        flex items-center gap-4 p-4 rounded-xl transition-all duration-200
                        ${colorClasses[action.color as keyof typeof colorClasses]}
                        hover:shadow-md hover:-translate-y-0.5
                      `}
                    >
                      <div className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-gray-900 dark:text-gray-100">{action.label}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{action.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {hasPermission('DASHBOARD', 'VIEW_PROGRESS') && (
          <div className="animate-fade-in-up stagger-6">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Progresso do Mês</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center py-4">
                <CircularProgress
                  value={68}
                  size={120}
                  strokeWidth={10}
                  variant="primary"
                  label="Concluído"
                />
                <div className="mt-6 w-full space-y-3">
                  {activityData.map((item, index) => (
                    <div key={index}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600 dark:text-gray-400">{item.label}</span>
                        <span className="font-medium text-gray-900 dark:text-gray-100">{item.value}%</span>
                      </div>
                      <Progress value={item.value} size="sm" variant="gradient" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="animate-fade-in-up stagger-7">
          <Card>
            <CardHeader
              action={
                <button 
                  onClick={() => onNavigate?.('analyses')}
                  className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
                >
                  Ver todas <ArrowRight className="w-4 h-4" />
                </button>
              }
            >
              <CardTitle>Análises Recentes</CardTitle>
            </CardHeader>
            <CardContent>
              {stats?.recentAnalyses && stats.recentAnalyses.length > 0 ? (
                <div className="space-y-3">
                  {stats.recentAnalyses.slice(0, 5).map((analysis: any, index: number) => (
                    <div
                      key={analysis.id || index}
                      onClick={() => analysis.id && onSelectAnalysis?.(analysis.id)}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
                          <FileText className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-100">
                            {analysis.title || `Análise ${index + 1}`}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {analysis.author || 'Autor não definido'}
                          </p>
                        </div>
                      </div>
                      <Badge variant="primary" size="sm">
                        v{analysis.version || '1.0'}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <FileText className="w-6 h-6 text-gray-400" />
                  </div>
                  <p className="text-gray-500 dark:text-gray-400">
                    Nenhuma análise recente
                  </p>
                  {hasPermission('ANALYSIS', 'CREATE') && (
                    <button
                      onClick={onNewAnalysis}
                      className="mt-3 text-sm text-primary-600 dark:text-primary-400 hover:underline"
                    >
                      Criar primeira análise
                    </button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {hasPermission('DASHBOARD', 'VIEW_STATS') && (
          <div className="animate-fade-in-up stagger-8">
            <Card>
              <CardHeader>
                <CardTitle>Estatísticas do Sistema</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-primary-50 to-secondary-50 dark:from-primary-900/20 dark:to-secondary-900/20 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                        <Users className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">Usuários Ativos</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Total cadastrados</p>
                      </div>
                    </div>
                    <span className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                      {stats?.totalUsers || 0}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-success-50 dark:bg-success-900/20 rounded-xl text-center">
                      <TrendingUp className="w-6 h-6 text-success-600 dark:text-success-400 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-success-600 dark:text-success-400">95%</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Taxa de Sucesso</p>
                    </div>
                    <div className="p-4 bg-warning-50 dark:bg-warning-900/20 rounded-xl text-center">
                      <Activity className="w-6 h-6 text-warning-600 dark:text-warning-400 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-warning-600 dark:text-warning-400">24</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Ações Pendentes</p>
                    </div>
                  </div>

                  <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Capacidade do Sistema
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">45%</span>
                    </div>
                    <Progress value={45} variant="gradient" animated />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
