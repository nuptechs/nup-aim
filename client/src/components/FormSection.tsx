import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface FormSectionProps {
  title: string;
  children: React.ReactNode;
  isCollapsed?: boolean;
  onToggle?: () => void;
  required?: boolean;
}

export const FormSection: React.FC<FormSectionProps> = ({
  title,
  children,
  isCollapsed = false,
  onToggle,
  required = false
}) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div
        className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 cursor-pointer flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
        onClick={onToggle}
      >
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
          {title}
          {required && <span className="text-red-500 ml-1">*</span>}
        </h3>
        {onToggle && (
          <div className="text-gray-400 dark:text-gray-500">
            {isCollapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <ChevronDown className="w-5 h-5" />
            )}
          </div>
        )}
      </div>
      {!isCollapsed && (
        <div className="p-6 bg-white dark:bg-gray-800">
          {children}
        </div>
      )}
    </div>
  );
};