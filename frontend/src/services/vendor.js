import api from './api';

function authConfig(token) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

export const getVendors = (token, params = {}) => api.get('/vendors', {
  ...authConfig(token),
  params: Object.fromEntries(Object.entries(params).filter(([, value]) => value !== '')),
});

export const getCurrentVendorTerms = (token) => api.get('/vendors/terms', authConfig(token));
export const registerVendor = (token, payload) => api.post('/vendors', payload, authConfig(token));
export const updateVendorStatus = (token, id, status) => api.patch(
  `/vendors/${id}/status`,
  { status },
  authConfig(token),
);
