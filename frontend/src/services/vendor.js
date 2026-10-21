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
export const getVendorLedger = (token, id, params) => api.get(
  `/vendors/${id}/ledger`,
  { ...authConfig(token), params },
);
export const getVendorStatements = (token, id) => api.get(
  `/vendors/${id}/statements`,
  authConfig(token),
);
export const createVendorStatement = (token, id, payload) => api.post(
  `/vendors/${id}/statements`,
  payload,
  authConfig(token),
);
export const updateVendorStatement = (token, id, payload) => api.patch(
  `/vendors/statements/${id}/status`,
  payload,
  authConfig(token),
);
