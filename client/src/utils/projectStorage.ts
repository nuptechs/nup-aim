import { Project } from '../types';
import { v4 as uuidv4 } from 'uuid';

const getAuthToken = (): string | null => {
  return localStorage.getItem('nup_aim_auth_token');
};

export const getStoredProjects = async (): Promise<Project[]> => {
  const token = getAuthToken();
  if (!token) {
    return [];
  }
  
  try {
    const response = await fetch('/api/projects', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch projects');
    }
    
    const projects = await response.json();
    
    // Transform from DB format to frontend format
    const result = projects.map((p: any) => ({
      id: p.id,
      name: p.name,
      acronym: p.acronym,
      isDefault: p.isDefault,
      createdAt: p.createdAt
    }));
    
    console.log('[ProjectStorage] Loaded', result.length, 'projects from database');
    return result;
  } catch (error) {
    console.error('[ProjectStorage] Error loading projects:', error);
    return [];
  }
};

export const saveProject = async (project: Project): Promise<void> => {
  const token = getAuthToken();
  if (!token) {
    console.error('No auth token available');
    return;
  }
  
  try {
    // Check if project exists
    const existingProjects = await getStoredProjects();
    const exists = existingProjects.some(p => p.id === project.id);
    
    const url = exists ? `/api/projects/${project.id}` : '/api/projects';
    const method = exists ? 'PUT' : 'POST';
    
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name: project.name,
        acronym: project.acronym,
        isDefault: project.isDefault
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to save project');
    }
    
    console.log('[ProjectStorage] Project saved to database:', project.id);
  } catch (error) {
    console.error('[ProjectStorage] Error saving project:', error);
    throw error;
  }
};

export const deleteProject = async (id: string): Promise<boolean> => {
  const token = getAuthToken();
  if (!token) {
    console.error('No auth token available');
    return false;
  }
  
  try {
    const response = await fetch(`/api/projects/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.error('[ProjectStorage] Delete failed:', error.error);
      return false;
    }
    
    console.log('[ProjectStorage] Project deleted from database:', id);
    return true;
  } catch (error) {
    console.error('[ProjectStorage] Error deleting project:', error);
    return false;
  }
};

export const getDefaultProject = async (): Promise<Project | null> => {
  const projects = await getStoredProjects();
  return projects.find(p => p.isDefault) || projects[0] || null;
};

export const generateProjectId = (): string => {
  return uuidv4();
};
