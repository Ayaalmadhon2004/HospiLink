// frontend/src/hooks/useSettings.ts
// Thin wrapper over SettingsProvider (React Query); kept so pages keep the same API.
import { useSettingsContext } from '../contexts/settingsContext';

export type {
  ProfileSettings,
  NotificationSettings,
  SecuritySettings,
  DisplaySettings,
  UserSettings,
} from '../contexts/settingsContext';

const useSettings = () => useSettingsContext();

export default useSettings;
