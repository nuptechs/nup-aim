import React, { useState, useEffect } from 'react';
import { Settings, X, Save, Eye, EyeOff, FileEdit, BookOpen, ExternalLink } from 'lucide-react';
import { getSystemSettings, saveSystemSettings, SystemSettings } from '../utils/systemSettings';
import { FpaGuidelinesManager } from './FpaGuidelinesManager';

interface SystemSettingsProps {
  onClose: () => void;
}

export const SystemSettingsModal: React.FC<SystemSettingsProps> = ({ onClose }) => {
  const [settings, setSettings] = useState<SystemSettings>(getSystemSettings());
  const [saved, setSaved] = useState(false);
  const [showFpaGuidelines, setShowFpaGuidelines] = useState(false);

  useEffect(() => {
    setSettings(getSystemSettings());
  }, []);

  const handleSave = () => {
    saveSystemSettings(settings);
    setSaved(true);
    window.dispatchEvent(new CustomEvent('systemSettingsChanged', { detail: settings }));
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 500);
  };

  const handleToggle = (key: keyof SystemSettings) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Configurações do Sistema</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          <div className="space-y-6">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                Exibição de Seções
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {settings.showAdditionalSectionsToAll ? (
                        <Eye className="w-5 h-5 text-green-600" />
                      ) : (
                        <EyeOff className="w-5 h-5 text-gray-400" />
                      )}
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        Informações Adicionais
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Exibir as seções de Análise de Impactos, Matriz de Riscos, Plano de Mitigação e Conclusões para todos os usuários
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer ml-4">
                    <input
                      type="checkbox"
                      checked={settings.showAdditionalSectionsToAll}
                      onChange={() => handleToggle('showAdditionalSectionsToAll')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {settings.showCustomFieldsToAll ? (
                        <FileEdit className="w-5 h-5 text-green-600" />
                      ) : (
                        <FileEdit className="w-5 h-5 text-gray-400" />
                      )}
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        Campos Personalizados
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Exibir a seção de Campos Personalizados em cada formulário para todos os usuários
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer ml-4">
                    <input
                      type="checkbox"
                      checked={settings.showCustomFieldsToAll}
                      onChange={() => handleToggle('showCustomFieldsToAll')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                Análise de Pontos de Função
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {settings.enableFpaGuidelines ? (
                        <BookOpen className="w-5 h-5 text-green-600" />
                      ) : (
                        <BookOpen className="w-5 h-5 text-gray-400" />
                      )}
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        Diretrizes de APF
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Habilitar diretrizes personalizadas para guiar a análise de pontos de função via IA
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer ml-4">
                    <input
                      type="checkbox"
                      checked={settings.enableFpaGuidelines}
                      onChange={() => handleToggle('enableFpaGuidelines')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {settings.enableFpaGuidelines && (
                  <button
                    type="button"
                    onClick={() => setShowFpaGuidelines(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Gerenciar Diretrizes de APF
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          {saved && (
            <span className="text-sm text-green-600 dark:text-green-400">
              Configurações salvas!
            </span>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Save className="w-4 h-4 mr-2" />
            Salvar Configurações
          </button>
        </div>
      </div>

      {showFpaGuidelines && (
        <FpaGuidelinesManager onClose={() => setShowFpaGuidelines(false)} />
      )}
    </div>
  );
};
