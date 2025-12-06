import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  size?: 'sm' | 'md' | 'lg';
  dot?: boolean;
  icon?: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  dot = false,
  icon,
  className = '',
}) => {
  const variants = {
    primary: 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 ring-primary-500/20',
    secondary: 'bg-secondary-100 dark:bg-secondary-900/30 text-secondary-700 dark:text-secondary-300 ring-secondary-500/20',
    success: 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-300 ring-success-500/20',
    warning: 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-300 ring-warning-500/20',
    danger: 'bg-danger-100 dark:bg-danger-900/30 text-danger-700 dark:text-danger-300 ring-danger-500/20',
    info: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-blue-500/20',
    neutral: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 ring-gray-500/20',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  };

  const dotColors = {
    primary: 'bg-primary-500',
    secondary: 'bg-secondary-500',
    success: 'bg-success-500',
    warning: 'bg-warning-500',
    danger: 'bg-danger-500',
    info: 'bg-blue-500',
    neutral: 'bg-gray-500',
  };

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 font-medium rounded-full
        ring-1 ring-inset
        ${variants[variant]}
        ${sizes[size]}
        ${className}
      `}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]} animate-pulse`} />
      )}
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </span>
  );
};

interface StatusBadgeProps {
  status: 'online' | 'offline' | 'busy' | 'away' | 'pending' | 'active' | 'inactive';
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  showLabel = true,
  size = 'md',
}) => {
  const statusConfig = {
    online: { color: 'bg-success-500', label: 'Online', variant: 'success' as const },
    offline: { color: 'bg-gray-400', label: 'Offline', variant: 'neutral' as const },
    busy: { color: 'bg-danger-500', label: 'Ocupado', variant: 'danger' as const },
    away: { color: 'bg-warning-500', label: 'Ausente', variant: 'warning' as const },
    pending: { color: 'bg-warning-500', label: 'Pendente', variant: 'warning' as const },
    active: { color: 'bg-success-500', label: 'Ativo', variant: 'success' as const },
    inactive: { color: 'bg-gray-400', label: 'Inativo', variant: 'neutral' as const },
  };

  const config = statusConfig[status];

  if (!showLabel) {
    return (
      <span className="relative inline-flex">
        <span className={`w-2.5 h-2.5 rounded-full ${config.color}`} />
        {(status === 'online' || status === 'active') && (
          <span className={`absolute inset-0 w-2.5 h-2.5 rounded-full ${config.color} animate-ping opacity-75`} />
        )}
      </span>
    );
  }

  return (
    <Badge variant={config.variant} size={size} dot>
      {config.label}
    </Badge>
  );
};

export default Badge;
