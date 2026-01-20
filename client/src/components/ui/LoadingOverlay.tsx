import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingOverlayProps {
  isVisible: boolean;
  message?: string;
  variant?: 'overlay' | 'inline' | 'spinner';
}

export function LoadingOverlay({ 
  isVisible, 
  message = 'Carregando...', 
  variant = 'overlay' 
}: LoadingOverlayProps) {
  if (!isVisible) return null;

  if (variant === 'spinner') {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
        {message && <span className="ml-2 text-gray-600 dark:text-gray-400">{message}</span>}
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800">
        <Loader2 className="w-4 h-4 animate-spin text-primary-600" />
        <span className="text-sm text-primary-700 dark:text-primary-300">{message}</span>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center transition-opacity duration-200">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 flex items-center gap-4 max-w-sm mx-4">
        <div className="relative">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          <div className="absolute inset-0 w-8 h-8 rounded-full border-2 border-primary-200 dark:border-primary-800"></div>
        </div>
        <div>
          <p className="font-medium text-gray-900 dark:text-gray-100">{message}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Por favor, aguarde...</p>
        </div>
      </div>
    </div>
  );
}

export function LoadingSpinner({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <Loader2 className={`animate-spin text-primary-600 ${sizeClasses[size]} ${className}`} />
  );
}

export function ContentLoader({ lines = 3 }: { lines?: number }) {
  return (
    <div className="animate-pulse space-y-3">
      {Array.from({ length: lines }).map((_, i) => (
        <div 
          key={i} 
          className="h-4 bg-gray-200 dark:bg-gray-700 rounded"
          style={{ width: `${Math.max(40, 100 - i * 15)}%` }}
        />
      ))}
    </div>
  );
}
