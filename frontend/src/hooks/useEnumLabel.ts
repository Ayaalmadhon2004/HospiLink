import { useTranslation } from 'react-i18next';
import { enumLabel, type EnumGroup } from '../utils/enumLabel';

/** `const label = useEnumLabel(); label('role', user.role)` - translated enum value, raw value when unknown. */
export const useEnumLabel = (): ((group: EnumGroup, value: string | null | undefined) => string) => {
  const { t } = useTranslation();
  return (group, value) => enumLabel(t, group, value);
};
