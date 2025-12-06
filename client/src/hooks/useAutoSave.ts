import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from '../contexts/ToastContext';

interface AutoSaveOptions<T> {
  data: T;
  onSave: (data: T) => Promise<void>;
  delay?: number;
  enabled?: boolean;
}

interface AutoSaveResult {
  isSaving: boolean;
  lastSaved: Date | null;
  saveNow: () => Promise<void>;
  status: 'idle' | 'saving' | 'saved' | 'error';
}

export function useAutoSave<T>({
  data,
  onSave,
  delay = 3000,
  enabled = true,
}: AutoSaveOptions<T>): AutoSaveResult {
  const toast = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousDataRef = useRef<string>('');

  const saveNow = useCallback(async () => {
    if (isSaving) return;
    
    setIsSaving(true);
    setStatus('saving');
    
    try {
      await onSave(data);
      setLastSaved(new Date());
      setStatus('saved');
      previousDataRef.current = JSON.stringify(data);
    } catch (error) {
      console.error('Auto-save error:', error);
      setStatus('error');
      toast.error('Erro ao salvar automaticamente');
    } finally {
      setIsSaving(false);
    }
  }, [data, onSave, isSaving, toast]);

  useEffect(() => {
    if (!enabled) return;

    const currentDataString = JSON.stringify(data);
    
    if (currentDataString === previousDataRef.current) {
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      saveNow();
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, delay, enabled, saveNow]);

  useEffect(() => {
    previousDataRef.current = JSON.stringify(data);
  }, []);

  return { isSaving, lastSaved, saveNow, status };
}

interface FormValidationRule<T> {
  field: keyof T | string;
  validate: (value: any, data: T) => boolean;
  message: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  setTouched: (field: string) => void;
  validateField: (field: string, value: any) => string | null;
  validateAll: () => boolean;
  clearErrors: () => void;
}

export function useFormValidation<T extends Record<string, any>>(
  data: T,
  rules: FormValidationRule<T>[]
): ValidationResult {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouchedState] = useState<Record<string, boolean>>({});

  const validateField = useCallback((field: string, value: any): string | null => {
    const rule = rules.find(r => r.field === field);
    if (!rule) return null;
    
    const isValid = rule.validate(value, data);
    return isValid ? null : rule.message;
  }, [rules, data]);

  const setTouched = useCallback((field: string) => {
    setTouchedState(prev => ({ ...prev, [field]: true }));
    
    const error = validateField(field, data[field as keyof T]);
    setErrors(prev => {
      if (error) {
        return { ...prev, [field]: error };
      } else {
        const { [field]: _, ...rest } = prev;
        return rest;
      }
    });
  }, [validateField, data]);

  const validateAll = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    const newTouched: Record<string, boolean> = {};
    
    rules.forEach(rule => {
      const field = rule.field as string;
      newTouched[field] = true;
      const value = field.includes('.') 
        ? field.split('.').reduce((obj, key) => obj?.[key], data as any)
        : data[field as keyof T];
      
      if (!rule.validate(value, data)) {
        newErrors[field] = rule.message;
      }
    });

    setErrors(newErrors);
    setTouchedState(newTouched);
    
    return Object.keys(newErrors).length === 0;
  }, [rules, data]);

  const clearErrors = useCallback(() => {
    setErrors({});
    setTouchedState({});
  }, []);

  const isValid = Object.keys(errors).length === 0;

  return {
    isValid,
    errors,
    touched,
    setTouched,
    validateField,
    validateAll,
    clearErrors,
  };
}

export function useKeyboardShortcuts(
  shortcuts: Record<string, () => void>,
  enabled: boolean = true
) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = [
        e.ctrlKey || e.metaKey ? 'ctrl' : '',
        e.shiftKey ? 'shift' : '',
        e.altKey ? 'alt' : '',
        e.key.toLowerCase(),
      ].filter(Boolean).join('+');

      const handler = shortcuts[key];
      if (handler) {
        e.preventDefault();
        handler();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, enabled]);
}

export function useFormProgress<T extends Record<string, any>>(
  data: T,
  requiredFields: (keyof T | string)[]
): number {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let filledCount = 0;
    
    requiredFields.forEach(field => {
      const value = typeof field === 'string' && field.includes('.')
        ? field.split('.').reduce((obj, key) => obj?.[key], data as any)
        : data[field as keyof T];
      
      if (value !== undefined && value !== null && value !== '' && 
          !(Array.isArray(value) && value.length === 0)) {
        filledCount++;
      }
    });

    setProgress(Math.round((filledCount / requiredFields.length) * 100));
  }, [data, requiredFields]);

  return progress;
}
