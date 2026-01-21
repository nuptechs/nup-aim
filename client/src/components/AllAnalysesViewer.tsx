import React, { useState, useEffect } from 'react';
import { X, Search, RefreshCw, ExternalLink, User, Calendar, FileText, Filter } from 'lucide-react';
import { apiClient } from '../lib/apiClient';

interface Analysis {
  id: string;
  title: string;
  description: string | null;
  author: string;
  version: string | null;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
  createdByUserId: string | null;
  createdByUsername: string | null;
  createdByEmail: string | null;
  createdByFullName: string | null;
}

interface AllAnalysesViewerProps {
  onClose: () => void;
  onOpenAnalysis?: (analysisId: string) => void;
}

export const AllAnalysesViewer: React.FC<AllAnalysesViewerProps> = ({ onClose, onOpenAnalysis }) => {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<string>('all');

  const loadAnalyses = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const token = apiClient.getToken();
      const response = await fetch('/api/analyses/all', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAnalyses(data);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Erro ao carregar análises');
      }
    } catch (err) {
      console.error('Erro ao carregar análises:', err);
      setError('Erro de conexão ao carregar análises');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAnalyses();
  }, []);

  const uniqueUsers = React.useMemo(() => {
    const users = new Map<string, { name: string; email: string | null }>();
    analyses.forEach(a => {
      const userId = a.createdByUserId || 'unknown';
      if (!users.has(userId)) {
        users.set(userId, {
          name: a.createdByFullName || a.createdByUsername || 'Desconhecido',
          email: a.createdByEmail
        });
      }
    });
    return Array.from(users.entries()).map(([id, data]) => ({ id, ...data }));
  }, [analyses]);

  const filteredAnalyses = analyses.filter(analysis => {
    const search = searchTerm.toLowerCase();
    const matchesSearch = 
      analysis.title.toLowerCase().includes(search) ||
      analysis.author.toLowerCase().includes(search) ||
      analysis.createdByUsername?.toLowerCase().includes(search) ||
      analysis.createdByFullName?.toLowerCase().includes(search) ||
      analysis.createdByEmail?.toLowerCase().includes(search);
    
    const matchesUser = selectedUser === 'all' || analysis.createdByUserId === selectedUser;
    
    return matchesSearch && matchesUser;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleOpenAnalysis = (analysisId: string) => {
    if (onOpenAnalysis) {
      onOpenAnalysis(analysisId);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden">
        
        <div className="flex items-center justify-between px-8 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Todas as Análises</h2>
            <p className="text-sm text-gray-500 mt-1">
              {analyses.length} análise(s) de {uniqueUsers.length} usuário(s)
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            title="Fechar"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="px-8 py-4 bg-gray-50/50 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por título ou autor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
            
            <div className="flex gap-2">
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className="pl-9 pr-8 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none cursor-pointer min-w-[180px]"
                >
                  <option value="all">Todos os usuários</option>
                  {uniqueUsers.map(user => (
                    <option key={user.id} value={user.id}>{user.name}</option>
                  ))}
                </select>
              </div>
              
              <button
                onClick={loadAnalyses}
                disabled={isLoading}
                className="p-2.5 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl transition-colors disabled:opacity-50"
                title="Atualizar"
              >
                <RefreshCw className={`w-4 h-4 text-gray-500 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-500 text-sm">Carregando análises...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
                <X className="w-8 h-8 text-red-400" />
              </div>
              <p className="text-gray-600 font-medium">{error}</p>
              <button
                onClick={loadAnalyses}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Tentar novamente
              </button>
            </div>
          ) : filteredAnalyses.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                <FileText className="w-8 h-8 text-gray-400" />
              </div>
              <div className="text-center">
                <p className="text-gray-600 font-medium">
                  {searchTerm || selectedUser !== 'all' ? 'Nenhuma análise encontrada' : 'Nenhuma análise cadastrada'}
                </p>
                <p className="text-gray-400 text-sm mt-1">
                  {searchTerm ? 'Tente ajustar os filtros de busca' : 'As análises aparecerão aqui'}
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredAnalyses.map((analysis) => (
                <div
                  key={analysis.id}
                  className="px-8 py-5 hover:bg-gray-50/70 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-6">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-base font-semibold text-gray-900 truncate">
                          {analysis.title || 'Sem título'}
                        </h3>
                        {analysis.version && (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs font-medium rounded-md">
                            v{analysis.version}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-gray-500">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5" />
                          <span>{analysis.author || 'Sem autor'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{formatDate(analysis.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-right hidden sm:block">
                        <span 
                          className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full"
                          title={analysis.createdByEmail || undefined}
                        >
                          {analysis.createdByFullName || analysis.createdByUsername || 'Desconhecido'}
                        </span>
                      </div>
                      
                      <button
                        onClick={() => handleOpenAnalysis(analysis.id)}
                        disabled={!onOpenAnalysis}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                          onOpenAnalysis 
                            ? 'bg-blue-600 hover:bg-blue-700 text-white opacity-80 group-hover:opacity-100' 
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                        title={onOpenAnalysis ? 'Abrir análise' : 'Funcionalidade não disponível'}
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span className="hidden sm:inline">Abrir PA</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {filteredAnalyses.length > 0 && (
          <div className="px-8 py-3 bg-gray-50 border-t border-gray-100">
            <p className="text-xs text-gray-500 text-center">
              Exibindo {filteredAnalyses.length} de {analyses.length} análise(s)
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
