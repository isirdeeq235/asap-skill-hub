import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'super_admin' | 'admin' | 'moderator' | 'student';

interface UserRoleData {
  role: AppRole | null;
  isLoading: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isModerator: boolean;
  isStudent: boolean;
  hasRoleOrHigher: (requiredRole: AppRole) => boolean;
}

const roleHierarchy: Record<AppRole, number> = {
  super_admin: 4,
  admin: 3,
  moderator: 2,
  student: 1,
};

export const useUserRole = (): UserRoleData => {
  const [role, setRole] = useState<AppRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setRole(null);
          setIsLoading(false);
          return;
        }

        // Get highest role for the user
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        if (!roles || roles.length === 0) {
          setRole(null);
          setIsLoading(false);
          return;
        }

        // Find highest role
        let highestRole: AppRole = 'student';
        let highestLevel = 0;

        for (const r of roles) {
          const level = roleHierarchy[r.role as AppRole] || 0;
          if (level > highestLevel) {
            highestLevel = level;
            highestRole = r.role as AppRole;
          }
        }

        setRole(highestRole);
      } catch (error) {
        console.error('Error fetching user role:', error);
        setRole(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRole();
  }, []);

  const hasRoleOrHigher = (requiredRole: AppRole): boolean => {
    if (!role) return false;
    return roleHierarchy[role] >= roleHierarchy[requiredRole];
  };

  return {
    role,
    isLoading,
    isSuperAdmin: role === 'super_admin',
    isAdmin: role === 'admin' || role === 'super_admin',
    isModerator: role === 'moderator' || role === 'admin' || role === 'super_admin',
    isStudent: role === 'student',
    hasRoleOrHigher,
  };
};
