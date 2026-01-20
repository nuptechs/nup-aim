import React, { useState } from 'react';
import { Plus, Edit2, Check, X, Calculator, Info, AlertTriangle, Sparkles, Upload, FileText, Loader2 } from 'lucide-react';
import { ImpactAnalysis, ProcessItem, WorkspaceInput } from '../types';
import { ImagePasteField } from './ImagePasteField';
import { useAuth } from '../contexts/ApiAuthContext';
import { FieldExtractorModal } from './FieldExtractorModal';
import { ExtractedField } from '../utils/fieldExtractor';
import { CustomFieldsSection } from './CustomFieldsSection';
import { getSystemSettings } from '../utils/systemSettings';
import { WorkspaceCapture } from './WorkspaceCapture';

interface ScopeFormProps {
  data: ImpactAnalysis;
  onChange: (data: Partial<ImpactAnalysis>) => void;
  customFieldsValues?: Record<string, any>;
  onCustomFieldsChange?: (values: Record<string, any>) => void;
}

export const ScopeForm: React.FC<ScopeFormProps> = ({ 
  data, 
  onChange,
  customFieldsValues = {},
  onCustomFieldsChange 
}) => {
  const { hasPermission } = useAuth();
  const canUseAI = hasPermission('ANALYSIS', 'IMPORT_AI');
  const [editingProcess, setEditingProcess] = useState<string | null>(null);
  const [originalProcessData, setOriginalProcessData] = useState<ProcessItem | null>(null);
  const [isEditingExistingProcess, setIsEditingExistingProcess] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showFieldExtractor, setShowFieldExtractor] = useState(false);
  const [selectedScreenshotData, setSelectedScreenshotData] = useState<string>('');
  const [, setExtractedFieldsMap] = useState<Record<string, ExtractedField[]>>({});
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);
  const [autoExtractEnabled, setAutoExtractEnabled] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<{ summary?: string; totalPoints?: number } | null>(null);
  const [showRationaleProcess, setShowRationaleProcess] = useState<ProcessItem | null>(null);
  const [isExtractingSingle, setIsExtractingSingle] = useState(false);
  const [showBatchImport, setShowBatchImport] = useState(false);

  const handleAIAnalyze = async (inputs: WorkspaceInput[]) => {
    const token = localStorage.getItem('nup_aim_auth_token');
    if (!token) return;
    
    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/ai/analyze-function-points', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ inputs })
      });

      const result = await response.json();
      
      if (result.success) {
        if (result.functionalities && result.functionalities.length > 0) {
          const newProcesses: ProcessItem[] = result.functionalities.map((f: any) => ({
            id: Date.now().toString() + Math.random(),
            name: f.name,
            status: f.status,
            workDetails: f.workDetails,
            screenshots: '',
            functionType: f.functionType,
            complexity: f.complexity,
            aiGenerated: true,
            aiConfidence: f.confidence,
            aiRationale: f.rationale,
            citationVerified: f.citationVerified,
            citationText: f.citationText
          }));

          onChange({
            scope: {
              processes: [...data.scope.processes, ...newProcesses]
            }
          });

          setAiAnalysisResult({
            summary: result.summary,
            totalPoints: result.totalPoints
          });
        } else {
          setAiAnalysisResult({
            summary: result.summary || 'Nenhuma funcionalidade identificada. Tente fornecer mais detalhes.'
          });
        }
      } else {
        setAiAnalysisResult({
          summary: result.message || 'Erro ao processar análise. Tente novamente.'
        });
      }
    } catch (error) {
      console.error('Erro na análise AI:', error);
      setAiAnalysisResult({
        summary: 'Erro de conexão ao analisar. Verifique sua conexão e tente novamente.'
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const addProcess = () => {
    const newProcess: ProcessItem = {
      id: Date.now().toString(),
      name: '',
      status: 'nova',
      workDetails: '',
      screenshots: '',
      websisCreated: undefined
    };

    onChange({
      scope: {
        processes: [...data.scope.processes, newProcess]
      }
    });

    setOriginalProcessData({ ...newProcess });
    setIsEditingExistingProcess(false);
    setEditingProcess(newProcess.id);
    setShowForm(true);
  };

  const updateProcess = (index: number, updates: Partial<ProcessItem>) => {
    const updatedProcesses = [...data.scope.processes];
    updatedProcesses[index] = { ...updatedProcesses[index], ...updates };

    onChange({
      scope: {
        processes: updatedProcesses
      }
    });
  };

  const removeProcess = (index: number) => {
    onChange({
      scope: {
        processes: data.scope.processes.filter((_, i) => i !== index)
      }
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'nova': return 'bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-400 dark:border-emerald-600';
      case 'alterada': return 'bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-400 dark:border-amber-600';
      case 'excluida': return 'bg-rose-50 dark:bg-rose-900/20 border-2 border-rose-400 dark:border-rose-600';
      default: return 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'nova': return 'Nova';
      case 'alterada': return 'Alterada';
      case 'excluida': return 'Excluída';
      default: return status;
    }
  };

  const shouldShowAdditionalFields = (process: ProcessItem) => {
    return process.status !== undefined && process.status !== null;
  };

  const shouldShowWebsisQuestion = (process: ProcessItem) => {
    return process.status === 'alterada';
  };

  const shouldShowWorkDetailsAndScreenshots = (process: ProcessItem) => {
    if (process.status === 'nova' || process.status === 'excluida') {
      return true;
    }
    if (process.status === 'alterada') {
      return process.websisCreated !== undefined;
    }
    return false;
  };

  const isProcessComplete = (process: ProcessItem) => {
    if (!process) return false;
    if (!process.name?.trim()) return false;
    if (process.status === 'alterada' && process.websisCreated === undefined) return false;
    return true;
  };

  const handleSaveProcess = (processId: string) => {
    const process = data.scope.processes.find(p => p.id === processId);
    if (process && isProcessComplete(process)) {
      setEditingProcess(null);
      setShowForm(false);
    }
  };

  const handleEditProcess = (processId: string) => {
    // Save original data before editing so we can restore on cancel
    const processToEdit = data.scope.processes.find(p => p.id === processId);
    if (processToEdit) {
      setOriginalProcessData({ ...processToEdit });
    }
    setIsEditingExistingProcess(true); // This is an EXISTING process
    setEditingProcess(processId);
    setShowForm(true);
  };

  const handleCancelEdit = () => {
    if (editingProcess) {
      if (isEditingExistingProcess && originalProcessData) {
        // This was an existing process - restore original data
        onChange({
          scope: {
            processes: data.scope.processes.map(p => 
              p.id === editingProcess ? originalProcessData : p
            )
          }
        });
      } else {
        // This was a new incomplete process - remove it
        onChange({
          scope: {
            processes: data.scope.processes.filter(p => p.id !== editingProcess)
          }
        });
      }
    }
    
    setOriginalProcessData(null);
    setIsEditingExistingProcess(false);
    setEditingProcess(null);
    setShowForm(false);
  };

  const handleExtractedFields = (processId: string, fields: ExtractedField[]) => {
    setExtractedFieldsMap(prev => ({
      ...prev,
      [processId]: fields
    }));

    // If auto-extract is enabled and we have fields, automatically analyze them
    if (autoExtractEnabled && fields.length > 0) {
      const process = data.scope.processes.find(p => p.id === processId);
      if (process && process.screenshots) {
        const { images } = parseImageData(process.screenshots);
        if (images.length > 0) {
          // Use the first image for analysis
          handleAnalyzeFunctionPoints(processId);
        }
      }
    }
  };

  const parseImageData = (data: string): { images: ImageData[], text: string } => {
    if (!data) return { images: [], text: '' };
    
    const lines = data.split('\n');
    const images: any[] = [];
    const textLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith('IMAGE_DATA:')) {
        try {
          const imageJson = line.replace('IMAGE_DATA:', '');
          const imageData = JSON.parse(imageJson);
          images.push(imageData);
        } catch (error) {
          console.error('Error parsing image data:', error);
        }
      } else if (line.trim() && !line.startsWith('[Imagem ')) {
        textLines.push(line);
      }
    }

    return { images, text: textLines.join('\n') };
  };

  const handleAnalyzeFunctionPoints = (processId: string) => {
    const process = data.scope.processes.find(p => p.id === processId);
    if (process) {
      setSelectedScreenshotData(process.screenshots || '');
      setSelectedProcessId(processId);
      setShowFieldExtractor(true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sticky Header with Add Button */}
      <div className="sticky top-0 bg-white dark:bg-gray-800 z-20 py-4 border-b border-gray-200 dark:border-gray-700 -mx-6 px-6">
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100">Funcionalidades Impactadas</h4>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowBatchImport(!showBatchImport)}
              disabled={editingProcess !== null}
              className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                showBatchImport 
                  ? 'bg-purple-100 text-purple-700 border border-purple-300' 
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              <FileText className="w-4 h-4 mr-2" />
              Importar em Lote
            </button>
            <button
              type="button"
              onClick={addProcess}
              disabled={editingProcess !== null}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Funcionalidade
            </button>
          </div>
        </div>
      </div>

      {/* Batch Import Section - shown when button is clicked */}
      {showBatchImport && (
        <div className="space-y-3 border-2 border-purple-200 dark:border-purple-700 rounded-lg p-4 bg-purple-50 dark:bg-purple-900/20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              <span className="font-medium text-purple-900 dark:text-purple-100">Importar várias funcionalidades com IA</span>
            </div>
            <button
              type="button"
              onClick={() => setShowBatchImport(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <WorkspaceCapture onAnalyze={handleAIAnalyze} isAnalyzing={isAnalyzing} />

          {aiAnalysisResult && (
            <div className={`p-4 rounded-lg border ${
              aiAnalysisResult.totalPoints 
                ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700' 
                : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
            }`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className={`text-sm ${aiAnalysisResult.totalPoints ? 'text-gray-700 dark:text-gray-300' : 'text-yellow-800 dark:text-yellow-300'}`}>
                    {aiAnalysisResult.summary}
                  </p>
                  {aiAnalysisResult.totalPoints && (
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-2">
                      Total estimado: {aiAnalysisResult.totalPoints} Pontos de Função
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setAiAnalysisResult(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 ml-3"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Functionality Tags */}
      {data.scope.processes.length > 0 && (
        <div className="space-y-4">
          <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Funcionalidades Cadastradas ({data.scope.processes.length}):
          </h5>
          <div className="flex flex-wrap gap-2">
            {data.scope.processes.map((process, index) => {
              // Format display name: remove type prefix if present, limit to 30 chars
              const displayName = (() => {
                let name = process.name;
                if (process.functionType && name.startsWith(process.functionType + ' - ')) {
                  name = name.substring(process.functionType.length + 3);
                } else if (process.functionType && name.startsWith(process.functionType + ' ')) {
                  name = name.substring(process.functionType.length + 1);
                }
                return name.length > 30 ? name.substring(0, 30) + '...' : name;
              })();
              
              // Determine if item needs review
              const needsReview = process.aiGenerated && (
                (process.aiConfidence !== undefined && process.aiConfidence < 0.8) ||
                (process.citationVerified === false) ||
                (process.aiConfidence === undefined || process.aiConfidence === null)
              );
              
              return (
                <div
                  key={process.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md ${getStatusColor(process.status)} transition-all hover:shadow-sm`}
                >
                  {process.functionType && (
                    <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-slate-700 dark:bg-slate-600 text-white text-[10px] font-semibold rounded">
                      {process.functionType}
                    </span>
                  )}
                  <span 
                    className="flex-1 font-medium text-sm text-gray-900 dark:text-gray-100 truncate" 
                    title={process.name}
                  >
                    {displayName}
                  </span>
                  {needsReview && (
                    <span title="Requer revisão" className="flex-shrink-0 text-amber-500 dark:text-amber-400">
                      <AlertTriangle className="w-3 h-3" />
                    </span>
                  )}
                  {process.complexity && (
                    <span className="text-[10px] text-gray-500 dark:text-gray-400">{process.complexity}</span>
                  )}
                  <div className="flex items-center flex-shrink-0">
                    {process.aiGenerated && process.aiRationale && (
                      <button
                        type="button"
                        onClick={() => setShowRationaleProcess(process)}
                        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors"
                        title="Ver justificativa da IA"
                      >
                        <Info className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (editingProcess && editingProcess !== process.id) {
                          setEditingProcess(null);
                          setShowForm(false);
                          setOriginalProcessData(null);
                          setIsEditingExistingProcess(false);
                        }
                        handleEditProcess(process.id);
                      }}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors"
                      title="Editar"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (editingProcess === process.id) {
                          setEditingProcess(null);
                          setShowForm(false);
                          setOriginalProcessData(null);
                          setIsEditingExistingProcess(false);
                        }
                        removeProcess(index);
                      }}
                      className="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded transition-colors"
                      title="Remover"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Form for editing/adding functionality */}
      {showForm && editingProcess && (
        <div className="border-2 border-blue-200 dark:border-blue-800 rounded-lg p-6 bg-blue-50 dark:bg-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h5 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              {data.scope.processes.find(p => p.id === editingProcess)?.name ? 'Editar' : 'Nova'} Funcionalidade
            </h5>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSaveProcess(editingProcess)}
                disabled={!isProcessComplete(data.scope.processes.find(p => p.id === editingProcess)!)}
                className="inline-flex items-center px-3 py-1 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check className="w-4 h-4 mr-1" />
                Salvar
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="inline-flex items-center px-3 py-1 bg-gray-600 text-white text-sm font-medium rounded hover:bg-gray-700 transition-colors"
              >
                <X className="w-4 h-4 mr-1" />
                Cancelar
              </button>
            </div>
          </div>

          {(() => {
            const processIndex = data.scope.processes.findIndex(p => p.id === editingProcess);
            const process = data.scope.processes[processIndex];
            
            if (!process) return null;

            const handleDiscoverFunctionalities = async () => {
              // Check if auto discovery is enabled in system settings
              const settings = getSystemSettings();
              if (!settings.enableAutoDiscovery) return;
              
              const currentProcess = data.scope.processes[processIndex];
              if (!currentProcess) return;
              
              const workDetails = currentProcess.workDetails || '';
              const primaryName = currentProcess.name || '';
              
              // Skip if no substantial content
              if (workDetails.trim().length < 30) return;
              
              setIsExtractingSingle(true);
              
              try {
                const token = localStorage.getItem('nup_aim_auth_token') || localStorage.getItem('auth_token');
                const existingNames = data.scope.processes.map(p => p.name).filter(Boolean);
                
                const response = await fetch('/api/ai/discover-functionalities', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                  body: JSON.stringify({ primaryName, workDetails, existingNames })
                });
                
                const result = await response.json();
                
                if (result.success && result.additionalFunctionalities && result.additionalFunctionalities.length > 0) {
                  // Create new process items for discovered functionalities
                  const newProcesses: ProcessItem[] = result.additionalFunctionalities.map((f: any) => ({
                    id: Date.now().toString() + Math.random(),
                    name: f.name,
                    status: f.status || 'nova',
                    workDetails: '',
                    screenshots: '',
                    functionType: f.type || 'EE',
                    complexity: 'Baixa',
                    aiGenerated: true,
                    aiRationale: f.rationale
                  }));
                  
                  // Add new functionalities to the list (preserving current process data)
                  const updatedProcesses = [...data.scope.processes];
                  onChange({
                    scope: {
                      processes: [...updatedProcesses, ...newProcesses]
                    }
                  });
                }
              } catch (error) {
                console.error('Discover functionalities failed:', error);
              } finally {
                setIsExtractingSingle(false);
              }
            };

            return (
              <div className="space-y-4 bg-white dark:bg-gray-700 rounded-lg p-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nome da Funcionalidade *
                  </label>
                  <input
                    type="text"
                    value={process.name}
                    onChange={(e) => updateProcess(processIndex, { name: e.target.value })}
                    placeholder="Ex: Funcionalidade de Aprovação de Documentos"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Status da Funcionalidade *
                  </label>
                  <div className="flex gap-4">
                    {[
                      { value: 'nova', label: 'Nova' },
                      { value: 'alterada', label: 'Alterada' },
                      { value: 'excluida', label: 'Excluída' }
                    ].map((option) => (
                      <label key={option.value} className="flex items-center">
                        <input
                          type="radio"
                          name={`status-${process.id}`}
                          value={option.value}
                          checked={process.status === option.value}
                          onChange={(e) => updateProcess(processIndex, { 
                            status: e.target.value as any,
                            websisCreated: undefined // Reset websis question when status changes
                          })}
                          className="mr-2 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {shouldShowAdditionalFields(process) && (
                  <div className="space-y-4 border-t border-gray-200 dark:border-gray-600 pt-4">
                    {shouldShowWebsisQuestion(process) && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          A Websis criou/alterou essa funcionalidade antes? *
                        </label>
                        <div className="flex gap-4">
                          <label className="flex items-center">
                            <input
                              type="radio"
                              name={`websis-${process.id}`}
                              value="sim"
                              checked={process.websisCreated === true}
                              onChange={() => updateProcess(processIndex, { websisCreated: true })}
                              className="mr-2 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">SIM</span>
                          </label>
                          <label className="flex items-center">
                            <input
                              type="radio"
                              name={`websis-${process.id}`}
                              value="nao"
                              checked={process.websisCreated === false}
                              onChange={() => updateProcess(processIndex, { websisCreated: false })}
                              className="mr-2 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">NÃO</span>
                          </label>
                        </div>
                      </div>
                    )}

                    {shouldShowWorkDetailsAndScreenshots(process) && (
                      <div className="space-y-4 border-t border-gray-100 dark:border-gray-600 pt-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Detalhamento do Trabalho Realizado
                            {isExtractingSingle && (
                              <span className="ml-2 text-xs text-purple-600 dark:text-purple-400 inline-flex items-center">
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                Analisando...
                              </span>
                            )}
                          </label>
                          <textarea
                            value={process.workDetails || ''}
                            onChange={(e) => updateProcess(processIndex, { workDetails: e.target.value })}
                            onBlur={() => handleDiscoverFunctionalities()}
                            placeholder="Descreva detalhadamente o trabalho realizado nesta funcionalidade..."
                            rows={4}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                              Prints das Telas Impactadas
                            </label>
                            {canUseAI && (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleAnalyzeFunctionPoints(process.id)}
                                  disabled={!process.screenshots}
                                  className="inline-flex items-center px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors disabled:opacity-50"
                                  title="Realizar análise de pontos de função"
                                >
                                  <Calculator className="w-3 h-3 mr-1" />
                                  Análise de Pontos de Função
                                </button>
                                <label className="flex items-center text-xs">
                                  <input
                                    type="checkbox"
                                    checked={autoExtractEnabled}
                                    onChange={(e) => setAutoExtractEnabled(e.target.checked)}
                                    className="mr-1 text-blue-600 focus:ring-blue-500"
                                  />
                                  Extração automática
                                </label>
                              </div>
                            )}
                          </div>
                          <ImagePasteField
                            value={process.screenshots || ''}
                            onChange={(value) => {
                              updateProcess(processIndex, { screenshots: value });
                            }}
                            onExtractFields={(fields) => handleExtractedFields(process.id, fields)}
                            autoExtractEnabled={autoExtractEnabled}
                            placeholder="Cole aqui as imagens das telas impactadas usando Ctrl+V ou descreva as telas em texto..."
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {data.scope.processes.length === 0 && !showForm && (
        <div className="text-center py-8 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <p className="text-gray-500 dark:text-gray-400">Nenhuma funcionalidade adicionada</p>
          <p className="text-sm text-gray-400 dark:text-gray-500">Clique em "Adicionar Funcionalidade" para começar</p>
        </div>
      )}

      {/* Field Extractor Modal */}
      {showFieldExtractor && selectedProcessId && (
        <FieldExtractorModal
          screenshotData={selectedScreenshotData}
          processId={selectedProcessId}
          onClose={() => {
            setShowFieldExtractor(false);
            setSelectedProcessId(null);
          }}
          onSaveAnalysis={(analysisText) => {
            if (selectedProcessId) {
              const processIndex = data.scope.processes.findIndex(p => p.id === selectedProcessId);
              if (processIndex !== -1) {
                const currentWorkDetails = data.scope.processes[processIndex].workDetails || '';
                const newWorkDetails = currentWorkDetails + (currentWorkDetails ? '\n\n' : '') + analysisText;
                updateProcess(processIndex, { workDetails: newWorkDetails });
              }
            }
          }}
        />
      )}
      
      {/* Custom Fields Section */}
      {getSystemSettings().showCustomFieldsToAll && (
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Campos Personalizados</h3>
          <CustomFieldsSection 
            sectionName="scope" 
            analysisId={data.id}
            initialValues={customFieldsValues}
            onValuesChange={onCustomFieldsChange}
          />
        </div>
      )}

      {/* AI Rationale Modal */}
      {showRationaleProcess && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            {/* Header - Compact */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Justificativa da Classificação</h3>
              <button
                onClick={() => setShowRationaleProcess(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 overflow-y-auto max-h-[calc(90vh-80px)]">
              {/* Functionality Header */}
              <div className="flex items-center justify-between mb-5 pb-4 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-1 text-sm font-semibold rounded ${
                    showRationaleProcess.functionType === 'SE' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                    showRationaleProcess.functionType === 'EE' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                    showRationaleProcess.functionType === 'CE' ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                    showRationaleProcess.functionType === 'ALI' ? 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' :
                    'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                  }`}>
                    {showRationaleProcess.functionType}
                  </span>
                  <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                    {showRationaleProcess.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 rounded">
                    {showRationaleProcess.status === 'nova' ? 'Nova' : showRationaleProcess.status === 'alterada' ? 'Alterada' : 'Excluída'}
                  </span>
                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 rounded capitalize">
                    {showRationaleProcess.complexity}
                  </span>
                  {showRationaleProcess.aiConfidence && (
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 rounded">
                      {Math.round(showRationaleProcess.aiConfidence * 100)}%
                    </span>
                  )}
                </div>
              </div>

              {/* Clean Sections */}
              <div className="space-y-5">
                {/* Source Text */}
                <div>
                  <h5 className="text-xs font-medium text-teal-600 dark:text-teal-400 uppercase tracking-wide mb-2">
                    Trecho de Origem
                  </h5>
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 border-l-2 border-teal-400 dark:border-teal-600">
                    <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                      {showRationaleProcess.aiRationale?.match(/['"]([^'"]+)['"]/)?.[1] || 
                       showRationaleProcess.aiRationale?.split('.')[0] || 
                       'Trecho não disponível'}
                    </p>
                  </div>
                </div>

                {/* Classification */}
                <div>
                  <h5 className={`text-xs font-medium uppercase tracking-wide mb-2 ${
                    showRationaleProcess.functionType === 'SE' ? 'text-emerald-600 dark:text-emerald-400' :
                    showRationaleProcess.functionType === 'EE' ? 'text-blue-600 dark:text-blue-400' :
                    showRationaleProcess.functionType === 'CE' ? 'text-amber-600 dark:text-amber-400' :
                    showRationaleProcess.functionType === 'ALI' ? 'text-violet-600 dark:text-violet-400' :
                    'text-rose-600 dark:text-rose-400'
                  }`}>
                    Classificação: {showRationaleProcess.functionType}
                  </h5>
                  <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                    {showRationaleProcess.functionType === 'EE' && 'Entrada Externa - Processo que recebe dados de fora do sistema e os armazena/atualiza internamente.'}
                    {showRationaleProcess.functionType === 'SE' && 'Saída Externa - Processo que envia dados para fora do sistema com processamento lógico.'}
                    {showRationaleProcess.functionType === 'CE' && 'Consulta Externa - Processo de recuperação de dados sem processamento complexo.'}
                    {showRationaleProcess.functionType === 'ALI' && 'Arquivo Lógico Interno - Grupo de dados mantido dentro do sistema.'}
                    {showRationaleProcess.functionType === 'AIE' && 'Arquivo de Interface Externa - Grupo de dados referenciado mas mantido por outro sistema.'}
                  </p>
                </div>

                {/* Complexity */}
                <div>
                  <h5 className="text-xs font-medium text-teal-600 dark:text-teal-400 uppercase tracking-wide mb-2">
                    Complexidade: {showRationaleProcess.complexity?.charAt(0).toUpperCase()}{showRationaleProcess.complexity?.slice(1)}
                  </h5>
                  <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                    {(() => {
                      const rationale = showRationaleProcess.aiRationale || '';
                      if (rationale.includes('Não foi possível extrair') || rationale.includes('não foi possível identificar')) {
                        return 'Não foi possível extrair do texto os campos/elementos específicos para determinar DERs/ALRs conforme o padrão IFPUG, portanto a complexidade foi considerada média.';
                      }
                      const derMatch = rationale.match(/(\d+)\s*DERs?/i);
                      const alrMatch = rationale.match(/(\d+)\s*(?:ALRs?|TRs?|ARs?)/i);
                      if (derMatch || alrMatch) {
                        const ders = derMatch ? derMatch[1] : '?';
                        const alrs = alrMatch ? alrMatch[1] : '?';
                        const comp = showRationaleProcess.complexity || 'média';
                        return `${ders} DERs, ${alrs} ALRs/TRs → Complexidade ${comp.charAt(0).toUpperCase()}${comp.slice(1)} (IFPUG CPM 4.3.1)`;
                      }
                      return 'Complexidade estimada conforme padrões IFPUG.';
                    })()}
                  </p>
                </div>

                {/* Full Justification - Collapsible */}
                <details className="group">
                  <summary className="text-xs font-medium text-teal-600 dark:text-teal-400 uppercase tracking-wide cursor-pointer hover:text-teal-700 dark:hover:text-teal-300">
                    Justificativa Completa
                  </summary>
                  <div className="mt-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed whitespace-pre-wrap">
                      {showRationaleProcess.aiRationale}
                    </p>
                  </div>
                </details>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowRationaleProcess(null)}
                className="w-full px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 text-sm font-medium transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};