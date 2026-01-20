import { ImpactAnalysis } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { globalCache, CACHE_KEYS } from '../hooks/useDataCache';

const getAuthToken = (): string | null => {
  return localStorage.getItem('nup_aim_auth_token');
};

export const saveAnalysis = async (analysis: ImpactAnalysis): Promise<void> => {
  const token = getAuthToken();
  if (!token) {
    console.error('No auth token available');
    return;
  }
  
  try {
    const response = await fetch(`/api/analyses/${analysis.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(analysis)
    });
    
    if (!response.ok) {
      throw new Error('Failed to save analysis');
    }
    
    globalCache.set(CACHE_KEYS.ANALYSIS_DETAIL(analysis.id), analysis);
    globalCache.invalidate(CACHE_KEYS.ANALYSES_LIST);
    
    console.log('[Storage] Analysis saved to database:', analysis.id);
  } catch (error) {
    console.error('[Storage] Error saving analysis:', error);
    throw error;
  }
};

export const getStoredAnalyses = async (forceRefresh = false): Promise<ImpactAnalysis[]> => {
  const token = getAuthToken();
  if (!token) {
    return [];
  }
  
  const fetcher = async () => {
    const response = await fetch('/api/analyses/list/all', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch analyses');
    }
    
    return response.json();
  };
  
  try {
    const { data: analyses, fromCache } = await globalCache.getOrFetch<ImpactAnalysis[]>(
      CACHE_KEYS.ANALYSES_LIST,
      fetcher,
      { forceRefresh }
    );
    console.log('[Storage] Loaded', analyses.length, 'analyses', fromCache ? '(from cache)' : 'from database');
    return analyses;
  } catch (error) {
    console.error('[Storage] Error loading analyses:', error);
    return [];
  }
};

export const getAnalysisById = async (id: string, forceRefresh = false): Promise<ImpactAnalysis | null> => {
  const token = getAuthToken();
  if (!token) {
    return null;
  }
  
  const fetcher = async () => {
    const response = await fetch(`/api/analyses/${id}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error('Failed to fetch analysis');
    }
    
    return response.json();
  };
  
  try {
    const { data: analysis, fromCache } = await globalCache.getOrFetch<ImpactAnalysis | null>(
      CACHE_KEYS.ANALYSIS_DETAIL(id),
      fetcher,
      { forceRefresh }
    );
    console.log('[Storage] Loaded analysis:', id, fromCache ? '(from cache)' : 'from database');
    return analysis;
  } catch (error) {
    console.error('[Storage] Error loading analysis:', error);
    return null;
  }
};

export const deleteAnalysis = async (id: string): Promise<void> => {
  const token = getAuthToken();
  if (!token) {
    console.error('No auth token available');
    return;
  }
  
  try {
    const response = await fetch(`/api/analyses/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete analysis');
    }
    
    globalCache.invalidate(CACHE_KEYS.ANALYSIS_DETAIL(id));
    globalCache.invalidate(CACHE_KEYS.ANALYSES_LIST);
    
    console.log('[Storage] Analysis deleted from database:', id);
  } catch (error) {
    console.error('[Storage] Error deleting analysis:', error);
    throw error;
  }
};

export const invalidateAnalysesCache = (): void => {
  globalCache.invalidate(CACHE_KEYS.ANALYSES_LIST);
};

export const invalidateAnalysisCache = (id: string): void => {
  globalCache.invalidate(CACHE_KEYS.ANALYSIS_DETAIL(id));
};

export const generateNewId = (): string => {
  return uuidv4();
};
