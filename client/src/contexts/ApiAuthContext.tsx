import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthContextType, User, Profile, Permission } from '../types/auth';
import { apiClient } from '../lib/apiClient';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

// Session configuration
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds
const ACTIVITY_CHECK_INTERVAL = 60 * 1000; // Check activity every 1 minute
const LAST_ACTIVITY_KEY = 'nup_aim_last_activity';

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Function to update last activity
  const updateLastActivity = () => {
    const now = Date.now();
    localStorage.setItem(LAST_ACTIVITY_KEY, now.toString());
  };

  // Function to check if session has expired
  const isSessionExpired = (): boolean => {
    const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
    if (!lastActivity) return true;
    
    const timeSinceLastActivity = Date.now() - parseInt(lastActivity);
    return timeSinceLastActivity > SESSION_TIMEOUT;
  };

  // Function to completely clear session
  const clearSession = () => {
    apiClient.logout(); // This removes the auth token
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    localStorage.removeItem('nup_aim_current_user');
    localStorage.removeItem('nup_aim_current_profile');
    setUser(null);
    setProfile(null);
  };

  // Function to check and clear expired session
  const checkSessionExpiry = () => {
    if (user && isSessionExpired()) {
      console.log('🕐 Session expired due to inactivity');
      clearSession();
      alert('Sua sessão expirou por inatividade. Faça login novamente.');
    }
  };

  // Set up activity listeners
  useEffect(() => {
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    const handleActivity = () => {
      if (user) {
        updateLastActivity();
      }
    };

    // Add activity listeners
    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    // Check session expiry periodically
    const sessionCheckInterval = setInterval(checkSessionExpiry, ACTIVITY_CHECK_INTERVAL);

    // Cleanup
    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
      clearInterval(sessionCheckInterval);
    };
  }, [user]);

  // Check existing session on load
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Check if there's a valid token
        const token = localStorage.getItem('nup_aim_auth_token');
        if (!token) {
          setIsLoading(false);
          return;
        }

        // Check if session hasn't expired
        if (isSessionExpired()) {
          console.log('🕐 Session expired, clearing data');
          clearSession();
          setIsLoading(false);
          return;
        }

        // Try to get current user data from localStorage
        const currentUser = localStorage.getItem('nup_aim_current_user');
        const savedProfile = localStorage.getItem('nup_aim_current_profile');
        
        if (currentUser) {
          const userData = JSON.parse(currentUser);
          setUser(userData);
          
          // Use saved profile or fallback to default
          let userProfile: Profile;
          if (savedProfile) {
            userProfile = JSON.parse(savedProfile);
            console.log('🔄 Session restored with profile:', userProfile.name);
          } else {
            // Fallback to basic user profile
            userProfile = {
              id: 'default-user-profile',
              name: 'Usuário Padrão',
              description: 'Perfil de usuário com acesso básico',
              isDefault: true,
              createdAt: new Date().toISOString(),
              permissions: [
                { id: '1', module: 'ANALYSIS', action: 'VIEW', allowed: true },
                { id: '2', module: 'ANALYSIS', action: 'CREATE', allowed: true },
                { id: '3', module: 'ANALYSIS', action: 'EDIT', allowed: true },
                { id: '4', module: 'PROJECTS', action: 'VIEW', allowed: true },
              ]
            };
            console.log('⚠️ No saved profile, using default');
          }
          
          setProfile(userProfile);
          updateLastActivity();
          console.log('🔄 Session restored for:', userData.username);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        clearSession();
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; message?: string }> => {
    console.log('🔐 Starting login process...');
    console.log('👤 User:', email);
    
    try {
      // Use API client to authenticate
      const response = await apiClient.login(email, password);
      
      if (response.success && response.data) {
        console.log('✅ Authentication successful');
        
        const userData = response.data.user;
        setUser(userData);
        
        // Use profile from API response
        const apiProfile = response.data.profile;
        let userProfile: Profile;
        
        if (apiProfile) {
          // Convert API permissions array to Permission objects
          const permissionsList: Permission[] = [];
          const apiPermissions = apiProfile.permissions || [];
          
          apiPermissions.forEach((perm: string, index: number) => {
            // Parse permission string like "ANALYSIS_VIEW" or "PROJECTS_MANAGE"
            const parts = perm.split('_');
            if (parts.length >= 2) {
              const module = parts[0];
              const action = parts.slice(1).join('_');
              permissionsList.push({
                id: String(index + 1),
                module: module,
                action: action,
                allowed: true
              });
            }
          });
          
          userProfile = {
            id: apiProfile.id,
            name: apiProfile.name,
            description: apiProfile.description || '',
            isDefault: apiProfile.isDefault || false,
            createdAt: new Date().toISOString(),
            permissions: permissionsList
          };
          console.log('📋 Profile loaded from API:', apiProfile.name);
        } else {
          // Fallback to basic user profile if no profile returned
          userProfile = {
            id: 'default-user-profile',
            name: 'Usuário Padrão',
            description: 'Perfil de usuário com acesso básico',
            isDefault: true,
            createdAt: new Date().toISOString(),
            permissions: [
              { id: '1', module: 'ANALYSIS', action: 'VIEW', allowed: true },
              { id: '2', module: 'ANALYSIS', action: 'CREATE', allowed: true },
              { id: '3', module: 'ANALYSIS', action: 'EDIT', allowed: true },
              { id: '4', module: 'PROJECTS', action: 'VIEW', allowed: true },
            ]
          };
          console.log('⚠️ No profile from API, using default user profile');
        }
        
        setProfile(userProfile);
        
        // Store user data and profile for session persistence
        localStorage.setItem('nup_aim_current_user', JSON.stringify(userData));
        localStorage.setItem('nup_aim_current_profile', JSON.stringify(userProfile));
        updateLastActivity();
        
        return { success: true };
      }
      
      console.log('❌ Invalid credentials');
      return { 
        success: false, 
        message: response.error || 'Usuário ou senha inválidos' 
      };
      
    } catch (error) {
      console.error('💥 Critical error in login:', error);
      return { success: false, message: 'Erro ao fazer login. Tente novamente.' };
    }
  };

  const logout = () => {
    console.log('🚪 Logging out and clearing session');
    clearSession();
  };

  const hasPermission = (module: string, action: string): boolean => {
    if (!profile) return false;
    
    // Convert module and action to uppercase for consistency
    const upperModule = module.toUpperCase();
    const upperAction = action.toUpperCase();
    
    const permission = profile.permissions.find(
      p => p.module.toUpperCase() === upperModule && p.action.toUpperCase() === upperAction
    );
    
    return permission?.allowed || false;
  };

  const verifyEmail = async (token: string): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await apiClient.verifyEmail(token);
      
      if (response.success) {
        return { success: true, message: 'Email verificado com sucesso!' };
      }
      
      return { 
        success: false, 
        message: response.error || 'Erro ao verificar email' 
      };
    } catch (error) {
      console.error('💥 Error in email verification:', error);
      return { success: false, message: 'Erro ao verificar email' };
    }
  };

  const resendVerificationEmail = async (email: string): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await apiClient.resendVerificationEmail(email);
      
      if (response.success) {
        return { success: true, message: 'Email de verificação reenviado!' };
      }
      
      return { 
        success: false, 
        message: response.error || 'Erro ao reenviar email' 
      };
    } catch (error) {
      console.error('💥 Error resending email:', error);
      return { success: false, message: 'Erro ao reenviar email' };
    }
  };

  const value: AuthContextType = {
    user,
    profile,
    login,
    logout,
    hasPermission,
    isAuthenticated: !!user,
    verifyEmail,
    resendVerificationEmail
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando sistema...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};