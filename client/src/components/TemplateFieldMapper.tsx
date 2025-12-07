import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, Save, CheckCircle, AlertCircle, Search, 
  Info, ChevronDown, ChevronRight, FileText, Folder,
  AlertTriangle, Shield, CheckCircle2, Layers, User,
  Clock, Hash, Loader2, X
} from 'lucide-react';
import { apiClient } from '../lib/apiClient';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { Badge } from './ui/Badge';

interface ParsedMarker {
  marker: string;
  fieldName: string;
  context: string;
  position: number;
}

interface FieldDefinition {
  id: string;
  name: string;
  label: string;
  table: string;
  tableLabel: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'json' | 'list';
  description?: string;
}

interface FieldCategory {
  id: string;
  label: string;
  icon: string;
  fields: FieldDefinition[];
}

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

interface TemplateFieldMapperProps {
  template: Template;
  onSave: (template: Template) => void;
  onCancel: () => void;
}

const iconMap: Record<string, React.FC<{ className?: string }>> = {
  FileText,
  Folder,
  AlertTriangle,
  Shield,
  CheckCircle: CheckCircle2,
  Layers,
  User,
  Info
};

export const TemplateFieldMapper: React.FC<TemplateFieldMapperProps> = ({ 
  template, 
  onSave, 
  onCancel 
}) => {
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>(
    template.fieldMappings || {}
  );
  const [availableFields, setAvailableFields] = useState<FieldCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [selectedMarker, setSelectedMarker] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFields = async () => {
      try {
        const response = await apiClient.get('/api/templates/available-fields');
        if (response.success) {
          setAvailableFields(response.fields);
          setExpandedCategories(new Set(response.fields.map((c: FieldCategory) => c.id)));
        }
      } catch (err) {
        console.error('Error fetching fields:', err);
        setError('Erro ao carregar campos disponíveis');
      } finally {
        setIsLoading(false);
      }
    };

    fetchFields();
  }, []);

  const mappingStats = useMemo(() => {
    const total = template.parsedMarkers.length;
    const mapped = Object.keys(fieldMappings).filter(
      marker => fieldMappings[marker] && fieldMappings[marker] !== ''
    ).length;
    const unmapped = total - mapped;
    const percentage = total > 0 ? Math.round((mapped / total) * 100) : 0;
    
    return { total, mapped, unmapped, percentage };
  }, [template.parsedMarkers, fieldMappings]);

  const filteredFields = useMemo(() => {
    if (!searchTerm) return availableFields;
    
    const term = searchTerm.toLowerCase();
    return availableFields.map(category => ({
      ...category,
      fields: category.fields.filter(
        field => 
          field.label.toLowerCase().includes(term) ||
          field.id.toLowerCase().includes(term) ||
          field.tableLabel.toLowerCase().includes(term)
      )
    })).filter(category => category.fields.length > 0);
  }, [availableFields, searchTerm]);

  const handleMappingChange = (markerName: string, fieldId: string) => {
    setFieldMappings(prev => ({
      ...prev,
      [markerName]: fieldId
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const response = await apiClient.put(`/api/templates/${template.id}`, {
        fieldMappings
      });

      if (response.success) {
        onSave({
          ...template,
          fieldMappings,
          updatedAt: new Date().toISOString()
        });
      } else {
        setError(response.error || 'Erro ao salvar mapeamento');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar mapeamento');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const getFieldById = (fieldId: string): FieldDefinition | undefined => {
    for (const category of availableFields) {
      const field = category.fields.find(f => f.id === fieldId);
      if (field) return field;
    }
    return undefined;
  };

  const getFieldTypeIcon = (type: string) => {
    switch (type) {
      case 'text': return <FileText className="w-4 h-4" />;
      case 'number': return <Hash className="w-4 h-4" />;
      case 'date': return <Clock className="w-4 h-4" />;
      case 'list': return <Layers className="w-4 h-4" />;
      default: return <Info className="w-4 h-4" />;
    }
  };

  const getFieldTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      text: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      number: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      date: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      list: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      json: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400'
    };
    
    const labels: Record<string, string> = {
      text: 'Texto',
      number: 'Número',
      date: 'Data',
      list: 'Lista',
      json: 'JSON'
    };

    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[type] || colors.text}`}>
        {labels[type] || type}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-primary-600 animate-spin" />
          <p className="text-gray-600 dark:text-gray-400">Carregando campos disponíveis...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        <button
          onClick={onCancel}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Voltar para lista de templates
        </button>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-xl">
              <Layers className="w-8 h-8 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {template.name}
              </h1>
              <p className="text-gray-500 dark:text-gray-400">
                Mapeie os marcadores do documento para campos do sistema
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {mappingStats.percentage}%
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {mappingStats.mapped} de {mappingStats.total} mapeados
              </div>
            </div>
            <div className="w-32 h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all ${
                  mappingStats.percentage === 100 
                    ? 'bg-green-500' 
                    : mappingStats.percentage > 50 
                    ? 'bg-yellow-500' 
                    : 'bg-red-500'
                }`}
                style={{ width: `${mappingStats.percentage}%` }}
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
            <button onClick={() => setError(null)} className="ml-auto">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary-600" />
                    Marcadores Encontrados
                  </CardTitle>
                  <div className="flex gap-2">
                    <Badge variant={mappingStats.unmapped > 0 ? 'danger' : 'success'}>
                      {mappingStats.unmapped > 0 
                        ? `${mappingStats.unmapped} pendentes`
                        : 'Todos mapeados'
                      }
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {template.parsedMarkers.length === 0 ? (
                  <div className="p-8 text-center">
                    <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Nenhum marcador encontrado
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400">
                      O documento não contém marcadores no formato #$campo#$
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {template.parsedMarkers.map((marker, index) => {
                      const mappedField = getFieldById(fieldMappings[marker.fieldName]);
                      const isMapped = !!mappedField;
                      
                      return (
                        <div 
                          key={index}
                          className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                            selectedMarker === marker.fieldName ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                          }`}
                          onClick={() => setSelectedMarker(marker.fieldName)}
                        >
                          <div className="flex items-start gap-4">
                            <div className={`p-2 rounded-lg flex-shrink-0 ${
                              isMapped 
                                ? 'bg-green-100 dark:bg-green-900/30' 
                                : 'bg-yellow-100 dark:bg-yellow-900/30'
                            }`}>
                              {isMapped 
                                ? <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                                : <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                              }
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <code className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm font-mono text-primary-600 dark:text-primary-400">
                                  {marker.marker}
                                </code>
                                {mappedField && (
                                  <span className="text-sm text-gray-500">
                                    → {mappedField.label}
                                  </span>
                                )}
                              </div>
                              
                              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                Contexto: "{marker.context}"
                              </p>
                              
                              <div className="mt-3">
                                <select
                                  value={fieldMappings[marker.fieldName] || ''}
                                  onChange={(e) => handleMappingChange(marker.fieldName, e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
                                >
                                  <option value="">Selecione um campo...</option>
                                  {availableFields.map(category => (
                                    <optgroup key={category.id} label={category.label}>
                                      {category.fields.map(field => (
                                        <option key={field.id} value={field.id}>
                                          {field.label} ({field.type})
                                        </option>
                                      ))}
                                    </optgroup>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader className="border-b border-gray-200 dark:border-gray-700">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Search className="w-5 h-5 text-primary-600" />
                  Campos Disponíveis
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar campos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
                  />
                </div>

                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {filteredFields.map(category => {
                    const Icon = iconMap[category.icon] || Info;
                    const isExpanded = expandedCategories.has(category.id);
                    
                    return (
                      <div key={category.id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                        <button
                          onClick={() => toggleCategory(category.id)}
                          className="w-full flex items-center gap-2 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-500" />
                          )}
                          <Icon className="w-4 h-4 text-primary-600" />
                          <span className="font-medium text-sm text-gray-700 dark:text-gray-300">
                            {category.label}
                          </span>
                          <span className="ml-auto text-xs text-gray-500">
                            {category.fields.length}
                          </span>
                        </button>
                        
                        {isExpanded && (
                          <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                            {category.fields.map(field => (
                              <div 
                                key={field.id}
                                className="px-4 py-2 flex items-center gap-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700/50 cursor-pointer"
                                onClick={() => {
                                  if (selectedMarker) {
                                    handleMappingChange(selectedMarker, field.id);
                                  }
                                }}
                              >
                                {getFieldTypeIcon(field.type)}
                                <span className="text-gray-700 dark:text-gray-300 flex-1">
                                  {field.label}
                                </span>
                                {getFieldTypeBadge(field.type)}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800 dark:text-blue-300">
                    <p className="font-medium mb-1">Dica</p>
                    <p>
                      Clique em um marcador à esquerda e depois em um campo aqui para fazer o mapeamento rapidamente.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 shadow-lg">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`flex items-center gap-2 ${
                mappingStats.unmapped > 0 ? 'text-yellow-600' : 'text-green-600'
              }`}>
                {mappingStats.unmapped > 0 ? (
                  <>
                    <AlertCircle className="w-5 h-5" />
                    <span>{mappingStats.unmapped} marcadores pendentes</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    <span>Todos os marcadores mapeados</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={onCancel}
                disabled={isSaving}
                className="px-6 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Salvar Mapeamento
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="h-20" />
      </div>
    </div>
  );
};

export default TemplateFieldMapper;
