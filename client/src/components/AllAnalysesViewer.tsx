import React, { useState, useEffect } from 'react';
import { X, FileText, User, Calendar, Search, RefreshCw } from 'lucide-react';
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
}

export const AllAnalysesViewer: React.FC<AllAnalysesViewerProps> = ({ onClose }) => {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

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

  const filteredAnalyses = analyses.filter(analysis => {
    const search = searchTerm.toLowerCase();
    return (
      analysis.title.toLowerCase().includes(search) ||
      analysis.author.toLowerCase().includes(search) ||
      analysis.createdByUsername?.toLowerCase().includes(search) ||
      analysis.createdByFullName?.toLowerCase().includes(search) ||
      analysis.createdByEmail?.toLowerCase().includes(search)
    );
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Todas as Análises</h2>
              <p className="text-sm text-gray-500">
                Visualização de todas as análises de todos os usuários
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-4 border-b border-gray-200">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por título, autor ou usuário..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button
              onClick={loadAnalyses}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex flex-col items-center gap-3">
                <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
                <p className="text-gray-500">Carregando análises...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <p className="text-red-600 font-medium">{error}</p>
                <button
                  onClick={loadAnalyses}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Tentar novamente
                </button>
              </div>
            </div>
          ) : filteredAnalyses.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-gray-500">
                {searchTerm ? 'Nenhuma análise encontrada para a busca.' : 'Nenhuma análise cadastrada no sistema.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAnalyses.map((analysis) => (
                <div
                  key={analysis.id}
                  className="bg-gray-50 hover:bg-gray-100 rounded-lg p-4 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{analysis.title}</h3>
                      {analysis.description && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                          {analysis.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          <span>Autor: {analysis.author}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>Criado: {formatDate(analysis.createdAt)}</span>
                        </div>
                        {analysis.version && (
                          <span className="text-blue-600">v{analysis.version}</span>
                        )}
                      </div>
                    </div>
                    <div className="ml-4 text-right">
                      <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-medium">
                        {analysis.createdByFullName || analysis.createdByUsername || 'Usuário desconhecido'}
                      </div>
                      {analysis.createdByEmail && (
                        <p className="text-xs text-gray-400 mt-1">{analysis.createdByEmail}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <p className="text-sm text-gray-500 text-center">
            Total: {filteredAnalyses.length} análise(s)
            {searchTerm && analyses.length !== filteredAnalyses.length && ` (de ${analyses.length} no total)`}
          </p>
        </div>
      </div>
    </div>
  );
};
