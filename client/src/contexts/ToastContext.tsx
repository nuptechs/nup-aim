import React, { createContext, useContext, useState, useCallback } from 'react';
import { ToastContainer, ToastMessage, ToastType } from '../components/ui/Toast';

interface ToastContextType {
  showToast: (options: Omit<ToastMessage, 'id'>) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  ai: (title: string, message?: string) => void;
  dismissToast: (id: string) => void;
  dismissAll: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((options: Omit<ToastMessage, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const toast: ToastMessage = { ...options, id };
    
    setToasts((prev) => [...prev, toast]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  const createQuickToast = (type: ToastType) => (title: string, message?: string) => {
    showToast({ type, title, message });
  };

  const value: ToastContextType = {
    showToast,
    success: createQuickToast('success'),
    error: createQuickToast('error'),
    warning: createQuickToast('warning'),
    info: createQuickToast('info'),
    ai: createQuickToast('ai'),
    dismissToast,
    dismissAll,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export default ToastContext;
