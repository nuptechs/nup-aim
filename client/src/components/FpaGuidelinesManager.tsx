import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save, X, BookOpen, Sparkles, AlertTriangle } from 'lucide-react';

interface FpaGuideline {
  id: string;
  title: string;
  triggerPhrases: string[];
  businessDomains: string[];
  instruction: string;
  examples: { input: string; output: string }[];
  negativeExamples: { input: string; wrongOutput: string; correctOutput: string }[];
  priority: string;
  isActive: boolean;
  createdAt: string;
}

interface FpaGuidelinesManagerProps {
  onClose: () => void;
}

export const FpaGuidelinesManager = ({ onClose }: FpaGuidelinesManagerProps) => {
  const [guidelines, setGuidelines] = useState<FpaGuideline[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    triggerPhrases: '',
    businessDomains: '',
    instruction: '',
    examples: '',
    negativeExamples: '',
    priority: 'normal'
  });

  useEffect(() => {
    fetchGuidelines();
  }, []);

  const fetchGuidelines = async () => {
    const token = localStorage.getItem('nup_aim_auth_token');
    try {
      const res = await fetch('/api/fpa-guidelines', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setGuidelines(data.guidelines);
      }
    } catch (error) {
      console.error('Error fetching guidelines:', error);
    } finally {
      setLoading(false);
    }
  };

  const [formError, setFormError] = useState<string | null>(null);

  const handleSave = async () => {
    const token = localStorage.getItem('nup_aim_auth_token');
    setFormError(null);
    
    let examples = [];
    let negativeExamples = [];
    
    try {
      if (formData.examples.trim()) {
        examples = JSON.parse(formData.examples);
      }
    } catch (e) {
      setFormError('Erro no JSON de "Exemplos". Verifique a sintaxe.');
      return;
    }
    
    try {
      if (formData.negativeExamples.trim()) {
        negativeExamples = JSON.parse(formData.negativeExamples);
      }
    } catch (e) {
      setFormError('Erro no JSON de "Exemplos Negativos". Verifique a sintaxe.');
      return;
    }
    
    const payload = {
      title: formData.title,
      triggerPhrases: formData.triggerPhrases.split(',').map(s => s.trim()).filter(Boolean),
      businessDomains: formData.businessDomains.split(',').map(s => s.trim()).filter(Boolean),
      instruction: formData.instruction,
      examples,
      negativeExamples,
      priority: formData.priority
    };

    try {
      const url = editingId ? `/api/fpa-guidelines/${editingId}` : '/api/fpa-guidelines';
      const method = editingId ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        fetchGuidelines();
        resetForm();
      }
    } catch (error) {
      console.error('Error saving guideline:', error);
    }
  };

  const handleEdit = (guideline: FpaGuideline) => {
    setEditingId(guideline.id);
    setFormData({
      title: guideline.title,
      triggerPhrases: guideline.triggerPhrases.join(', '),
      businessDomains: guideline.businessDomains.join(', '),
      instruction: guideline.instruction,
      examples: JSON.stringify(guideline.examples, null, 2),
      negativeExamples: JSON.stringify(guideline.negativeExamples, null, 2),
      priority: guideline.priority
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta diretriz?')) return;
    
    const token = localStorage.getItem('nup_aim_auth_token');
    try {
      await fetch(`/api/fpa-guidelines/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchGuidelines();
    } catch (error) {
      console.error('Error deleting guideline:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      triggerPhrases: '',
      businessDomains: '',
      instruction: '',
      examples: '',
      negativeExamples: '',
      priority: 'normal'
    });
    setEditingId(null);
    setShowForm(false);
    setFormError(null);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Diretrizes de APF</h3>
                <p className="text-white/80 text-sm">Regras para análise de pontos de função</p>
              </div>
            </div>
            <button onClick={onClose} className="text-white/80 hover:text-white p-2 hover:bg-white/10 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="mb-4 flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nova Diretriz
            </button>
          )}

          {showForm && (
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl space-y-4">
              <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                {editingId ? 'Editar Diretriz' : 'Nova Diretriz'}
              </h4>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Título</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                  placeholder="Ex: Identificar funcionalidades por contexto de negócio"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Frases-gatilho (separadas por vírgula)</label>
                <input
                  type="text"
                  value={formData.triggerPhrases}
                  onChange={(e) => setFormData({...formData, triggerPhrases: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                  placeholder="implementar regras, criar tags, configurar modelos"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Domínios de negócio (separados por vírgula)</label>
                <input
                  type="text"
                  value={formData.businessDomains}
                  onChange={(e) => setFormData({...formData, businessDomains: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                  placeholder="contrato, turma sest, locação de espaços"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Instrução</label>
                <textarea
                  value={formData.instruction}
                  onChange={(e) => setFormData({...formData, instruction: e.target.value})}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                  placeholder="Descreva a regra de APF que a IA deve seguir..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Prioridade</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({...formData, priority: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                >
                  <option value="high">Alta</option>
                  <option value="normal">Normal</option>
                  <option value="low">Baixa</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Exemplos (JSON)</label>
                <textarea
                  value={formData.examples}
                  onChange={(e) => setFormData({...formData, examples: e.target.value})}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white font-mono text-sm"
                  placeholder='[{"input": "texto exemplo", "output": "resultado esperado"}]'
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Exemplos Negativos (JSON)</label>
                <textarea
                  value={formData.negativeExamples}
                  onChange={(e) => setFormData({...formData, negativeExamples: e.target.value})}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white font-mono text-sm"
                  placeholder='[{"input": "texto", "wrongOutput": "errado", "correctOutput": "correto"}]'
                />
              </div>
              
              {formError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
                  {formError}
                </div>
              )}
              
              <div className="flex gap-2">
                <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                  <Save className="w-4 h-4" />
                  Salvar
                </button>
                <button onClick={resetForm} className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600">
                  <X className="w-4 h-4" />
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-8 text-gray-500">Carregando...</div>
          ) : guidelines.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <AlertTriangle className="w-12 h-12 mx-auto mb-2 opacity-50" />
              Nenhuma diretriz cadastrada
            </div>
          ) : (
            <div className="space-y-4">
              {guidelines.map(g => (
                <div key={g.id} className="p-4 border border-gray-200 dark:border-gray-600 rounded-xl">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-4 h-4 text-purple-500" />
                        <h5 className="font-semibold text-gray-900 dark:text-gray-100">{g.title}</h5>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          g.priority === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                          g.priority === 'low' ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' :
                          'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                        }`}>
                          {g.priority === 'high' ? 'Alta' : g.priority === 'low' ? 'Baixa' : 'Normal'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{g.instruction}</p>
                      {g.triggerPhrases.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {g.triggerPhrases.map((phrase, i) => (
                            <span key={i} className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded text-xs">
                              {phrase}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEdit(g)}
                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(g.id)}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FpaGuidelinesManager;
