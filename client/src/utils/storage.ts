import { ImpactAnalysis } from '../types';
import { v4 as uuidv4 } from 'uuid';

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
    
    console.log('[Storage] Analysis saved to database:', analysis.id);
  } catch (error) {
    console.error('[Storage] Error saving analysis:', error);
    throw error;
  }
};

export const getStoredAnalyses = async (): Promise<ImpactAnalysis[]> => {
  const token = getAuthToken();
  if (!token) {
    return [];
  }
  
  try {
    const response = await fetch('/api/analyses/list/all', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch analyses');
    }
    
    const analyses = await response.json();
    console.log('[Storage] Loaded', analyses.length, 'analyses from database');
    return analyses;
  } catch (error) {
    console.error('[Storage] Error loading analyses:', error);
    return [];
  }
};

export const getAnalysisById = async (id: string): Promise<ImpactAnalysis | null> => {
  const token = getAuthToken();
  if (!token) {
    return null;
  }
  
  try {
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
    
    const analysis = await response.json();
    console.log('[Storage] Loaded analysis from database:', id);
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
    
    console.log('[Storage] Analysis deleted from database:', id);
  } catch (error) {
    console.error('[Storage] Error deleting analysis:', error);
    throw error;
  }
};

export const generateNewId = (): string => {
  return uuidv4();
};
