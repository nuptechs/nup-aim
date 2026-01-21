import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, RefreshCw, FileText, Filter, ChevronRight, ChevronUp, ChevronDown, ChevronsUpDown, Trash2, CheckCircle2, Circle } from 'lucide-react';
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

type SortField = 'title' | 'version' | 'author' | 'createdAt' | 'user';
type SortDirection = 'asc' | 'desc' | null;

export const AllAnalysesViewer: React.FC<AllAnalysesViewerProps> = ({ onClose, onOpenAnalysis }) => {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);

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
        setSelectedIds(new Set());
        setSelectionMode(false);
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

  const uniqueUsers = useMemo(() => {
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

  const filteredAndSortedAnalyses = useMemo(() => {
    let result = analyses.filter(analysis => {
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

    if (sortField && sortDirection) {
      result = [...result].sort((a, b) => {
        let valueA: string | number = '';
        let valueB: string | number = '';

        switch (sortField) {
          case 'title':
            valueA = a.title.toLowerCase();
            valueB = b.title.toLowerCase();
            break;
          case 'version':
            valueA = a.version || '';
            valueB = b.version || '';
            break;
          case 'author':
            valueA = a.author.toLowerCase();
            valueB = b.author.toLowerCase();
            break;
          case 'createdAt':
            valueA = new Date(a.createdAt).getTime();
            valueB = new Date(b.createdAt).getTime();
            break;
          case 'user':
            valueA = (a.createdByFullName || a.createdByUsername || '').toLowerCase();
            valueB = (b.createdByFullName || b.createdByUsername || '').toLowerCase();
            break;
        }

        if (valueA < valueB) return sortDirection === 'asc' ? -1 : 1;
        if (valueA > valueB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [analyses, searchTerm, selectedUser, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortDirection(null);
        setSortField('createdAt');
        setSortDirection('desc');
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field || !sortDirection) {
      return <ChevronsUpDown className="w-3 h-3 text-gray-300" />;
    }
    return sortDirection === 'asc' 
      ? <ChevronUp className="w-3 h-3 text-blue-500" />
      : <ChevronDown className="w-3 h-3 text-blue-500" />;
  };

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
    if (selectionMode) {
      toggleSelection(analysisId);
    } else if (onOpenAnalysis) {
      onOpenAnalysis(analysisId);
      onClose();
    }
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
    
    if (newSelected.size === 0) {
      setSelectionMode(false);
    }
  };

  const handleDeleteSingle = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(id);
  };

  const confirmDelete = async (id: string) => {
    try {
      setIsDeleting(true);
      const token = apiClient.getToken();
      const response = await fetch(`/api/analyses/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setAnalyses(prev => prev.filter(a => a.id !== id));
        setSelectedIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      }
    } catch (err) {
      console.error('Erro ao excluir análise:', err);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(null);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    
    try {
      setIsDeleting(true);
      const token = apiClient.getToken();
      
      const deletePromises = Array.from(selectedIds).map(id =>
        fetch(`/api/analyses/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })
      );

      await Promise.all(deletePromises);
      setAnalyses(prev => prev.filter(a => !selectedIds.has(a.id)));
      setSelectedIds(new Set());
      setSelectionMode(false);
    } catch (err) {
      console.error('Erro ao excluir análises:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const cancelSelection = () => {
    setSelectedIds(new Set());
    setSelectionMode(false);
  };

  const HeaderCell: React.FC<{ field: SortField; children: React.ReactNode; className?: string }> = ({ field, children, className = '' }) => (
    <button
      type="button"
      onClick={() => handleSort(field)}
      className={`flex items-center justify-center gap-1 hover:text-gray-700 transition-colors cursor-pointer select-none ${className}`}
    >
      <span>{children}</span>
      {getSortIcon(field)}
    </button>
  );

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

        {selectionMode && (
          <div className="px-6 py-2.5 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-blue-700">
                {selectedIds.size} selecionada(s)
              </span>
              <button
                onClick={cancelSelection}
                className="text-xs text-blue-600 hover:text-blue-800 underline underline-offset-2"
              >
                Cancelar
              </button>
            </div>
            <button
              onClick={handleDeleteSelected}
              disabled={isDeleting || selectedIds.size === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50 shadow-sm"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Excluir
            </button>
          </div>
        )}

        <div className="hidden md:grid grid-cols-[1fr_70px_140px_150px_160px_32px] gap-4 px-6 py-2.5 bg-gray-50/50 border-b border-gray-100 text-[11px] font-medium text-gray-500 uppercase tracking-wider">
          <HeaderCell field="title">Título</HeaderCell>
          <HeaderCell field="version">Versão</HeaderCell>
          <HeaderCell field="author">Autor</HeaderCell>
          <HeaderCell field="createdAt">Data</HeaderCell>
          <HeaderCell field="user">Usuário</HeaderCell>
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
          ) : filteredAndSortedAnalyses.length === 0 ? (
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
              {filteredAndSortedAnalyses.map((analysis, index) => {
                const isSelected = selectedIds.has(analysis.id);
                
                return (
                  <div
                    key={analysis.id}
                    onClick={() => handleRowClick(analysis.id)}
                    className={`relative w-full grid grid-cols-1 md:grid-cols-[1fr_70px_140px_150px_160px_32px] gap-2 md:gap-4 px-6 py-3.5 items-center transition-all duration-150 group cursor-pointer ${
                      isSelected 
                        ? 'bg-blue-50 border-l-2 border-l-blue-500' 
                        : 'hover:bg-gray-50/80 border-l-2 border-l-transparent'
                    } ${index !== filteredAndSortedAnalyses.length - 1 ? 'border-b border-gray-100' : ''}`}
                  >
                    {selectionMode && (
                      <div className="absolute left-2 top-1/2 -translate-y-1/2">
                        {isSelected ? (
                          <CheckCircle2 className="w-5 h-5 text-blue-500" />
                        ) : (
                          <Circle className="w-5 h-5 text-gray-300 group-hover:text-gray-400" />
                        )}
                      </div>
                    )}

                    <div className={`flex items-center gap-2 min-w-0 text-left ${selectionMode ? 'pl-6' : ''}`}>
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
                    
                    <div className="hidden md:block text-[13px] text-gray-500 truncate text-center" title={analysis.author}>
                      {analysis.author || '—'}
                    </div>
                    
                    <div className="hidden md:block text-[13px] text-gray-400 text-center font-mono tabular-nums">
                      {formatDate(analysis.createdAt)}
                    </div>
                    
                    <div className="hidden md:flex justify-center">
                      <span 
                        className="inline-block max-w-[150px] px-2.5 py-1 bg-gray-100 text-gray-600 text-[11px] font-medium rounded-full truncate"
                        title={analysis.createdByEmail || undefined}
                      >
                        {analysis.createdByFullName || analysis.createdByUsername || 'Desconhecido'}
                      </span>
                    </div>
                    
                    <div className="hidden md:flex justify-center items-center">
                      {!selectionMode && (
                        <>
                          {showDeleteConfirm === analysis.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => { e.stopPropagation(); confirmDelete(analysis.id); }}
                                disabled={isDeleting}
                                className="p-1 bg-red-100 hover:bg-red-200 rounded text-red-600 transition-colors"
                                title="Confirmar"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(null); }}
                                className="p-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-500 transition-colors"
                                title="Cancelar"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-0.5">
                              <button
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  setSelectionMode(true);
                                  toggleSelection(analysis.id);
                                }}
                                className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-blue-50 rounded text-gray-300 hover:text-blue-500 transition-all"
                                title="Selecionar para exclusão em lote"
                              >
                                <Circle className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => handleDeleteSingle(analysis.id, e)}
                                className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-50 rounded text-gray-300 hover:text-red-500 transition-all"
                                title="Excluir"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    <div className="md:hidden flex items-center justify-between text-[12px] text-gray-400 mt-1">
                      <div className="flex items-center gap-3">
                        <span>{analysis.author || '—'}</span>
                        <span>•</span>
                        <span className="font-mono tabular-nums">{formatDate(analysis.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-medium rounded-full">
                          {analysis.createdByFullName || analysis.createdByUsername || '?'}
                        </span>
                        {!selectionMode && (
                          <button
                            onClick={(e) => handleDeleteSingle(analysis.id, e)}
                            className="p-1 hover:bg-red-50 rounded text-gray-300 hover:text-red-500 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {filteredAndSortedAnalyses.length > 0 && (
          <div className="px-6 py-2.5 bg-gray-50 border-t border-gray-100">
            <p className="text-[11px] text-gray-400 text-center">
              {filteredAndSortedAnalyses.length === analyses.length 
                ? `${filteredAndSortedAnalyses.length} análise(s)` 
                : `${filteredAndSortedAnalyses.length} de ${analyses.length} análise(s)`
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
