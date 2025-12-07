import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileText, Plus, Upload, Copy, Trash2, 
  CheckCircle, AlertCircle, Clock, Search,
  Download, Settings, Star, StarOff, MoreVertical,
  FileUp, Layers
} from 'lucide-react';
import { apiClient } from '../lib/apiClient';
import { Card, CardContent } from './ui/Card';
import { Badge } from './ui/Badge';
import { SkeletonLoader } from './ui/LoadingSpinner';
import { TemplateUpload } from './TemplateUpload';
import { TemplateFieldMapper } from './TemplateFieldMapper';

interface Template {
  id: string;
  name: string;
  description?: string;
  originalFileName: string;
  parsedMarkers: ParsedMarker[];
  fieldMappings: Record<string, string>;
  isActive: boolean;
  isDefault: boolean;
  usageCount: string;
  createdAt: string;
  updatedAt: string;
}

interface ParsedMarker {
  marker: string;
  fieldName: string;
  context: string;
  position: number;
}

type ViewMode = 'list' | 'upload' | 'mapper';

interface TemplateManagerProps {
  onClose?: () => void;
}

export const TemplateManager: React.FC<TemplateManagerProps> = ({ onClose: _onClose }) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState<boolean | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchTemplates = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get('/api/templates');
      if (response.success) {
        setTemplates(response.templates);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
      showToast('Erro ao carregar templates', 'error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleDelete = async (id: string) => {
    try {
      const response = await apiClient.delete(`/api/templates/${id}`);
      if (response.success) {
        setTemplates(templates.filter(t => t.id !== id));
        showToast('Template excluído com sucesso', 'success');
      }
    } catch (error) {
      showToast('Erro ao excluir template', 'error');
    }
    setShowDeleteConfirm(null);
  };

  const handleDuplicate = async (template: Template) => {
    try {
      const response = await apiClient.post(`/api/templates/${template.id}/duplicate`, {
        name: `${template.name} (Cópia)`
      });
      if (response.success) {
        setTemplates([response.template, ...templates]);
        showToast('Template duplicado com sucesso', 'success');
      }
    } catch (error) {
      showToast('Erro ao duplicar template', 'error');
    }
  };

  const handleSetDefault = async (template: Template) => {
    try {
      const response = await apiClient.put(`/api/templates/${template.id}`, {
        isDefault: !template.isDefault
      });
      if (response.success) {
        setTemplates(templates.map(t => ({
          ...t,
          isDefault: t.id === template.id ? !t.isDefault : false
        })));
        showToast(
          template.isDefault ? 'Template removido como padrão' : 'Template definido como padrão',
          'success'
        );
      }
    } catch (error) {
      showToast('Erro ao atualizar template', 'error');
    }
  };

  const handleToggleActive = async (template: Template) => {
    try {
      const response = await apiClient.put(`/api/templates/${template.id}`, {
        isActive: !template.isActive
      });
      if (response.success) {
        setTemplates(templates.map(t => 
          t.id === template.id ? { ...t, isActive: !t.isActive } : t
        ));
        showToast(
          template.isActive ? 'Template desativado' : 'Template ativado',
          'success'
        );
      }
    } catch (error) {
      showToast('Erro ao atualizar template', 'error');
    }
  };

  const handleUploadComplete = (newTemplate: Template) => {
    setTemplates([newTemplate, ...templates]);
    setSelectedTemplate(newTemplate);
    setViewMode('mapper');
    showToast(`Template criado! ${newTemplate.parsedMarkers.length} marcadores encontrados.`, 'success');
  };

  const handleMappingComplete = (updatedTemplate: Template) => {
    setTemplates(templates.map(t => 
      t.id === updatedTemplate.id ? updatedTemplate : t
    ));
    setViewMode('list');
    setSelectedTemplate(null);
    showToast('Mapeamento salvo com sucesso', 'success');
  };

  const filteredTemplates = templates.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterActive === null || t.isActive === filterActive;
    return matchesSearch && matchesFilter;
  });

  const getMappingStatus = (template: Template) => {
    const totalMarkers = template.parsedMarkers.length;
    const mappedMarkers = Object.keys(template.fieldMappings).length;
    
    if (totalMarkers === 0) return { status: 'empty', label: 'Sem marcadores', color: 'gray' };
    if (mappedMarkers === 0) return { status: 'pending', label: 'Não configurado', color: 'red' };
    if (mappedMarkers < totalMarkers) return { status: 'partial', label: `${mappedMarkers}/${totalMarkers} mapeados`, color: 'yellow' };
    return { status: 'complete', label: 'Configurado', color: 'green' };
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  if (viewMode === 'upload') {
    return (
      <TemplateUpload
        onComplete={handleUploadComplete}
        onCancel={() => setViewMode('list')}
      />
    );
  }

  if (viewMode === 'mapper' && selectedTemplate) {
    return (
      <TemplateFieldMapper
        template={selectedTemplate}
        onSave={handleMappingComplete}
        onCancel={() => {
          setViewMode('list');
          setSelectedTemplate(null);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in ${
          toast.type === 'success' 
            ? 'bg-green-500 text-white' 
            : 'bg-red-500 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {toast.message}
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-xl">
                <Layers className="w-8 h-8 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  Modelos de Documento
                </h1>
                <p className="text-gray-500 dark:text-gray-400">
                  Gerencie templates personalizados para exportação de análises
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={() => setViewMode('upload')}
            className="flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            <Plus className="w-5 h-5" />
            Novo Modelo
          </button>
        </div>

        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar templates..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setFilterActive(filterActive === true ? null : true)}
                  className={`px-4 py-2.5 rounded-xl border transition-all flex items-center gap-2 ${
                    filterActive === true
                      ? 'bg-green-100 border-green-300 text-green-700 dark:bg-green-900/30 dark:border-green-700 dark:text-green-400'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <CheckCircle className="w-4 h-4" />
                  Ativos
                </button>
                <button
                  onClick={() => setFilterActive(filterActive === false ? null : false)}
                  className={`px-4 py-2.5 rounded-xl border transition-all flex items-center gap-2 ${
                    filterActive === false
                      ? 'bg-gray-200 border-gray-400 text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <AlertCircle className="w-4 h-4" />
                  Inativos
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="p-6">
                <SkeletonLoader height={24} width="70%" className="mb-3" />
                <SkeletonLoader height={16} width="100%" className="mb-2" />
                <SkeletonLoader height={16} width="60%" className="mb-4" />
                <div className="flex gap-2">
                  <SkeletonLoader height={28} width={80} />
                  <SkeletonLoader height={28} width={80} />
                </div>
              </Card>
            ))}
          </div>
        ) : filteredTemplates.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="flex flex-col items-center">
              <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
                <FileText className="w-12 h-12 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                {searchTerm || filterActive !== null ? 'Nenhum template encontrado' : 'Nenhum template criado'}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md">
                {searchTerm || filterActive !== null 
                  ? 'Tente ajustar os filtros ou termo de busca'
                  : 'Crie seu primeiro template para exportar análises de impacto com seu layout personalizado'}
              </p>
              {!searchTerm && filterActive === null && (
                <button
                  onClick={() => setViewMode('upload')}
                  className="flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium transition-all"
                >
                  <Upload className="w-5 h-5" />
                  Fazer Upload do Primeiro Template
                </button>
              )}
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map((template) => {
              const mappingStatus = getMappingStatus(template);
              
              return (
                <Card 
                  key={template.id} 
                  className={`group hover:shadow-xl transition-all duration-300 ${
                    !template.isActive ? 'opacity-60' : ''
                  } ${template.isDefault ? 'ring-2 ring-primary-500' : ''}`}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${
                          template.isDefault 
                            ? 'bg-primary-100 dark:bg-primary-900/30' 
                            : 'bg-gray-100 dark:bg-gray-800'
                        }`}>
                          <FileText className={`w-6 h-6 ${
                            template.isDefault 
                              ? 'text-primary-600 dark:text-primary-400' 
                              : 'text-gray-500 dark:text-gray-400'
                          }`} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                            {template.name}
                            {template.isDefault && (
                              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                            )}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[180px]">
                            {template.originalFileName}
                          </p>
                        </div>
                      </div>
                      
                      <div className="relative">
                        <button
                          onClick={() => setShowDeleteConfirm(showDeleteConfirm === template.id ? null : template.id)}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                        >
                          <MoreVertical className="w-5 h-5 text-gray-500" />
                        </button>
                        
                        {showDeleteConfirm === template.id && (
                          <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-2 z-10">
                            <button
                              onClick={() => {
                                setSelectedTemplate(template);
                                setViewMode('mapper');
                                setShowDeleteConfirm(null);
                              }}
                              className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-300"
                            >
                              <Settings className="w-4 h-4" />
                              Configurar Campos
                            </button>
                            <button
                              onClick={() => {
                                handleSetDefault(template);
                                setShowDeleteConfirm(null);
                              }}
                              className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-300"
                            >
                              {template.isDefault ? <StarOff className="w-4 h-4" /> : <Star className="w-4 h-4" />}
                              {template.isDefault ? 'Remover Padrão' : 'Definir como Padrão'}
                            </button>
                            <button
                              onClick={() => {
                                handleDuplicate(template);
                                setShowDeleteConfirm(null);
                              }}
                              className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-300"
                            >
                              <Copy className="w-4 h-4" />
                              Duplicar
                            </button>
                            <button
                              onClick={() => {
                                handleToggleActive(template);
                                setShowDeleteConfirm(null);
                              }}
                              className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-300"
                            >
                              {template.isActive ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                              {template.isActive ? 'Desativar' : 'Ativar'}
                            </button>
                            <hr className="my-2 border-gray-200 dark:border-gray-700" />
                            <button
                              onClick={() => handleDelete(template.id)}
                              className="w-full px-4 py-2 text-left hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 text-red-600 dark:text-red-400"
                            >
                              <Trash2 className="w-4 h-4" />
                              Excluir
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {template.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                        {template.description}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2 mb-4">
                      <Badge variant={mappingStatus.color as any} className="flex items-center gap-1">
                        {mappingStatus.status === 'complete' && <CheckCircle className="w-3 h-3" />}
                        {mappingStatus.status === 'pending' && <AlertCircle className="w-3 h-3" />}
                        {mappingStatus.status === 'partial' && <Clock className="w-3 h-3" />}
                        {mappingStatus.label}
                      </Badge>
                      <Badge variant="secondary">
                        {template.parsedMarkers.length} marcadores
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-4">
                      <span className="flex items-center gap-1">
                        <Download className="w-4 h-4" />
                        {template.usageCount} usos
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {formatDate(template.updatedAt)}
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedTemplate(template);
                        setViewMode('mapper');
                      }}
                      className="w-full py-2.5 bg-primary-50 hover:bg-primary-100 dark:bg-primary-900/20 dark:hover:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-xl font-medium transition-all flex items-center justify-center gap-2"
                    >
                      <Settings className="w-4 h-4" />
                      Configurar Mapeamento
                    </button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Card className="mt-8 bg-gradient-to-r from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20 border-primary-200 dark:border-primary-800">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-primary-100 dark:bg-primary-900/40 rounded-xl">
                <FileUp className="w-6 h-6 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                  Como funcionam os templates?
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  1. Faça upload de um documento Word (.docx) com marcadores no formato <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">#$campo#$</code>
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  2. O sistema identificará automaticamente todos os marcadores no documento
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  3. Mapeie cada marcador para um campo do banco de dados e use o template para gerar documentos
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TemplateManager;
