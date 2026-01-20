import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Mail, ArrowLeft, ArrowRight, RefreshCw, BarChart3, Zap, FileText } from 'lucide-react';
import { useAuth } from '../contexts/ApiAuthContext';

interface EmailVerificationProps {
  token?: string;
  onBackToLogin: () => void;
}

export const EmailVerification: React.FC<EmailVerificationProps> = ({ token, onBackToLogin }) => {
  const [verificationStatus, setVerificationStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const { verifyEmail, resendVerificationEmail } = useAuth();

  useEffect(() => {
    if (token) {
      handleVerification();
    } else {
      setVerificationStatus('error');
      setMessage('Token de verificação não fornecido');
    }
  }, [token]);

  const handleVerification = async () => {
    if (!token) return;

    try {
      const result = await verifyEmail(token);
      setVerificationStatus(result.success ? 'success' : 'error');
      setMessage(result.message);
    } catch (error) {
      setVerificationStatus('error');
      setMessage('Erro ao verificar email');
    }
  };

  const handleResendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setResendLoading(true);
    setResendMessage('');

    try {
      const result = await resendVerificationEmail(resendEmail);
      setResendMessage(result.message);
    } catch (error) {
      setResendMessage('Erro ao reenviar email de verificação');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Gradient Background */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-700 p-12 flex-col justify-between relative overflow-hidden">
        {/* Decorative Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>
        
        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
              <span className="text-xl font-bold text-white">N</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">NuP_AIM</h1>
              <p className="text-white/70 text-sm">Análise de Impacto</p>
            </div>
          </div>

          {/* Main Heading */}
          <h2 className="text-4xl font-bold text-white leading-tight mb-6">
            Verificação de Email
          </h2>
          <p className="text-lg text-white/80 mb-12">
            Confirme seu email para ativar sua conta e acessar todos os recursos do sistema.
          </p>

          {/* Feature Cards */}
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-white/10 backdrop-blur-sm rounded-xl">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold">Contagem de Pontos de Função</h4>
                <p className="text-sm text-white/70">Extração automática com IA seguindo padrões IFPUG</p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 bg-white/10 backdrop-blur-sm rounded-xl">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold">Análise de Impacto Inteligente</h4>
                <p className="text-sm text-white/70">Criação de documentos com apoio da NuPTechs AI</p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 bg-white/10 backdrop-blur-sm rounded-xl">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5" />
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

      {/* Right Panel - Verification Content */}
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

          {/* Status Icon and Title */}
          <div className="text-center lg:text-left mb-8">
            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 ${
              verificationStatus === 'loading' ? 'bg-indigo-100' :
              verificationStatus === 'success' ? 'bg-green-100' : 'bg-red-100'
            }`}>
              {verificationStatus === 'loading' && (
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent"></div>
              )}
              {verificationStatus === 'success' && <CheckCircle className="w-8 h-8 text-green-600" />}
              {verificationStatus === 'error' && <XCircle className="w-8 h-8 text-red-600" />}
            </div>
            
            <h1 className="text-3xl font-bold text-gray-900">
              {verificationStatus === 'loading' && 'Verificando Email...'}
              {verificationStatus === 'success' && 'Email Verificado!'}
              {verificationStatus === 'error' && 'Erro na Verificação'}
            </h1>
            <p className="mt-2 text-gray-600">
              {verificationStatus === 'loading' && 'Aguarde enquanto verificamos seu email'}
              {verificationStatus === 'success' && 'Sua conta foi ativada com sucesso'}
              {verificationStatus === 'error' && 'Não foi possível verificar seu email'}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-6">
            {/* Status Message */}
            <div className={`p-4 rounded-xl ${
              verificationStatus === 'success' ? 'bg-green-50 border border-green-200' :
              verificationStatus === 'error' ? 'bg-red-50 border border-red-200' :
              'bg-indigo-50 border border-indigo-200'
            }`}>
              <p className={`text-sm ${
                verificationStatus === 'success' ? 'text-green-800' :
                verificationStatus === 'error' ? 'text-red-800' :
                'text-indigo-800'
              }`}>
                {message}
              </p>
            </div>

            {verificationStatus === 'success' && (
              <div className="space-y-4">
                <p className="text-gray-600 text-center">
                  Agora você pode fazer login no sistema e acessar todos os recursos disponíveis.
                </p>
                
                <button
                  onClick={onBackToLogin}
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-4 border border-transparent rounded-xl text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all shadow-sm hover:shadow-md"
                >
                  <span>Ir para Login</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {verificationStatus === 'error' && (
              <div className="space-y-5">
                <p className="text-gray-600 text-center text-sm">
                  O link de verificação pode ter expirado ou já foi utilizado. Solicite um novo email de verificação.
                </p>

                <form onSubmit={handleResendEmail} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email para reenvio
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="email"
                        required
                        value={resendEmail}
                        onChange={(e) => setResendEmail(e.target.value)}
                        className="block w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-gray-900 placeholder-gray-400"
                        placeholder="seu.email@exemplo.com"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={resendLoading}
                    className="w-full flex items-center justify-center gap-2 py-3.5 px-4 border border-transparent rounded-xl text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all disabled:opacity-50 shadow-sm hover:shadow-md"
                  >
                    {resendLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Reenviando...</span>
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4" />
                        <span>Reenviar Email de Verificação</span>
                      </>
                    )}
                  </button>
                </form>

                {resendMessage && (
                  <div className={`p-4 rounded-xl ${
                    resendMessage.includes('Erro') ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'
                  }`}>
                    <p className={`text-sm ${
                      resendMessage.includes('Erro') ? 'text-red-800' : 'text-green-800'
                    }`}>
                      {resendMessage}
                    </p>
                  </div>
                )}

                <div className="pt-4 border-t border-gray-100">
                  <button
                    onClick={onBackToLogin}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 text-sm text-gray-600 hover:text-indigo-600 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Voltar para Login</span>
                  </button>
                </div>
              </div>
            )}
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
      </div>
    </div>
  );
};
