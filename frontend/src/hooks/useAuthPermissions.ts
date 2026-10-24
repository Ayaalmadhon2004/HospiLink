import { useAuth } from '../contexts/authContext';
import { canAccessRoute, hasPermission, type Permission } from '../configs/permissions';

/** Role-based checks for the signed-in user, used to hide actions the backend would answer with 403. */
export const useAuthPermissions = () => {
  const { user } = useAuth();
  const role = user?.role;
  return {
    role,
    can: (permission: Permission): boolean => hasPermission(role, permission),
    canAccess: (path: string): boolean => canAccessRoute(role, path),
  };
};
