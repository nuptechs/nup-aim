import React, { useState, useEffect, useRef } from 'react';
import { LogIn, User, Lock, AlertCircle, Mail, RefreshCw, FileText, UserPlus, ArrowLeft, ExternalLink, Eye, EyeOff, Shield, Zap, BarChart3, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/ApiAuthContext';

interface AuthMode {
  mode: 'sso' | 'local';
  ssoLoginUrl: string | null;
  ssoLogoutUrl: string | null;
}

export const LoginForm: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showResendEmail, setShowResendEmail] = useState(false);
  const [resendEmail, setResendEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [captchaCode, setCaptchaCode] = useState('');
  const [userCaptcha, setUserCaptcha] = useState('');
  const [captchaError, setCaptchaError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const captchaCanvasRef = useRef<HTMLCanvasElement>(null);
  const { login, resendVerificationEmail } = useAuth();
  
  // Auth mode state
  const [authMode, setAuthMode] = useState<AuthMode>({ mode: 'local', ssoLoginUrl: null, ssoLogoutUrl: null });
  const [checkingAuthMode, setCheckingAuthMode] = useState(true);
  
  // New state for registration
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerData, setRegisterData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [registerErrors, setRegisterErrors] = useState<Record<string, string>>({});
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');

  useEffect(() => {
    checkAuthMode();
  }, []);

  // Generate captcha after component mounts and canvas is ready
  useEffect(() => {
    // Small delay to ensure canvas is rendered
    const timer = setTimeout(() => {
      generateCaptcha();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const checkAuthMode = async () => {
    try {
      const response = await fetch('/api/auth/mode');
      if (response.ok) {
        const data = await response.json();
        setAuthMode(data);
        
        // Auto-redirect to SSO if mode is SSO
        if (data.mode === 'sso' && data.ssoLoginUrl) {
          console.log('🔐 SSO mode detected, redirecting to NuPIdentity...');
          window.location.href = data.ssoLoginUrl;
          return; // Don't set checkingAuthMode to false, keep loading state
        }
      }
    } catch (error) {
      console.error('Failed to check auth mode:', error);
    } finally {
      setCheckingAuthMode(false);
    }
  };

  const handleSSOLogin = () => {
    if (authMode.ssoLoginUrl) {
      window.location.href = authMode.ssoLoginUrl;
    }
  };

  const generateCaptcha = () => {
    const canvas = captchaCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Generate random code (letters and numbers)
    const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    setCaptchaCode(code);

    // Background
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Add noise (dots)
    for (let i = 0; i < 100; i++) {
      ctx.fillStyle = `rgba(${Math.random() * 100}, ${Math.random() * 100}, ${Math.random() * 100}, 0.2)`;
      ctx.beginPath();
      ctx.arc(
        Math.random() * canvas.width,
        Math.random() * canvas.height,
        Math.random() * 2,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    // Add lines
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = `rgba(${Math.random() * 100}, ${Math.random() * 100}, ${Math.random() * 100}, 0.3)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
      ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
      ctx.stroke();
    }

    // Draw text
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = '#4b5563';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Draw each character with slight rotation and position variation
    for (let i = 0; i < code.length; i++) {
      const x = (i + 0.5) * (canvas.width / code.length);
      const y = canvas.height / 2 + (Math.random() * 10 - 5);
      const rotation = Math.random() * 0.4 - 0.2; // -0.2 to 0.2 radians

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.fillText(code[i], 0, 0);
      ctx.restore();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCaptchaError(false);

    // Validate captcha
    if (userCaptcha !== captchaCode) {
      setCaptchaError(true);
      generateCaptcha();
      return;
    }

    setIsLoading(true);

    try {
      console.log('🔐 Tentando fazer login...');
      console.log('👤 Usuário:', username);
      
      // Remove espaços extras do username/email
      const cleanUsername = username.trim();
      const cleanPassword = password.trim();
      
      const result = await login(cleanUsername, cleanPassword);
      
      if (!result.success) {
        console.log('❌ Login falhou:', result.message);
        setError(result.message || 'Erro ao fazer login');
        
        // Show resend email option if email not verified
        if (result.message?.includes('Email não verificado')) {
          setShowResendEmail(true);
          setResendEmail(username.includes('@') ? username : '');
        }
      } else {
        console.log('✅ Login realizado com sucesso!');
      }
    } catch (error) {
      console.error('💥 Erro no login:', error);
      setError('Erro ao fazer login. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setResendLoading(true);
    setResendMessage('');

    try {
      const result = await resendVerificationEmail(resendEmail);
      setResendMessage(result.message);
      
      if (result.success) {
        setShowResendEmail(false);
      }
    } catch (error) {
      setResendMessage('Erro ao reenviar email de verificação');
    } finally {
      setResendLoading(false);
    }
  };

  // New function to handle registration form submission
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterErrors({});
    
    // Validate registration form
    const errors: Record<string, string> = {};
    
    if (!registerData.username.trim()) {
      errors.username = 'Nome de usuário é obrigatório';
    } else if (registerData.username.length < 3) {
      errors.username = 'Nome de usuário deve ter pelo menos 3 caracteres';
    }
    
    if (!registerData.email.trim()) {
      errors.email = 'Email é obrigatório';
    } else if (!/\S+@\S+\.\S+/.test(registerData.email)) {
      errors.email = 'Email inválido';
    }
    
    if (!registerData.password.trim()) {
      errors.password = 'Senha é obrigatória';
    } else if (registerData.password.length < 6) {
      errors.password = 'Senha deve ter pelo menos 6 caracteres';
    }
    
    if (!registerData.confirmPassword.trim()) {
      errors.confirmPassword = 'Confirmação de senha é obrigatória';
    } else if (registerData.password !== registerData.confirmPassword) {
      errors.confirmPassword = 'As senhas não coincidem';
    }
    
    if (Object.keys(errors).length > 0) {
      setRegisterErrors(errors);
      return;
    }
    
    setRegisterLoading(true);
    
    try {
      // Use the API client to register the user
      const { apiClient } = await import('../lib/apiClient');
      
      // Create user
      const result = await apiClient.register({
        username: registerData.username,
        email: registerData.email,
        password: registerData.password,
        profileId: '', // Will use default profile from backend
      });
      
      if (!result.success) {
        setRegisterErrors({ form: result.error || 'Erro ao criar usuário' });
      } else {
        setRegisteredEmail(registerData.email);
        setRegisterSuccess(true);
        
        // Reset form after successful registration
        setRegisterData({
          username: '',
          email: '',
          password: '',
          confirmPassword: ''
        });
      }
    } catch (error) {
      console.error('Erro ao registrar usuário:', error);
      setRegisterErrors({ form: 'Erro ao criar usuário. Tente novamente.' });
    } finally {
      setRegisterLoading(false);
    }
  };

  // Toggle between login and registration forms
  const toggleRegistration = () => {
    setIsRegistering(!isRegistering);
    setError('');
    setCaptchaError(false);
    setRegisterErrors({});
    setRegisterSuccess(false);
    generateCaptcha();
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Gradient Background with Info */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-700 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}></div>
        </div>

        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
              <span className="text-xl font-bold">N</span>
            </div>
            <div>
              <h3 className="font-semibold text-lg">NuP_AIM</h3>
              <p className="text-sm text-white/70">Análise de Impacto</p>
            </div>
          </div>

          {/* Main Content */}
          <div className="space-y-8">
            <div>
              <h1 className="text-4xl font-bold leading-tight">
                Análise de Impacto e<br />
                Contagem de Pontos<br />
                de Função
              </h1>
              <p className="mt-4 text-lg text-white/80">
                Sistema completo para análise de impacto em projetos de TI, 
                com suporte à metodologia IFPUG CPM 4.3.1.
              </p>
            </div>

            {/* Features */}
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 bg-white/10 backdrop-blur-sm rounded-xl">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold">Contagem de Pontos de Função</h4>
                  <p className="text-sm text-white/70">Extração automática com IA seguindo padrões IFPUG</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-white/10 backdrop-blur-sm rounded-xl">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold">Análise de Impacto Inteligente</h4>
                  <p className="text-sm text-white/70">Criação de documentos com apoio da NuPTechs AI</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-white/10 backdrop-blur-sm rounded-xl">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold">Relatórios Parametrizáveis</h4>
                  <p className="text-sm text-white/70">Exportação flexível com filtros personalizados</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-4 text-sm text-white/60">
            <span>&copy; 2021 NuPTechs</span>
            <span>•</span>
            <span>Termos</span>
            <span>•</span>
            <span>Privacidade</span>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-xl font-bold text-white">N</span>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">NuP_AIM</h2>
            <p className="text-sm text-gray-600">Sistema de Análise de Impacto</p>
          </div>

        {isRegistering ? (
          // Registration Form
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Criar Nova Conta</h1>
                <p className="mt-2 text-gray-600">Preencha os dados para se cadastrar</p>
              </div>
              <button
                onClick={toggleRegistration}
                className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-medium"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar para Login
              </button>
            </div>
              
            {registerSuccess ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
                <div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mx-auto mb-4">
                  <Mail className="w-8 h-8 text-green-600" />
                </div>
                <h4 className="text-xl font-semibold text-gray-900 mb-2">Cadastro Realizado!</h4>
                <p className="text-gray-600 mb-6">
                  Enviamos um email de verificação para <strong className="text-gray-900">{registeredEmail}</strong>.
                  Por favor, verifique sua caixa de entrada e clique no link para ativar sua conta.
                </p>
                <button
                  onClick={toggleRegistration}
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-4 border border-transparent rounded-xl text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Voltar para Login
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                <form onSubmit={handleRegister} className="space-y-5">
                  {/* Username Field */}
                  <div>
                    <label htmlFor="register-username" className="block text-sm font-medium text-gray-700 mb-2">
                      Nome de Usuário *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <User className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        id="register-username"
                        name="username"
                        type="text"
                        required
                        value={registerData.username}
                        onChange={(e) => setRegisterData({...registerData, username: e.target.value})}
                        className={`block w-full pl-12 pr-4 py-3 border ${registerErrors.username ? 'border-red-300' : 'border-gray-200'} rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-gray-900 placeholder-gray-400`}
                        placeholder="Digite seu nome de usuário"
                      />
                    </div>
                    {registerErrors.username && (
                      <p className="mt-2 text-sm text-red-600">{registerErrors.username}</p>
                    )}
                  </div>

                  {/* Email Field */}
                  <div>
                    <label htmlFor="register-email" className="block text-sm font-medium text-gray-700 mb-2">
                      Email *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        id="register-email"
                        name="email"
                        type="email"
                        required
                        value={registerData.email}
                        onChange={(e) => setRegisterData({...registerData, email: e.target.value})}
                        className={`block w-full pl-12 pr-4 py-3 border ${registerErrors.email ? 'border-red-300' : 'border-gray-200'} rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-gray-900 placeholder-gray-400`}
                        placeholder="seu.email@exemplo.com"
                      />
                    </div>
                    {registerErrors.email && (
                      <p className="mt-2 text-sm text-red-600">{registerErrors.email}</p>
                    )}
                  </div>

                  {/* Password Field */}
                  <div>
                    <label htmlFor="register-password" className="block text-sm font-medium text-gray-700 mb-2">
                      Senha *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        id="register-password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={registerData.password}
                        onChange={(e) => setRegisterData({...registerData, password: e.target.value})}
                        className={`block w-full pl-12 pr-12 py-3 border ${registerErrors.password ? 'border-red-300' : 'border-gray-200'} rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-gray-900 placeholder-gray-400`}
                        placeholder="Mínimo 6 caracteres"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    {registerErrors.password && (
                      <p className="mt-2 text-sm text-red-600">{registerErrors.password}</p>
                    )}
                  </div>

                  {/* Confirm Password Field */}
                  <div>
                    <label htmlFor="register-confirm-password" className="block text-sm font-medium text-gray-700 mb-2">
                      Confirmar Senha *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        id="register-confirm-password"
                        name="confirmPassword"
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={registerData.confirmPassword}
                        onChange={(e) => setRegisterData({...registerData, confirmPassword: e.target.value})}
                        className={`block w-full pl-12 pr-4 py-3 border ${registerErrors.confirmPassword ? 'border-red-300' : 'border-gray-200'} rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-gray-900 placeholder-gray-400`}
                        placeholder="Digite a senha novamente"
                      />
                    </div>
                    {registerErrors.confirmPassword && (
                      <p className="mt-2 text-sm text-red-600">{registerErrors.confirmPassword}</p>
                    )}
                  </div>

                  {registerErrors.form && (
                    <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                      <p className="text-sm text-red-800">{registerErrors.form}</p>
                    </div>
                  )}

                  <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                    <p className="text-sm text-indigo-800">
                      <strong>Importante:</strong> Após o cadastro, você receberá um email de verificação. 
                      É necessário clicar no link de confirmação para ativar sua conta.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={registerLoading}
                    className="w-full flex items-center justify-center gap-2 py-3.5 px-4 border border-transparent rounded-xl text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
                  >
                    {registerLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        <span>Cadastrando...</span>
                      </>
                    ) : (
                      <>
                        <span>Cadastrar</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}

            <div className="text-center text-xs text-gray-500">
              <p>Ao continuar, você concorda com nossos</p>
              <p>
                <a href="#" className="text-indigo-600 hover:underline">Termos de Uso</a>
                {' '}e{' '}
                <a href="#" className="text-indigo-600 hover:underline">Política de Privacidade</a>
              </p>
            </div>
          </div>
        ) : checkingAuthMode ? (
          // Loading state while checking auth mode / redirecting to SSO
          <div className="mt-8 space-y-6">
            <div className="bg-white rounded-lg shadow-md p-6 flex flex-col items-center justify-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
              <span className="text-gray-600 text-center">Redirecionando para autenticação...</span>
              <span className="text-gray-400 text-sm mt-1">Aguarde um momento</span>
            </div>
          </div>
        ) : authMode.mode === 'sso' ? (
          // SSO Login
          <div className="mt-8 space-y-6">
            <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Login via NuPIdentity</h3>
                <p className="text-sm text-gray-600 mb-6">
                  Use sua conta NuPIdentity para acessar o sistema de forma segura.
                </p>
              </div>
              
              <button
                type="button"
                onClick={handleSSOLogin}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                <ExternalLink className="w-5 h-5" />
                Entrar com NuPIdentity
              </button>
              
              <div className="text-center text-xs text-gray-500 mt-4">
                <p>Você será redirecionado para o servidor de autenticação</p>
              </div>
            </div>
          </div>
        ) : (
          // Local Login Form
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Header */}
            <div className="text-center lg:text-left">
              <h1 className="text-3xl font-bold text-gray-900">Bem-vindo de volta</h1>
              <p className="mt-2 text-gray-600">Entre para acessar o sistema</p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-5">
              {/* Email Field */}
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value.trim())}
                    className="block w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-gray-900 bg-white placeholder-gray-400"
                    placeholder="seu@email.com"
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Senha
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-12 pr-12 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-gray-900 bg-white placeholder-gray-400"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {/* CAPTCHA */}
              <div>
                <label htmlFor="captcha" className="block text-sm font-medium text-gray-700 mb-2">
                  Código de Segurança
                </label>
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Shield className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="captcha"
                      name="captcha"
                      type="text"
                      required
                      value={userCaptcha}
                      onChange={(e) => setUserCaptcha(e.target.value)}
                      className={`block w-full pl-12 pr-4 py-3 border ${
                        captchaError ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-200 focus:ring-indigo-500 focus:border-indigo-500'
                      } rounded-xl transition-all text-gray-900 bg-white placeholder-gray-400`}
                      placeholder="Digite o código"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <canvas 
                      ref={captchaCanvasRef} 
                      width="120" 
                      height="44" 
                      className="border border-gray-200 rounded-xl bg-gray-50"
                    ></canvas>
                    <button
                      type="button"
                      onClick={generateCaptcha}
                      className="p-2 text-gray-400 hover:text-indigo-600 transition-colors rounded-lg hover:bg-indigo-50"
                      title="Gerar novo código"
                    >
                      <RefreshCw className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                {captchaError && (
                  <p className="mt-2 text-sm text-red-600">Código de segurança incorreto</p>
                )}
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {/* Resend Email Section */}
              {showResendEmail && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <h4 className="font-medium text-yellow-900 mb-2">Reenviar Email de Verificação</h4>
                  <form onSubmit={handleResendEmail} className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-yellow-800 mb-1">
                        Email para reenvio
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Mail className="h-4 w-4 text-yellow-600" />
                        </div>
                        <input
                          type="email"
                          required
                          value={resendEmail}
                          onChange={(e) => setResendEmail(e.target.value)}
                          className="block w-full pl-9 pr-3 py-2 text-sm border border-yellow-300 rounded focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                          placeholder="seu.email@exemplo.com"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={resendLoading}
                        className="inline-flex items-center px-3 py-2 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors disabled:opacity-50"
                      >
                        {resendLoading ? (
                          <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <Mail className="w-4 h-4 mr-1" />
                        )}
                        Reenviar
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowResendEmail(false)}
                        className="px-3 py-2 text-sm text-yellow-700 hover:text-yellow-900 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                  {resendMessage && (
                    <p className={`text-sm mt-2 ${resendMessage.includes('Erro') ? 'text-red-600' : 'text-green-600'}`}>
                      {resendMessage}
                    </p>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 border border-transparent rounded-xl text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    <span>Entrando...</span>
                  </>
                ) : (
                  <>
                    <span>Entrar</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="mt-6 text-center">
                <span className="text-sm text-gray-600">Não tem conta? </span>
                <button
                  type="button"
                  onClick={toggleRegistration}
                  className="text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                >
                  Criar agora
                </button>
              </div>

              <div className="mt-6 text-center text-xs text-gray-500">
                <p>Ao continuar, você concorda com nossos</p>
                <p>
                  <a href="#" className="text-indigo-600 hover:underline">Termos de Uso</a>
                  {' '}e{' '}
                  <a href="#" className="text-indigo-600 hover:underline">Política de Privacidade</a>
                </p>
              </div>
            </div>
          </form>
        )}
        </div>
      </div>
    </div>
  );
};