import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Edit, Trash2, Plus, Search, Calendar, User, Copy, Loader2, RefreshCw } from 'lucide-react';
import { ImpactAnalysis } from '../types';
import { getStoredAnalyses, deleteAnalysis } from '../utils/storage';
import { CopyAnalysisModal } from './CopyAnalysisModal';
import { useAuth } from '../contexts/ApiAuthContext';
import { LoadingSpinner, ContentLoader } from './ui/LoadingOverlay';

interface AnalysisManagerProps {
  onLoadAnalysis: (analysis: ImpactAnalysis) => void;
  onNewAnalysis: () => void;
  onClose: () => void;
}

export const AnalysisManager: React.FC<AnalysisManagerProps> = ({
  onLoadAnalysis,
  onNewAnalysis,
  onClose
}) => {
  const { hasPermission } = useAuth();
  const [analyses, setAnalyses] = useState<ImpactAnalysis[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'project'>('date');
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [selectedAnalysisForCopy, setSelectedAnalysisForCopy] = useState<ImpactAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingItemId, setLoadingItemId] = useState<string | null>(null);

  const loadAnalyses = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    try {
      const stored = await getStoredAnalyses(forceRefresh);
      setAnalyses(stored);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAnalyses();
  }, [loadAnalyses]);

  const handleDelete = async (id: string) => {
    if (!hasPermission('ANALYSIS', 'DELETE')) {
      alert('Você não tem permissão para excluir análises.');
      return;
    }

    if (window.confirm('Tem certeza que deseja excluir esta análise?')) {
      setLoadingItemId(id);
      const removedItem = analyses.find(a => a.id === id);
      const originalIndex = analyses.findIndex(a => a.id === id);
      setAnalyses(prev => prev.filter(a => a.id !== id));
      try {
        await deleteAnalysis(id);
      } catch {
        if (removedItem) {
          setAnalyses(prev => {
            const newList = [...prev];
            newList.splice(originalIndex, 0, removedItem);
            return newList;
          });
          alert('Erro ao excluir análise. Tente novamente.');
        }
      } finally {
        setLoadingItemId(null);
      }
    }
  };

  const handleCopyAnalysis = (analysis: ImpactAnalysis) => {
    if (!hasPermission('ANALYSIS', 'COPY')) {
      alert('Você não tem permissão para copiar análises.');
      return;
    }

    setSelectedAnalysisForCopy(analysis);
    setShowCopyModal(true);
  };

  const handleCopyComplete = (newAnalysis: ImpactAnalysis) => {
    onLoadAnalysis(newAnalysis);
    onClose();
  };

  const handleNewAnalysis = () => {
    onNewAnalysis();
    onClose();
  };

  const handleEditAnalysis = async (analysis: ImpactAnalysis) => {
    if (!hasPermission('ANALYSIS', 'EDIT') && !hasPermission('ANALYSIS', 'VIEW')) {
      alert('Você não tem permissão para acessar esta análise.');
      return;
    }

    setLoadingItemId(analysis.id);
    try {
      onLoadAnalysis(analysis);
      onClose();
    } finally {
      setLoadingItemId(null);
    }
  };

  const filteredAnalyses = analyses
    .filter(analysis => 
      analysis.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      analysis.project.toLowerCase().includes(searchTerm.toLowerCase()) ||
      analysis.author.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        case 'title':
          return a.title.localeCompare(b.title);
        case 'project':
          return a.project.localeCompare(b.project);
        default:
          return 0;
      }
    });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const canCreate = hasPermission('ANALYSIS', 'CREATE');
  const canCopy = hasPermission('ANALYSIS', 'COPY');
  const canEdit = hasPermission('ANALYSIS', 'EDIT') || hasPermission('ANALYSIS', 'VIEW');
  const canDelete = hasPermission('ANALYSIS', 'DELETE');

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">Gerenciar Análises de Impacto</h2>
            </div>
            <div className="flex items-center gap-2">
              {canCreate && (
                <button
                  onClick={handleNewAnalysis}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Análise
                </button>
              )}
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="p-6">
            {/* Search and Filter */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Buscar por número da PA, projeto ou autor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <button
                onClick={() => loadAnalyses(true)}
                disabled={isRefreshing}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                title="Atualizar lista"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="date">Ordenar por Data</option>
                <option value="title">Ordenar por Número da PA</option>
                <option value="project">Ordenar por Projeto</option>
              </select>
            </div>

            {/* Analysis Grid */}
            <div className="overflow-auto max-h-[60vh]">
              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="border border-gray-200 rounded-lg p-4 bg-white animate-pulse">
                      <div className="h-5 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                      <div className="flex gap-2 mb-3">
                        <div className="h-3 bg-gray-200 rounded w-24"></div>
                        <div className="h-3 bg-gray-200 rounded w-20"></div>
                      </div>
                      <div className="flex gap-2">
                        <div className="h-8 bg-gray-200 rounded w-16"></div>
                        <div className="h-8 bg-gray-200 rounded w-16"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredAnalyses.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {searchTerm ? 'Nenhuma análise encontrada' : 'Nenhuma análise salva'}
                  </h3>
                  <p className="text-gray-500 mb-4">
                    {searchTerm 
                      ? 'Tente ajustar os termos de busca'
                      : 'Comece criando sua primeira análise de impacto'
                    }
                  </p>
                  {!searchTerm && (
                    <div className="flex items-center justify-center gap-3">
                      {canCreate && (
                        <button
                          onClick={handleNewAnalysis}
                          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Criar Nova Análise
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredAnalyses.map((analysis) => (
                    <div
                      key={analysis.id}
                      className={`border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all bg-white relative ${loadingItemId === analysis.id ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                      {loadingItemId === analysis.id && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/50 rounded-lg">
                          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                        </div>
                      )}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900 truncate">
                            {analysis.title || 'Sem título'}
                          </h3>
                          <p className="text-sm text-gray-600 truncate">
                            {analysis.project || 'Sem projeto'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                          {canCopy && (
                            <button
                              onClick={() => handleCopyAnalysis(analysis)}
                              className="p-1 text-green-600 hover:text-green-800 transition-colors"
                              title="Copiar análise"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          )}
                          {canEdit && (
                            <button
                              onClick={() => handleEditAnalysis(analysis)}
                              className="p-1 text-blue-600 hover:text-blue-800 transition-colors"
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(analysis.id)}
                              className="p-1 text-red-600 hover:text-red-800 transition-colors"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{analysis.author || 'Sem autor'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 flex-shrink-0" />
                          <span>{formatDate(analysis.date)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <FileText className="w-3 h-3 flex-shrink-0" />
                          <span>v{analysis.version}</span>
                        </div>
                      </div>

                      {analysis.description && (
                        <p className="text-xs text-gray-600 mt-2 line-clamp-2 break-words">
                          {analysis.description}
                        </p>
                      )}

                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>
                            {analysis.scope?.processes?.length || 0} processo(s)
                          </span>
                          <span>
                            {analysis.risks?.length || 0} risco(s)
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Copy Analysis Modal */}
      {showCopyModal && selectedAnalysisForCopy && (
        <CopyAnalysisModal
          sourceAnalysis={selectedAnalysisForCopy}
          onComplete={handleCopyComplete}
          onClose={() => {
            setShowCopyModal(false);
            setSelectedAnalysisForCopy(null);
          }}
        />
      )}
    </>
  );
};