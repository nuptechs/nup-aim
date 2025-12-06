import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface ThemeToggleProps {
  variant?: 'button' | 'dropdown';
  size?: 'sm' | 'md';
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ 
  variant = 'button',
  size = 'md' 
}) => {
  const { theme, setTheme, isDark, toggleTheme } = useTheme();
  const [isOpen, setIsOpen] = React.useState(false);

  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
  };

  if (variant === 'button') {
    return (
      <button
        onClick={toggleTheme}
        className={`
          ${sizes[size]}
          relative inline-flex items-center justify-center
          rounded-xl bg-gray-100 dark:bg-gray-800
          text-gray-600 dark:text-gray-400
          hover:bg-gray-200 dark:hover:bg-gray-700
          hover:text-gray-900 dark:hover:text-gray-100
          transition-all duration-300 ease-out
          focus-ring overflow-hidden
        `}
        aria-label={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
      >
        <div className="relative w-full h-full flex items-center justify-center">
          <Sun
            className={`
              ${iconSizes[size]} absolute
              transition-all duration-500 ease-out
              ${isDark 
                ? 'rotate-90 scale-0 opacity-0' 
                : 'rotate-0 scale-100 opacity-100'
              }
            `}
          />
          <Moon
            className={`
              ${iconSizes[size]} absolute
              transition-all duration-500 ease-out
              ${isDark 
                ? 'rotate-0 scale-100 opacity-100' 
                : '-rotate-90 scale-0 opacity-0'
              }
            `}
          />
        </div>
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          ${sizes[size]}
          relative inline-flex items-center justify-center
          rounded-xl bg-gray-100 dark:bg-gray-800
          text-gray-600 dark:text-gray-400
          hover:bg-gray-200 dark:hover:bg-gray-700
          transition-all duration-200
          focus-ring
        `}
        aria-label="Opções de tema"
      >
        {theme === 'light' && <Sun className={iconSizes[size]} />}
        {theme === 'dark' && <Moon className={iconSizes[size]} />}
        {theme === 'system' && <Monitor className={iconSizes[size]} />}
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)} 
          />
          <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 rounded-xl shadow-medium border border-gray-200 dark:border-gray-700 z-50 animate-scale-in origin-top-right overflow-hidden">
            <div className="py-1">
              <button
                onClick={() => { setTheme('light'); setIsOpen(false); }}
                className={`
                  w-full flex items-center gap-3 px-4 py-2.5 text-sm
                  transition-colors
                  ${theme === 'light' 
                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400' 
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }
                `}
              >
                <Sun className="w-4 h-4" />
                <span>Claro</span>
              </button>
              <button
                onClick={() => { setTheme('dark'); setIsOpen(false); }}
                className={`
                  w-full flex items-center gap-3 px-4 py-2.5 text-sm
                  transition-colors
                  ${theme === 'dark' 
                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400' 
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }
                `}
              >
                <Moon className="w-4 h-4" />
                <span>Escuro</span>
              </button>
              <button
                onClick={() => { setTheme('system'); setIsOpen(false); }}
                className={`
                  w-full flex items-center gap-3 px-4 py-2.5 text-sm
                  transition-colors
                  ${theme === 'system' 
                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400' 
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }
                `}
              >
                <Monitor className="w-4 h-4" />
                <span>Sistema</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ThemeToggle;
