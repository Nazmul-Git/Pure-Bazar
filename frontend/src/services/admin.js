import api from './api';

function authConfig(token) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

export const getUsers = (token) => api.get('/users', authConfig(token));
export const createUser = (token, payload) => api.post('/users', payload, authConfig(token));
export const updateUser = (token, id, payload) => api.put(`/users/${id}`, payload, authConfig(token));
export const deleteUser = (token, id) => api.delete(`/users/${id}`, authConfig(token));

export const getRoles = (token) => api.get('/roles', authConfig(token));
export const createRole = (token, payload) => api.post('/roles', payload, authConfig(token));
export const updateRole = (token, id, payload) => api.put(`/roles/${id}`, payload, authConfig(token));
export const deleteRole = (token, id) => api.delete(`/roles/${id}`, authConfig(token));

export const getSettings = (token) => api.get('/settings', authConfig(token));
export const updateSettings = (token, payload) => api.put('/settings', payload, authConfig(token));
export const getAuditLogs = (token, filters = {}) => api.get('/audit-logs', {
  ...authConfig(token),
  params: Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== '')),
});