import React, { forwardRef, useState } from 'react';
import { Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  success?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  success,
  hint,
  leftIcon,
  rightIcon,
  size = 'md',
  type = 'text',
  className = '',
  id,
  ...props
}, ref) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

  const isPassword = type === 'password';
  const inputType = isPassword && showPassword ? 'text' : type;

  const sizes = {
    sm: 'py-1.5 text-sm',
    md: 'py-2.5 text-sm',
    lg: 'py-3 text-base',
  };

  const hasError = !!error;
  const hasSuccess = !!success;

  const borderColor = hasError 
    ? 'border-danger-300 focus:border-danger-500 focus:ring-danger-500/20'
    : hasSuccess
    ? 'border-success-300 focus:border-success-500 focus:ring-success-500/20'
    : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500/20 dark:border-gray-600';

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          className={`
            block text-sm font-medium transition-colors duration-200
            ${isFocused ? 'text-primary-600 dark:text-primary-400' : 'text-gray-700 dark:text-gray-300'}
          `}
        >
          {label}
        </label>
      )}

      <div className="relative group">
        {leftIcon && (
          <div className={`
            absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none
            transition-colors duration-200
            ${isFocused ? 'text-primary-500' : 'text-gray-400'}
          `}>
            {leftIcon}
          </div>
        )}

        <input
          ref={ref}
          id={inputId}
          type={inputType}
          className={`
            block w-full rounded-xl border-2 bg-white dark:bg-gray-800
            ${sizes[size]}
            ${leftIcon ? 'pl-10' : 'pl-4'}
            ${rightIcon || isPassword || hasError || hasSuccess ? 'pr-10' : 'pr-4'}
            ${borderColor}
            input-premium
            placeholder:text-gray-400 dark:placeholder:text-gray-500
            text-gray-900 dark:text-gray-100
            focus:outline-none focus:ring-4
            transition-all duration-200
          `}
          onFocus={(e) => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
          {...props}
        />

        <div className="absolute inset-y-0 right-0 pr-3 flex items-center gap-1">
          {hasError && !isPassword && (
            <AlertCircle className="w-5 h-5 text-danger-500" />
          )}
          {hasSuccess && !isPassword && !hasError && (
            <CheckCircle className="w-5 h-5 text-success-500" />
          )}
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          )}
          {rightIcon && !isPassword && !hasError && !hasSuccess && (
            <span className="text-gray-400">{rightIcon}</span>
          )}
        </div>
      </div>

      {(error || success || hint) && (
        <p className={`
          text-sm flex items-center gap-1.5 animate-fade-in
          ${hasError ? 'text-danger-600' : hasSuccess ? 'text-success-600' : 'text-gray-500'}
        `}>
          {error || success || hint}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  success?: string;
  hint?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({
  label,
  error,
  success,
  hint,
  size = 'md',
  className = '',
  id,
  ...props
}, ref) => {
  const [isFocused, setIsFocused] = useState(false);
  const inputId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;

  const hasError = !!error;
  const hasSuccess = !!success;

  const borderColor = hasError 
    ? 'border-danger-300 focus:border-danger-500 focus:ring-danger-500/20'
    : hasSuccess
    ? 'border-success-300 focus:border-success-500 focus:ring-success-500/20'
    : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500/20 dark:border-gray-600';

  const sizes = {
    sm: 'py-1.5 px-3 text-sm min-h-[80px]',
    md: 'py-2.5 px-4 text-sm min-h-[120px]',
    lg: 'py-3 px-4 text-base min-h-[160px]',
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          className={`
            block text-sm font-medium transition-colors duration-200
            ${isFocused ? 'text-primary-600 dark:text-primary-400' : 'text-gray-700 dark:text-gray-300'}
          `}
        >
          {label}
        </label>
      )}

      <textarea
        ref={ref}
        id={inputId}
        className={`
          block w-full rounded-xl border-2 bg-white dark:bg-gray-800
          ${sizes[size]}
          ${borderColor}
          input-premium
          placeholder:text-gray-400 dark:placeholder:text-gray-500
          text-gray-900 dark:text-gray-100
          focus:outline-none focus:ring-4
          transition-all duration-200 resize-y
        `}
        onFocus={(e) => {
          setIsFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          props.onBlur?.(e);
        }}
        {...props}
      />

      {(error || success || hint) && (
        <p className={`
          text-sm flex items-center gap-1.5 animate-fade-in
          ${hasError ? 'text-danger-600' : hasSuccess ? 'text-success-600' : 'text-gray-500'}
        `}>
          {error || success || hint}
        </p>
      )}
    </div>
  );
});

Textarea.displayName = 'Textarea';

export default Input;
