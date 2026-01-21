import React, { useState, useEffect } from 'react';
import { X, Search, RefreshCw, FileText, Filter, ChevronRight } from 'lucide-react';
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

  const handleRowClick = (analysisId: string) => {
    if (onOpenAnalysis) {
      onOpenAnalysis(analysisId);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden">
        
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Todas as Análises</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {analyses.length} análise(s) • {uniqueUsers.length} usuário(s)
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="px-6 py-3 bg-gray-50/80 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por título, autor ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all placeholder:text-gray-400"
              />
            </div>
            
            <div className="flex gap-2">
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className="pl-9 pr-6 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 appearance-none cursor-pointer min-w-[160px]"
                >
                  <option value="all">Todos</option>
                  {uniqueUsers.map(user => (
                    <option key={user.id} value={user.id}>{user.name}</option>
                  ))}
                </select>
              </div>
              
              <button
                onClick={loadAnalyses}
                disabled={isLoading}
                className="p-2 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
                title="Atualizar"
              >
                <RefreshCw className={`w-4 h-4 text-gray-500 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        <div className="hidden md:grid grid-cols-[1fr_60px_140px_150px_160px_24px] gap-4 px-6 py-2 bg-gray-50/50 border-b border-gray-100 text-[11px] font-medium text-gray-500 uppercase tracking-wider">
          <div>Título</div>
          <div className="text-center">Versão</div>
          <div>Autor</div>
          <div className="text-right">Data</div>
          <div className="text-right">Usuário</div>
          <div></div>
        </div>

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-400 text-sm">Carregando...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center">
                <X className="w-6 h-6 text-red-400" />
              </div>
              <p className="text-gray-600 text-sm">{error}</p>
              <button
                onClick={loadAnalyses}
                className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
              >
                Tentar novamente
              </button>
            </div>
          ) : filteredAnalyses.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                <FileText className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-gray-500 text-sm">
                {searchTerm || selectedUser !== 'all' ? 'Nenhuma análise encontrada' : 'Nenhuma análise cadastrada'}
              </p>
            </div>
          ) : (
            <div>
              {filteredAnalyses.map((analysis, index) => (
                <button
                  key={analysis.id}
                  type="button"
                  onClick={() => handleRowClick(analysis.id)}
                  disabled={!onOpenAnalysis}
                  className={`w-full text-left grid grid-cols-1 md:grid-cols-[1fr_60px_140px_150px_160px_24px] gap-2 md:gap-4 px-6 py-3.5 items-center transition-all duration-150 group ${
                    onOpenAnalysis 
                      ? 'hover:bg-blue-50/50 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-inset' 
                      : 'cursor-default'
                  } ${index !== filteredAnalyses.length - 1 ? 'border-b border-gray-100' : ''}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[14px] font-semibold text-gray-900 truncate">
                      {analysis.title || 'Sem título'}
                    </span>
                    <span className="md:hidden flex-shrink-0 px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-medium rounded">
                      v{analysis.version || '1.0'}
                    </span>
                  </div>
                  
                  <div className="hidden md:flex justify-center">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[11px] font-medium rounded">
                      v{analysis.version || '1.0'}
                    </span>
                  </div>
                  
                  <div className="hidden md:block text-[13px] text-gray-500 truncate" title={analysis.author}>
                    {analysis.author || '—'}
                  </div>
                  
                  <div className="hidden md:block text-[13px] text-gray-400 text-right font-mono tabular-nums">
                    {formatDate(analysis.createdAt)}
                  </div>
                  
                  <div className="hidden md:flex justify-end">
                    <span 
                      className="inline-block max-w-[150px] px-2.5 py-1 bg-gray-100 text-gray-600 text-[11px] font-medium rounded-full truncate"
                      title={analysis.createdByEmail || undefined}
                    >
                      {analysis.createdByFullName || analysis.createdByUsername || 'Desconhecido'}
                    </span>
                  </div>
                  
                  <div className="hidden md:flex justify-center">
                    {onOpenAnalysis && (
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
                    )}
                  </div>

                  <div className="md:hidden flex items-center justify-between text-[12px] text-gray-400 mt-1">
                    <div className="flex items-center gap-3">
                      <span>{analysis.author || '—'}</span>
                      <span>•</span>
                      <span className="font-mono tabular-nums">{formatDate(analysis.createdAt)}</span>
                    </div>
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-medium rounded-full">
                      {analysis.createdByFullName || analysis.createdByUsername || '?'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {filteredAnalyses.length > 0 && (
          <div className="px-6 py-2.5 bg-gray-50 border-t border-gray-100">
            <p className="text-[11px] text-gray-400 text-center">
              {filteredAnalyses.length === analyses.length 
                ? `${filteredAnalyses.length} análise(s)` 
                : `${filteredAnalyses.length} de ${analyses.length} análise(s)`
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
