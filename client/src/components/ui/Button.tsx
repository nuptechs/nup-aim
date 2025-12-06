import React from 'react';
import { LoadingSpinner } from './LoadingSpinner';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  loadingText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  loadingText,
  leftIcon,
  rightIcon,
  fullWidth = false,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = `
    relative inline-flex items-center justify-center font-medium
    rounded-xl transition-all duration-200 ease-out
    focus-ring btn-premium
    disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
  `;

  const variants = {
    primary: `
      bg-gradient-to-r from-primary-500 to-primary-600 text-white
      hover:from-primary-600 hover:to-primary-700
      active:from-primary-700 active:to-primary-800
      shadow-lg shadow-primary-500/25 hover:shadow-xl hover:shadow-primary-500/30
    `,
    secondary: `
      bg-gradient-to-r from-secondary-500 to-secondary-600 text-white
      hover:from-secondary-600 hover:to-secondary-700
      active:from-secondary-700 active:to-secondary-800
      shadow-lg shadow-secondary-500/25 hover:shadow-xl hover:shadow-secondary-500/30
    `,
    success: `
      bg-gradient-to-r from-success-500 to-success-600 text-white
      hover:from-success-600 hover:to-success-700
      active:from-success-700 active:to-success-800
      shadow-lg shadow-success-500/25 hover:shadow-xl hover:shadow-success-500/30
    `,
    danger: `
      bg-gradient-to-r from-danger-500 to-danger-600 text-white
      hover:from-danger-600 hover:to-danger-700
      active:from-danger-700 active:to-danger-800
      shadow-lg shadow-danger-500/25 hover:shadow-xl hover:shadow-danger-500/30
    `,
    warning: `
      bg-gradient-to-r from-warning-400 to-warning-500 text-white
      hover:from-warning-500 hover:to-warning-600
      active:from-warning-600 active:to-warning-700
      shadow-lg shadow-warning-500/25 hover:shadow-xl hover:shadow-warning-500/30
    `,
    ghost: `
      bg-transparent text-gray-700 dark:text-gray-300
      hover:bg-gray-100 dark:hover:bg-gray-800
      active:bg-gray-200 dark:active:bg-gray-700
    `,
    outline: `
      bg-transparent border-2 border-gray-300 dark:border-gray-600
      text-gray-700 dark:text-gray-300
      hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-500
      active:bg-gray-100 dark:active:bg-gray-700
    `,
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm gap-1.5',
    md: 'px-4 py-2.5 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2.5',
  };

  return (
    <button
      className={`
        ${baseStyles}
        ${variants[variant]}
        ${sizes[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <LoadingSpinner size="sm" variant="white" />
          <span>{loadingText || children}</span>
        </>
      ) : (
        <>
          {leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
          <span>{children}</span>
          {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
        </>
      )}
    </button>
  );
};

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  'aria-label': string;
}

export const IconButton: React.FC<IconButtonProps> = ({
  children,
  variant = 'ghost',
  size = 'md',
  isLoading = false,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = `
    relative inline-flex items-center justify-center
    rounded-xl transition-all duration-200 ease-out
    focus-ring
    disabled:opacity-50 disabled:cursor-not-allowed
  `;

  const variants = {
    primary: `
      bg-primary-500 text-white
      hover:bg-primary-600 active:bg-primary-700
    `,
    secondary: `
      bg-secondary-500 text-white
      hover:bg-secondary-600 active:bg-secondary-700
    `,
    ghost: `
      bg-transparent text-gray-600 dark:text-gray-400
      hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100
      active:bg-gray-200 dark:active:bg-gray-700
    `,
    danger: `
      bg-transparent text-danger-600
      hover:bg-danger-50 dark:hover:bg-danger-900/20
      active:bg-danger-100 dark:active:bg-danger-900/30
    `,
  };

  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };

  return (
    <button
      className={`
        ${baseStyles}
        ${variants[variant]}
        ${sizes[size]}
        ${className}
      `}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? <LoadingSpinner size="sm" /> : children}
    </button>
  );
};

export default Button;
