export interface SystemSettings {
  showAdditionalSectionsToAll: boolean;
  showCustomFieldsToAll: boolean;
  enableFpaGuidelines: boolean;
}

const SYSTEM_SETTINGS_KEY = 'nup_aim_system_settings';

const defaultSettings: SystemSettings = {
  showAdditionalSectionsToAll: true,
  showCustomFieldsToAll: true,
  enableFpaGuidelines: true,
};

export const getSystemSettings = (): SystemSettings => {
  try {
    const stored = localStorage.getItem(SYSTEM_SETTINGS_KEY);
    if (stored) {
      return { ...defaultSettings, ...JSON.parse(stored) };
    }
    return defaultSettings;
  } catch (error) {
    console.error('Erro ao carregar configurações:', error);
    return defaultSettings;
  }
};

export const saveSystemSettings = (settings: Partial<SystemSettings>): void => {
  try {
    const current = getSystemSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(SYSTEM_SETTINGS_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Erro ao salvar configurações:', error);
  }
};

export const getSetting = <K extends keyof SystemSettings>(key: K): SystemSettings[K] => {
  const settings = getSystemSettings();
  return settings[key];
};
