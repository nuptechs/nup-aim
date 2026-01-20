import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AuthProvider, useAuth } from './contexts/ApiAuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider, useToast } from './contexts/ToastContext';
import { LoginForm } from './components/LoginForm';
import { EmailVerification } from './components/EmailVerification';
import { SessionTimeoutWarning } from './components/SessionTimeoutWarning';
import { Header } from './components/Header';
import { FormSection } from './components/FormSection';
import { BasicInfoForm } from './components/BasicInfoForm';
import { ScopeForm } from './components/ScopeForm';
import { ImpactsForm } from './components/ImpactsForm';
import { RisksForm } from './components/RisksForm';
import { MitigationsForm } from './components/MitigationsForm';
import { ConclusionsForm } from './components/ConclusionsForm';
import { DocumentPreview } from './components/DocumentPreview';
import { AnalysisManager } from './components/AnalysisManager';
import { BasicDataManager } from './components/BasicDataManager';
import { Dashboard } from './components/Dashboard';
import { AIAssistant } from './components/AIAssistant';
import { Onboarding } from './components/Onboarding';
import { exportToWord } from './utils/documentExporter';
import { saveAnalysis, generateNewId, getAnalysisById } from './utils/storage';
import { registerNuPAIMSections } from './hooks/useCustomFields';
import { getSystemSettings, SystemSettings } from './utils/systemSettings';
import { ImpactAnalysis } from './types';
import { Save, FolderOpen, LayoutDashboard, FileText } from 'lucide-react';
import { LoadingOverlay } from './components/ui/LoadingOverlay';

const CURRENT_ANALYSIS_KEY = 'nup_aim_current_analysis';
const CUSTOM_FIELDS_KEY = 'nup_aim_custom_fields';

const createInitialData = (projectName: string = ''): ImpactAnalysis => {
  return {
    id: generateNewId(),
    title: `PA`,
    description: '',
    author: '',
    date: new Date().toISOString().split('T')[0],
    version: '1.0',
    project: projectName,
    scope: {
      processes: []
    },
    impacts: {
      business: [],
      technical: [],
      operational: [],
      financial: []
    },
    risks: [],
    mitigations: [],
    conclusions: {
      summary: '',
      recommendations: [],
      nextSteps: []
    },
    customFieldsValues: {}
  };
};

