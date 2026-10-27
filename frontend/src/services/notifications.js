import api from './api';

export const getNotifications = (token) => api.get('/notifications', {
  headers: { Authorization: `Bearer ${token}` },
});
