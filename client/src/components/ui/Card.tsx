import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'glass' | 'bordered' | 'elevated';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  variant = 'default',
  padding = 'md',
  hover = false,
  onClick,
}) => {
  const variants = {
    default: 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-soft',
    glass: 'glass-card',
    bordered: 'bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700',
    elevated: 'bg-white dark:bg-gray-800 shadow-medium',
  };

  const paddings = {
    none: 'p-0',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  const hoverStyles = hover
    ? 'cursor-pointer card-hover hover:border-primary-200 dark:hover:border-primary-700'
    : '';

  return (
    <div
      className={`
        rounded-2xl
        ${variants[variant]}
        ${paddings[padding]}
        ${hoverStyles}
        ${className}
      `}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
};

interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  children,
  className = '',
  action,
}) => {
  return (
    <div className={`flex items-center justify-between mb-4 ${className}`}>
      <div>{children}</div>
      {action && <div>{action}</div>}
    </div>
  );
};

export const CardTitle: React.FC<{
  children: React.ReactNode;
  className?: string;
  as?: 'h1' | 'h2' | 'h3' | 'h4';
}> = ({ children, className = '', as: Component = 'h3' }) => {
  return (
    <Component className={`text-lg font-semibold text-gray-900 dark:text-gray-100 ${className}`}>
      {children}
    </Component>
  );
};

export const CardDescription: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  return (
    <p className={`text-sm text-gray-500 dark:text-gray-400 mt-1 ${className}`}>
      {children}
    </p>
  );
};

export const CardContent: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  return <div className={className}>{children}</div>;
};

export const CardFooter: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  return (
    <div className={`flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 ${className}`}>
      {children}
    </div>
  );
};

interface StatCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    type: 'increase' | 'decrease' | 'neutral';
  };
  icon?: React.ReactNode;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  change,
  icon,
  color = 'primary',
}) => {
  const colors = {
    primary: 'from-primary-500 to-primary-600',
    secondary: 'from-secondary-500 to-secondary-600',
    success: 'from-success-500 to-success-600',
    warning: 'from-warning-400 to-warning-500',
    danger: 'from-danger-500 to-danger-600',
  };

  const iconBg = {
    primary: 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400',
    secondary: 'bg-secondary-100 dark:bg-secondary-900/30 text-secondary-600 dark:text-secondary-400',
    success: 'bg-success-100 dark:bg-success-900/30 text-success-600 dark:text-success-400',
    warning: 'bg-warning-100 dark:bg-warning-900/30 text-warning-600 dark:text-warning-400',
    danger: 'bg-danger-100 dark:bg-danger-900/30 text-danger-600 dark:text-danger-400',
  };

  const changeColors = {
    increase: 'text-success-600 bg-success-50 dark:bg-success-900/20',
    decrease: 'text-danger-600 bg-danger-50 dark:bg-danger-900/20',
    neutral: 'text-gray-600 bg-gray-100 dark:bg-gray-800',
  };

  return (
    <Card className="relative overflow-hidden card-hover">
      <div className={`absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 rounded-full bg-gradient-to-br ${colors[color]} opacity-10`} />
      
      <div className="relative flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
          
          {change && (
            <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mt-2 ${changeColors[change.type]}`}>
              <span>
                {change.type === 'increase' ? '+' : change.type === 'decrease' ? '-' : ''}
                {Math.abs(change.value)}%
              </span>
            </div>
          )}
        </div>

        {icon && (
          <div className={`flex-shrink-0 p-3 rounded-xl ${iconBg[color]}`}>
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
};

export default Card;
