import { useState, useCallback, useRef } from 'react';

interface OptimisticUpdateOptions<T, R = T> {
  onMutate: (data: T) => Promise<R>;
  onSuccess?: (result: R, data: T) => void;
  onError?: (error: Error, data: T, rollbackData: T | null) => void;
  onSettled?: () => void;
}

interface UseOptimisticUpdateResult<T, R = T> {
  mutate: (data: T, optimisticData?: Partial<T>) => Promise<R | undefined>;
  isLoading: boolean;
  error: Error | null;
  reset: () => void;
}

export function useOptimisticUpdate<T, R = T>({
  onMutate,
  onSuccess,
  onError,
  onSettled,
}: OptimisticUpdateOptions<T, R>): UseOptimisticUpdateResult<T, R> {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const rollbackRef = useRef<T | null>(null);

  const mutate = useCallback(async (data: T, _optimisticData?: Partial<T>): Promise<R | undefined> => {
    setIsLoading(true);
    setError(null);
    rollbackRef.current = data;

    try {
      const result = await onMutate(data);
      onSuccess?.(result, data);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      onError?.(error, data, rollbackRef.current);
      return undefined;
    } finally {
      setIsLoading(false);
      rollbackRef.current = null;
      onSettled?.();
    }
  }, [onMutate, onSuccess, onError, onSettled]);

  const reset = useCallback(() => {
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    mutate,
    isLoading,
    error,
    reset,
  };
}

export function createOptimisticList<T extends { id: string }>(
  currentList: T[],
  action: 'add' | 'update' | 'delete',
  item: T | string
): T[] {
  switch (action) {
    case 'add':
      return [...currentList, item as T];
    case 'update':
      return currentList.map(i => i.id === (item as T).id ? item as T : i);
    case 'delete':
      return currentList.filter(i => i.id !== (typeof item === 'string' ? item : item.id));
    default:
      return currentList;
  }
}