const AppContent: React.FC = () => {
  const { isAuthenticated, hasPermission, logout } = useAuth();
  const toast = useToast();
  const [data, setData] = useState<ImpactAnalysis>(() => {
    const saved = sessionStorage.getItem(CURRENT_ANALYSIS_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return createInitialData();
      }
    }
    return createInitialData();
  });
  const [customFieldsValues, setCustomFieldsValues] = useState<Record<string, Record<string, any>>>(() => {
    const saved = sessionStorage.getItem(CUSTOM_FIELDS_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return {};
      }
    }
    return {};
  });
  const [isExporting, setIsExporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [isNavigationLoading, setIsNavigationLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'form' | 'preview'>('dashboard');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [showAnalysisManager, setShowAnalysisManager] = useState(false);
  const [showProjectsManager, setShowProjectsManager] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [systemSettings, setSystemSettings] = useState<SystemSettings>(getSystemSettings());
  const [currentView, setCurrentView] = useState<'login' | 'verify-email' | 'app'>('login');
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [showSessionWarning, setShowSessionWarning] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedDataRef = useRef<string>('');

  useEffect(() => {
    const handleSettingsChanged = (event: CustomEvent<SystemSettings>) => {
      setSystemSettings(event.detail);
    };
    
    window.addEventListener('systemSettingsChanged', handleSettingsChanged as EventListener);
    return () => {
      window.removeEventListener('systemSettingsChanged', handleSettingsChanged as EventListener);
    };
  }, []);

  useEffect(() => {
    const onboardingComplete = localStorage.getItem('nup-aim-onboarding-complete');
    if (isAuthenticated && !onboardingComplete) {
      setShowOnboarding(true);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    // Check URL for email verification token
    // Support both path-based (/verify-email?token=xxx) and hash-based (#/?token=xxx) URLs
    const pathname = window.location.pathname;
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    
    const token = searchParams.get('token') || hashParams.get('token');
    const isVerifyEmailPath = pathname === '/verify-email' || pathname.includes('/verify-email');
    
    if (token && isVerifyEmailPath) {
      setVerificationToken(token);
      setCurrentView('verify-email');
    } else if (isAuthenticated) {
      setCurrentView('app');
    } else {
      setCurrentView('login');
    }
  }, [isAuthenticated]);

  // Register custom fields sections when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      registerNuPAIMSections().catch(err => {
        console.error('Failed to register custom fields sections:', err);
      });
    }
  }, [isAuthenticated]);

  // Initialize lastSavedDataRef with current data to prevent redundant saves on load
  useEffect(() => {
    lastSavedDataRef.current = JSON.stringify({ data, customFieldsValues });
  }, []); // Only run once on mount

  // Auto-save: Persist to sessionStorage immediately when data changes
  useEffect(() => {
    sessionStorage.setItem(CURRENT_ANALYSIS_KEY, JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    sessionStorage.setItem(CUSTOM_FIELDS_KEY, JSON.stringify(customFieldsValues));
  }, [customFieldsValues]);

  // Auto-save: Save to database as draft after 3 seconds of inactivity
  const autoSaveToDatabase = useCallback(async () => {
    if (!isAuthenticated) return;
    
    // Check permissions before auto-saving
    if (!hasPermission('ANALYSIS', 'CREATE') && !hasPermission('ANALYSIS', 'EDIT')) {
      return;
    }
    
    const currentDataString = JSON.stringify({ data, customFieldsValues });
    if (currentDataString === lastSavedDataRef.current) return;
    
    setIsAutoSaving(true);
    try {
      const analysisWithCustomFields = {
        ...data,
        customFieldsValues
      };
      await saveAnalysis(analysisWithCustomFields);
      lastSavedDataRef.current = currentDataString;
      setLastSaved(new Date());
      console.log('[AutoSave] Análise salva como rascunho:', data.id);
    } catch (error) {
      console.error('[AutoSave] Erro ao salvar automaticamente:', error);
    } finally {
      setIsAutoSaving(false);
    }
  }, [data, customFieldsValues, isAuthenticated, hasPermission]);

  useEffect(() => {
    if (!isAuthenticated) return;
    
    // Clear any existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    // Set new timeout for auto-save (3 seconds after last change)
    autoSaveTimeoutRef.current = setTimeout(() => {
      autoSaveToDatabase();
    }, 3000);
    
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [data, customFieldsValues, isAuthenticated, autoSaveToDatabase]);

  // Função para estender a sessão
  const handleExtendSession = () => {
    localStorage.setItem('nup_aim_last_activity', Date.now().toString());
    setShowSessionWarning(false);
  };

  // Função para fazer logout
  const handleLogout = () => {
    logout();
    setShowSessionWarning(false);
  };

  if (currentView === 'verify-email') {
    return (
      <EmailVerification 
        token={verificationToken || undefined}
        onBackToLogin={() => {
          setCurrentView('login');
          setVerificationToken(null);
          // Clear URL hash
          window.location.hash = '';
        }}
      />
    );
  }

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  const updateData = (updates: Partial<ImpactAnalysis>) => {
    setData(prev => {
      const merged = { ...prev };
      
      // Deep merge for nested objects to preserve existing data
      if (updates.scope) {
        merged.scope = { ...prev.scope, ...updates.scope };
      }
      if (updates.impacts) {
        merged.impacts = { ...prev.impacts, ...updates.impacts };
      }
      if (updates.conclusions) {
        merged.conclusions = { ...prev.conclusions, ...updates.conclusions };
      }
      
      // Apply all updates, but use the deep-merged nested objects
      return { 
        ...prev, 
        ...updates,
        scope: updates.scope ? merged.scope : prev.scope,
        impacts: updates.impacts ? merged.impacts : prev.impacts,
        conclusions: updates.conclusions ? merged.conclusions : prev.conclusions
      };
    });
  };

  const handleExport = async () => {
    if (!hasPermission('ANALYSIS', 'EXPORT')) {
      alert('Você não tem permissão para exportar análises.');
      return;
    }

    setIsExporting(true);
    try {
      await exportToWord(data);
    } catch (error) {
      console.error('Erro ao exportar documento:', error);
      alert('Erro ao exportar o documento. Tente novamente.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleSave = async () => {
    if (!hasPermission('ANALYSIS', 'CREATE') && !hasPermission('ANALYSIS', 'EDIT')) {
      alert('Você não tem permissão para salvar análises.');
      return;
    }

    setIsSaving(true);
    let customFieldsSaved = true;
    let customFieldsErrors: string[] = [];
    
    try {
      // Save the main analysis data with custom fields values
      const analysisWithCustomFields = {
        ...data,
        customFieldsValues
      };
      await saveAnalysis(analysisWithCustomFields);
      
      // Save custom fields values to the microservice
      const { getCustomFieldsSDK } = await import('./hooks/useCustomFields');
      const sdk = getCustomFieldsSDK();
      
      for (const [sectionName, values] of Object.entries(customFieldsValues)) {
        if (Object.keys(values).length > 0) {
          try {
            await sdk.saveValues(data.id, sectionName, values);
          } catch (error) {
            customFieldsSaved = false;
            customFieldsErrors.push(sectionName);
            console.warn(`Failed to save custom fields for section ${sectionName}:`, error);
          }
        }
      }
      
      setLastSaved(new Date());
      
      // Show success/warning message based on results
      const msgDiv = document.createElement('div');
      msgDiv.className = `fixed top-4 right-4 px-4 py-2 rounded-lg shadow-lg z-50 ${
        customFieldsSaved ? 'bg-green-500' : 'bg-yellow-500'
      } text-white`;
      
      if (customFieldsSaved) {
        msgDiv.textContent = 'Análise salva com sucesso!';
      } else {
        msgDiv.innerHTML = `
          <div><strong>Análise salva localmente</strong></div>
          <div class="text-sm">Alguns campos personalizados não foram salvos no servidor.</div>
          <div class="text-xs mt-1">Seções afetadas: ${customFieldsErrors.join(', ')}</div>
        `;
      }
      
      document.body.appendChild(msgDiv);
      
      setTimeout(() => {
        if (document.body.contains(msgDiv)) {
          document.body.removeChild(msgDiv);
        }
      }, customFieldsSaved ? 3000 : 5000);
    } catch (error) {
      console.error('Erro ao salvar análise:', error);
      alert('Erro ao salvar a análise. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadAnalysis = (analysis: ImpactAnalysis) => {
    if (!hasPermission('ANALYSIS', 'VIEW')) {
      alert('Você não tem permissão para visualizar análises.');
      return;
    }

    setData(analysis);
    setCustomFieldsValues(analysis.customFieldsValues || {});
    setActiveTab('form');
    setShowAnalysisManager(false);
  };

  const handleSelectAnalysis = async (analysisId: string) => {
    if (!hasPermission('ANALYSIS', 'VIEW')) {
      alert('Você não tem permissão para visualizar análises.');
      return;
    }

    setIsNavigationLoading(true);
    try {
      const analysis = await getAnalysisById(analysisId);
      if (analysis) {
        handleLoadAnalysis(analysis);
      } else {
        toast.error('Análise não encontrada.');
      }
    } catch (error) {
      console.error('Erro ao carregar análise:', error);
      toast.error('Erro ao carregar a análise.');
    } finally {
      setIsNavigationLoading(false);
    }
  };

  const handleNewAnalysis = () => {
    if (!hasPermission('ANALYSIS', 'CREATE')) {
      alert('Você não tem permissão para criar análises.');
      return;
    }

    setData(createInitialData());
    setCustomFieldsValues({});
    setActiveTab('form');
    setCollapsedSections({});
    setLastSaved(null);
  };

  const toggleSection = (sectionId: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const isFormValid = () => {
    return data.title.trim() && 
           data.title !== 'PA' && 
           data.project.trim() && 
           data.author.trim() && 
           data.description.trim();
  };

  const canManageAnalyses = hasPermission('ANALYSIS', 'VIEW') || hasPermission('ANALYSIS', 'EDIT') || hasPermission('ANALYSIS', 'DELETE');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 theme-transition">
      <LoadingOverlay isVisible={isNavigationLoading} message="Carregando análise..." />
      <Header onExport={handleExport} isExporting={isExporting} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl mb-8 max-w-lg mx-auto shadow-soft">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium rounded-lg transition-all duration-200 ${
              activeTab === 'dashboard'
                ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('form')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium rounded-lg transition-all duration-200 ${
              activeTab === 'form'
                ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <FileText className="w-4 h-4" />
            Formulário
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-lg transition-all duration-200 ${
              activeTab === 'preview'
                ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Visualização
          </button>
        </div>

        {activeTab === 'dashboard' ? (
          <Dashboard 
            onNewAnalysis={() => {
              handleNewAnalysis();
              setActiveTab('form');
            }}
            onNavigate={(view) => {
              if (view === 'analyses') {
                setShowAnalysisManager(true);
              } else if (view === 'projects') {
                setShowProjectsManager(true);
              }
            }}
            onSelectAnalysis={handleSelectAnalysis}
          />
        ) : activeTab === 'form' ? (
          <div className="max-w-4xl mx-auto space-y-6">
            <FormSection
              title="Informações Básicas"
              required
              isCollapsed={collapsedSections['basic']}
              onToggle={() => toggleSection('basic')}
            >
              <BasicInfoForm 
                data={data} 
                onChange={updateData}
                customFieldsValues={customFieldsValues['basic_info'] || {}}
                onCustomFieldsChange={(values) => {
                  setCustomFieldsValues(prev => ({
                    ...prev,
                    basic_info: values
                  }));
                }}
              />
            </FormSection>

            <FormSection
              title="Escopo - O que foi realizado?"
              isCollapsed={collapsedSections['scope']}
              onToggle={() => toggleSection('scope')}
            >
              <ScopeForm 
                data={data} 
                onChange={updateData}
                customFieldsValues={customFieldsValues['scope'] || {}}
                onCustomFieldsChange={(values) => {
                  setCustomFieldsValues(prev => ({
                    ...prev,
                    scope: values
                  }));
                }}
              />
            </FormSection>

            {/* Additional Information Section - Only show when enabled by admin */}
            {systemSettings.showAdditionalSectionsToAll && (
              <>
                <FormSection
                  title="Análise de Impactos"
                  isCollapsed={collapsedSections['impacts']}
                  onToggle={() => toggleSection('impacts')}
                >
                  <ImpactsForm 
                    data={data} 
                    onChange={updateData}
                    customFieldsValues={customFieldsValues['impacts'] || {}}
                    onCustomFieldsChange={(values) => {
                      setCustomFieldsValues(prev => ({
                        ...prev,
                        impacts: values
                      }));
                    }}
                  />
                </FormSection>

                <FormSection
                  title="Matriz de Riscos"
                  isCollapsed={collapsedSections['risks']}
                  onToggle={() => toggleSection('risks')}
                >
                  <RisksForm 
                    data={data} 
                    onChange={updateData}
                    customFieldsValues={customFieldsValues['risks'] || {}}
                    onCustomFieldsChange={(values) => {
                      setCustomFieldsValues(prev => ({
                        ...prev,
                        risks: values
                      }));
                    }}
                  />
                </FormSection>

                <FormSection
                  title="Plano de Mitigação"
                  isCollapsed={collapsedSections['mitigations']}
                  onToggle={() => toggleSection('mitigations')}
                >
                  <MitigationsForm 
                    data={data} 
                    onChange={updateData}
                    customFieldsValues={customFieldsValues['mitigations'] || {}}
                    onCustomFieldsChange={(values) => {
                      setCustomFieldsValues(prev => ({
                        ...prev,
                        mitigations: values
                      }));
                    }}
                  />
                </FormSection>

                <FormSection
                  title="Conclusões e Recomendações"
                  isCollapsed={collapsedSections['conclusions']}
                  onToggle={() => toggleSection('conclusions')}
                >
                  <ConclusionsForm 
                    data={data} 
                    onChange={updateData}
                    customFieldsValues={customFieldsValues['conclusions'] || {}}
                    onCustomFieldsChange={(values) => {
                      setCustomFieldsValues(prev => ({
                        ...prev,
                        conclusions: values
                      }));
                    }}
                  />
                </FormSection>
              </>
            )}

            {/* Action Buttons */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-4">
                  {(hasPermission('ANALYSIS', 'CREATE') || hasPermission('ANALYSIS', 'EDIT')) && (
                    <button
                      onClick={handleSave}
                      disabled={isSaving || !isFormValid()}
                      className="inline-flex items-center px-6 py-3 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {isSaving ? 'Salvando...' : 'Salvar Análise'}
                    </button>
                  )}
                  
                  {canManageAnalyses && (
                    <button
                      onClick={() => setShowAnalysisManager(true)}
                      className="inline-flex items-center px-4 py-3 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                    >
                      <FolderOpen className="w-4 h-4 mr-2" />
                      Gerenciar Análises
                    </button>
                  )}
                </div>

                {isAutoSaving ? (
                  <div className="text-sm text-blue-500 flex items-center gap-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    Salvando automaticamente...
                  </div>
                ) : lastSaved ? (
                  <div className="text-sm text-gray-500">
                    Última alteração salva: {lastSaved.toLocaleTimeString('pt-BR')}
                  </div>
                ) : null}
              </div>

            </div>
          </div>
        ) : (
          <DocumentPreview data={data} />
        )}
      </div>

      {/* Analysis Manager Modal */}
      {showAnalysisManager && canManageAnalyses && (
        <AnalysisManager
          onLoadAnalysis={handleLoadAnalysis}
          onNewAnalysis={handleNewAnalysis}
          onClose={() => setShowAnalysisManager(false)}
        />
      )}

      {/* Projects Manager Modal - Only for admins with PROJECTS_MANAGE permission */}
      {showProjectsManager && hasPermission('PROJECTS', 'MANAGE') && (
        <BasicDataManager
          onClose={() => setShowProjectsManager(false)}
        />
      )}

      {/* Session Timeout Warning */}
      {showSessionWarning && (
        <SessionTimeoutWarning 
          onExtendSession={handleExtendSession}
          onLogout={handleLogout}
        />
      )}

      {/* AI Assistant - only for users with AI permission */}
      {isAuthenticated && activeTab === 'form' && hasPermission('ANALYSIS', 'IMPORT_AI') && (
        <AIAssistant 
          analysisContext={{
            title: data.title,
            description: data.description,
            project: data.project
          }}
        />
      )}

      {/* Onboarding */}
      {showOnboarding && (
        <Onboarding
          onComplete={() => {
            setShowOnboarding(false);
            localStorage.setItem('nup-aim-onboarding-complete', 'true');
            toast.success('Bem-vindo ao NuP-AIM! Você está pronto para começar.');
          }}
          onSkip={() => {
            setShowOnboarding(false);
            localStorage.setItem('nup-aim-onboarding-complete', 'true');
          }}
        />
      )}
    </div>
  );
};

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;