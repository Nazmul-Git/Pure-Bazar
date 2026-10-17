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

  function canAccess(requiredPermissions = []) {
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
