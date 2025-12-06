import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'primary' | 'white';
  text?: string;
  fullScreen?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  variant = 'primary',
  text,
  fullScreen = false,
}) => {
  const sizes = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
    xl: 'w-16 h-16 border-4',
  };

  const colors = {
    default: 'border-gray-200 border-t-gray-600',
    primary: 'border-primary-100 border-t-primary-600',
    white: 'border-white/30 border-t-white',
  };

  const spinner = (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <div
          className={`
            ${sizes[size]} ${colors[variant]}
            rounded-full animate-spin
          `}
        />
        <div
          className={`
            absolute inset-0 ${sizes[size]}
            rounded-full animate-ping opacity-20
            ${variant === 'primary' ? 'bg-primary-500' : 
              variant === 'white' ? 'bg-white' : 'bg-gray-500'}
          `}
          style={{ animationDuration: '2s' }}
        />
      </div>
      {text && (
        <p className={`
          text-sm font-medium animate-pulse
          ${variant === 'white' ? 'text-white' : 'text-gray-600'}
        `}>
          {text}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
        {spinner}
      </div>
    );
  }

  return spinner;
};

interface LoadingOverlayProps {
  isLoading: boolean;
  text?: string;
  children: React.ReactNode;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isLoading,
  text,
  children,
}) => {
  return (
    <div className="relative">
      {children}
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm rounded-lg animate-fade-in">
          <LoadingSpinner size="lg" text={text} />
        </div>
      )}
    </div>
  );
};

export const SkeletonLoader: React.FC<{
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
}> = ({ className = '', variant = 'text', width, height }) => {
  const baseStyles = 'skeleton';
  
  const variants = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={`${baseStyles} ${variants[variant]} ${className}`}
      style={style}
    />
  );
};

export const PageLoader: React.FC<{ message?: string }> = ({ message = 'Carregando...' }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-secondary-50 dark:from-gray-900 dark:to-gray-800">
      <div className="text-center animate-fade-in-up">
        <div className="relative inline-flex">
          <div className="w-16 h-16 border-4 border-primary-200 dark:border-primary-800 rounded-full animate-spin border-t-primary-600 dark:border-t-primary-400" />
          <div className="absolute inset-0 w-16 h-16 border-4 border-transparent rounded-full animate-ping opacity-20 bg-primary-500" style={{ animationDuration: '2s' }} />
        </div>
        <p className="mt-4 text-gray-600 dark:text-gray-300 font-medium animate-pulse">
          {message}
        </p>
      </div>
    </div>
  );
};

export default LoadingSpinner;
