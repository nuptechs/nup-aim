import React from 'react';
import { Save, Check, AlertCircle, Loader2 } from 'lucide-react';

interface FormProgressIndicatorProps {
  progress: number;
  lastSaved?: Date | null;
  status?: 'idle' | 'saving' | 'saved' | 'error';
  showProgress?: boolean;
}

export const FormProgressIndicator: React.FC<FormProgressIndicatorProps> = ({
  progress,
  lastSaved,
  status = 'idle',
  showProgress = true,
}) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'saving':
        return <Loader2 className="w-4 h-4 animate-spin text-primary-500" />;
      case 'saved':
        return <Check className="w-4 h-4 text-success-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-danger-500" />;
      default:
        return <Save className="w-4 h-4 text-gray-400 dark:text-gray-500" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'saving':
        return 'Salvando...';
      case 'saved':
        return lastSaved ? `Salvo às ${lastSaved.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Salvo';
      case 'error':
        return 'Erro ao salvar';
      default:
        return 'Não salvo';
    }
  };

  const getProgressColor = () => {
    if (progress < 25) return 'bg-danger-500';
    if (progress < 50) return 'bg-warning-500';
    if (progress < 75) return 'bg-primary-500';
    return 'bg-success-500';
  };

  return (
    <div className="flex items-center gap-4 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-soft animate-fade-in">
      {showProgress && (
        <div className="flex items-center gap-3 flex-1">
          <div className="flex-1 max-w-32">
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full ${getProgressColor()} transition-all duration-500 ease-out`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">
            {progress}% completo
          </span>
        </div>
      )}
      
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        {getStatusIcon()}
        <span className="hidden sm:inline">{getStatusText()}</span>
      </div>
    </div>
  );
};

interface ValidationIndicatorProps {
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  fieldLabels?: Record<string, string>;
}

export const ValidationIndicator: React.FC<ValidationIndicatorProps> = ({
  errors,
  touched,
  fieldLabels = {},
}) => {
  const touchedErrors = Object.entries(errors).filter(([field]) => touched[field]);

  if (touchedErrors.length === 0) return null;

  return (
    <div className="p-3 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-xl animate-slide-in-up">
      <div className="flex items-start gap-2">
        <AlertCircle className="w-5 h-5 text-danger-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-danger-800 dark:text-danger-200">
            Campos com problemas:
          </p>
          <ul className="mt-1 space-y-1">
            {touchedErrors.map(([field, error]) => (
              <li key={field} className="text-sm text-danger-600 dark:text-danger-300">
                <strong>{fieldLabels[field] || field}:</strong> {error}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

interface KeyboardShortcutHintProps {
  shortcuts: Array<{
    keys: string[];
    description: string;
  }>;
}

export const KeyboardShortcutHint: React.FC<KeyboardShortcutHintProps> = ({ shortcuts }) => {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
      {shortcuts.map((shortcut, index) => (
        <div key={index} className="flex items-center gap-1.5">
          <div className="flex items-center gap-0.5">
            {shortcut.keys.map((key, keyIndex) => (
              <React.Fragment key={keyIndex}>
                <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-xs font-mono">
                  {key}
                </kbd>
                {keyIndex < shortcut.keys.length - 1 && <span>+</span>}
              </React.Fragment>
            ))}
          </div>
          <span>{shortcut.description}</span>
        </div>
      ))}
    </div>
  );
};
