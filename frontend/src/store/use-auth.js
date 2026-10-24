'use client';

import { useDispatch, useSelector } from 'react-redux';
import { loginUser, logoutUser } from './auth-slice';

export default function useAuth() {
  const dispatch = useDispatch();
  const auth = useSelector((state) => state.auth);

  function hasPermission(permission) {
    const permissions = auth.user?.permissions || [];
    return permissions.includes('*') || permissions.includes(permission);
  }

  function canAccess(requiredPermissions = [], pageKey) {
    const granted = auth.user?.permissions || [];
    const pageAware = pageKey && granted.some((permission) => /^[a-z]+\.[a-z-]+:(read|write)$/.test(permission));
    if (pageAware && !granted.includes('*')) {
      return granted.includes(`${pageKey}:read`) || granted.includes(`${pageKey}:write`);
    }
    return requiredPermissions.length === 0
      || requiredPermissions.some((permission) => permission === '*'
        ? auth.user?.role === 'Super Admin' && auth.user?.permissions?.includes('*')
        : hasPermission(permission));
  }

  return {
    ...auth,
    hasPermission,
    canAccess,
    login: (credentials) => dispatch(loginUser(credentials)).unwrap(),
    logout: () => dispatch(logoutUser()).unwrap().then(() => {
      window.sessionStorage.removeItem('purebazar.authToken');
    }),
  };
}
