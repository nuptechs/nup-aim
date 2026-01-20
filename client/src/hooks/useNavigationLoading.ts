import { useState, useCallback, createContext, useContext, ReactNode } from 'react';
import React from 'react';

interface NavigationLoadingContextType {
  isNavigating: boolean;
  navigationTarget: string | null;
  startNavigation: (target: string) => void;
  endNavigation: () => void;
}

const NavigationLoadingContext = createContext<NavigationLoadingContextType | null>(null);

export function NavigationLoadingProvider({ children }: { children: ReactNode }) {
  const [isNavigating, setIsNavigating] = useState(false);
  const [navigationTarget, setNavigationTarget] = useState<string | null>(null);

  const startNavigation = useCallback((target: string) => {
    setIsNavigating(true);
    setNavigationTarget(target);
  }, []);

  const endNavigation = useCallback(() => {
    setIsNavigating(false);
    setNavigationTarget(null);
  }, []);

  return React.createElement(
    NavigationLoadingContext.Provider,
    { value: { isNavigating, navigationTarget, startNavigation, endNavigation } },
    children
  );
}

export function useNavigationLoading() {
  const context = useContext(NavigationLoadingContext);
  if (!context) {
    return {
      isNavigating: false,
      navigationTarget: null,
      startNavigation: () => {},
      endNavigation: () => {},
    };
  }
  return context;
}

export function useNavigateWithLoading<T>(
  action: () => Promise<T>,
  target: string
): { execute: () => Promise<T | undefined>; isLoading: boolean } {
  const { isNavigating, navigationTarget, startNavigation, endNavigation } = useNavigationLoading();
  
  const execute = useCallback(async () => {
    startNavigation(target);
    try {
      const result = await action();
      return result;
    } finally {
      endNavigation();
    }
  }, [action, target, startNavigation, endNavigation]);

  return {
    execute,
    isLoading: isNavigating && navigationTarget === target,
  };
}
