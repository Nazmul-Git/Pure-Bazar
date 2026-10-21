import api from './api';

export const getDashboard = (token) => api.get('/dashboard', {
  headers: { Authorization: `Bearer ${token}` },
});
