import React, { useState, useEffect } from 'react';
import { 
  X, ArrowRight, ArrowLeft, Sparkles, FileText, 
  Shield, Settings, Check, Rocket
} from 'lucide-react';
import { Button } from './ui/Button';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  target?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

interface OnboardingProps {
  onComplete: () => void;
  onSkip: () => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete, onSkip }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Bem-vindo ao NuP-AIM!',
      description: 'Sistema inteligente de Análise de Impacto. Vamos fazer um tour rápido pelas principais funcionalidades.',
      icon: <Rocket className="w-8 h-8" />,
    },
    {
      id: 'analysis',
      title: 'Criar Análises de Impacto',
      description: 'Crie análises detalhadas com impactos, riscos e mitigações. Nossa IA pode ajudar a gerar sugestões inteligentes.',
      icon: <FileText className="w-8 h-8" />,
      target: 'form-section',
    },
    {
      id: 'ai-assistant',
      title: 'Assistente de IA',
      description: 'Use nosso assistente inteligente para obter sugestões de impactos, riscos e mitigações baseadas no contexto da sua análise.',
      icon: <Sparkles className="w-8 h-8" />,
    },
    {
      id: 'export',
      title: 'Exporte para Word',
      description: 'Gere documentos profissionais em Word com um clique. Todas as seções formatadas automaticamente.',
      icon: <Settings className="w-8 h-8" />,
    },
    {
      id: 'permissions',
      title: 'Gestão de Acessos',
      description: 'Controle permissões de usuários com perfis personalizados. Administradores podem gerenciar usuários e perfis.',
      icon: <Shield className="w-8 h-8" />,
    },
    {
      id: 'complete',
      title: 'Tudo Pronto!',
      description: 'Você está pronto para começar. Explore todas as funcionalidades e crie sua primeira análise de impacto.',
      icon: <Check className="w-8 h-8" />,
    },
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem('nup-aim-onboarding-complete', 'true');
    setIsVisible(false);
    setTimeout(onComplete, 300);
  };

  const handleSkip = () => {
    localStorage.setItem('nup-aim-onboarding-complete', 'true');
    setIsVisible(false);
    setTimeout(onSkip, 300);
  };

  if (!isVisible) return null;

  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={handleSkip}
      />

      <div 
        className={`
          relative w-full max-w-md mx-4 bg-white dark:bg-gray-800 rounded-2xl shadow-strong
          animate-scale-in transition-all duration-300
        `}
      >
        <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-t-2xl overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-primary-500 to-secondary-500 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-8">
          <div className="text-center mb-8">
            <div 
              className={`
                inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6
                bg-gradient-to-br from-primary-500 to-secondary-500 text-white
                animate-float
              `}
            >
              {step.icon}
            </div>

            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
              {step.title}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              {step.description}
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 mb-8">
            {steps.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                className={`
                  w-2.5 h-2.5 rounded-full transition-all duration-300
                  ${index === currentStep 
                    ? 'w-8 bg-primary-500' 
                    : index < currentStep 
                    ? 'bg-success-500' 
                    : 'bg-gray-300 dark:bg-gray-600'
                  }
                `}
              />
            ))}
          </div>

          <div className="flex items-center justify-between gap-4">
            <Button
              variant="ghost"
              onClick={handlePrev}
              disabled={currentStep === 0}
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              Anterior
            </Button>

            <Button
              variant="primary"
              onClick={handleNext}
              rightIcon={currentStep === steps.length - 1 ? <Check className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
            >
              {currentStep === steps.length - 1 ? 'Começar' : 'Próximo'}
            </Button>
          </div>

          <button
            onClick={handleSkip}
            className="w-full mt-4 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            Pular tutorial
          </button>
        </div>
      </div>
    </div>
  );
};

interface TooltipGuideProps {
  target: string;
  title: string;
  description: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  onDismiss: () => void;
}

export const TooltipGuide: React.FC<TooltipGuideProps> = ({
  target,
  title,
  description,
  position = 'bottom',
  onDismiss,
}) => {
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  useEffect(() => {
    const element = document.querySelector(`[data-guide="${target}"]`);
    if (element) {
      const rect = element.getBoundingClientRect();
      const coords = {
        top: position === 'bottom' ? rect.bottom + 10 : rect.top - 10,
        left: rect.left + rect.width / 2,
      };
      setCoords(coords);
    }
  }, [target, position]);

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onDismiss} />
      <div
        className="fixed z-50 animate-fade-in-up"
        style={{
          top: coords.top,
          left: coords.left,
          transform: 'translateX(-50%)',
        }}
      >
        <div className="bg-gray-900 text-white rounded-xl p-4 shadow-strong max-w-xs">
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-gray-900 rotate-45" />
          <h4 className="font-semibold mb-1">{title}</h4>
          <p className="text-sm text-gray-300">{description}</p>
          <button
            onClick={onDismiss}
            className="mt-3 text-sm text-primary-400 hover:text-primary-300"
          >
            Entendi
          </button>
        </div>
      </div>
    </>
  );
};

export default Onboarding;
