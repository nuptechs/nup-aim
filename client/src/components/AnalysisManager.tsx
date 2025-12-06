import React, { useState, useEffect } from 'react';
import { FileText, Edit, Trash2, Plus, Search, Calendar, User, Copy, Database, HardDrive, Loader2 } from 'lucide-react';
import { ImpactAnalysis } from '../types';
import { getStoredAnalyses, deleteAnalysis } from '../utils/storage';
import { CopyAnalysisModal } from './CopyAnalysisModal';
import { useAuth } from '../contexts/ApiAuthContext';
import apiClient from '../lib/apiClient';

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
  const [isLoading, setIsLoading] = useState(false);
  const [dataSource, setDataSource] = useState<'local' | 'database' | 'both'>('both');

  useEffect(() => {
    loadAnalyses();
  }, []);

  const loadAnalyses = async () => {
    setIsLoading(true);
    try {
      // Load from localStorage first (always available)
      const localAnalyses = getStoredAnalyses();
      
      // Try to load from database
      let dbAnalyses: ImpactAnalysis[] = [];
      try {
        const response = await apiClient.getAnalyses();
        if (response.success && response.data) {
          // Convert database format to local format, including full data from JSONB field
          dbAnalyses = response.data.map((dbAnalysis: any) => {
            const storedData = dbAnalysis.data || {};
            return {
              id: dbAnalysis.id,
              dbId: dbAnalysis.id,
              title: dbAnalysis.title || '',
              description: dbAnalysis.description || '',
              author: dbAnalysis.author || '',
              date: storedData.date || (dbAnalysis.createdAt ? new Date(dbAnalysis.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
              version: storedData.version || dbAnalysis.version || '1.0',
              project: storedData.project || '',
              scope: storedData.scope || { processes: [] },
              impacts: storedData.impacts || { business: [], technical: [], operational: [], financial: [] },
              risks: storedData.risks || [],
              mitigations: storedData.mitigations || [],
              conclusions: storedData.conclusions || { summary: '', recommendations: [], nextSteps: [] },
              customFieldsValues: storedData.customFieldsValues || {},
              fromDatabase: true
            };
          });
          console.log(`✅ Carregadas ${dbAnalyses.length} análises do banco de dados`);
        }
      } catch (dbError) {
        console.warn('⚠️ Não foi possível carregar análises do banco:', dbError);
      }
      
      // Merge analyses (database + local, avoiding duplicates by dbId)
      const dbIds = new Set(dbAnalyses.map(a => a.id));
      // Include local analyses that don't have a dbId or whose dbId isn't in the database results
      const uniqueLocalAnalyses = localAnalyses.filter(a => {
        const localDbId = (a as any).dbId;
        if (!localDbId) return true; // Local-only analysis without database backup
        return !dbIds.has(localDbId); // Not already in database results
      });
      
      // Put database analyses first, then local ones
      const mergedAnalyses = [...dbAnalyses, ...uniqueLocalAnalyses];
      
      setAnalyses(mergedAnalyses);
      setDataSource(dbAnalyses.length > 0 ? (uniqueLocalAnalyses.length > 0 ? 'both' : 'database') : 'local');
    } catch (error) {
      console.error('Erro ao carregar análises:', error);
      // Fallback to localStorage only
      const localAnalyses = getStoredAnalyses();
      setAnalyses(localAnalyses);
      setDataSource('local');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (analysis: ImpactAnalysis) => {
    if (!hasPermission('ANALYSIS', 'DELETE')) {
      alert('Você não tem permissão para excluir análises.');
      return;
    }

    if (window.confirm('Tem certeza que deseja excluir esta análise?')) {
      try {
        // Delete from localStorage
        deleteAnalysis(analysis.id);
        
        // Also delete from database if it has a dbId
        const dbId = (analysis as any).dbId;
        if (dbId) {
          try {
            const response = await apiClient.deleteAnalysis(dbId);
            if (response.success) {
              console.log('✅ Análise excluída do banco de dados');
            } else {
              console.warn('⚠️ Falha ao excluir do banco:', response.error);
            }
          } catch (dbError) {
            console.warn('⚠️ Erro ao excluir do banco de dados:', dbError);
          }
        }
        
        loadAnalyses();
      } catch (error) {
        console.error('Erro ao excluir análise:', error);
        alert('Erro ao excluir a análise.');
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

  const handleEditAnalysis = (analysis: ImpactAnalysis) => {
    if (!hasPermission('ANALYSIS', 'EDIT') && !hasPermission('ANALYSIS', 'VIEW')) {
      alert('Você não tem permissão para acessar esta análise.');
      return;
    }

    onLoadAnalysis(analysis);
    onClose();
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

            {/* Data Source Indicator */}
            <div className="flex items-center gap-2 mb-4 text-xs text-gray-500">
              {isLoading ? (
                <span className="flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Carregando análises...
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  {dataSource === 'database' && (
                    <>
                      <Database className="w-3 h-3 text-green-500" />
                      <span>Dados do banco de dados</span>
                    </>
                  )}
                  {dataSource === 'local' && (
                    <>
                      <HardDrive className="w-3 h-3 text-yellow-500" />
                      <span>Dados locais (localStorage)</span>
                    </>
                  )}
                  {dataSource === 'both' && (
                    <>
                      <Database className="w-3 h-3 text-green-500" />
                      <span className="mx-1">+</span>
                      <HardDrive className="w-3 h-3 text-yellow-500" />
                      <span>Banco de dados + Local</span>
                    </>
                  )}
                  <span className="ml-2">({analyses.length} análise{analyses.length !== 1 ? 's' : ''})</span>
                </span>
              )}
            </div>

            {/* Analysis Grid */}
            <div className="overflow-auto max-h-[60vh]">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
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
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-white"
                    >
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
                              onClick={() => handleDelete(analysis)}
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
                            {analysis.scope.processes.length} processo(s)
                          </span>
                          <span>
                            {analysis.risks.length} risco(s)
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