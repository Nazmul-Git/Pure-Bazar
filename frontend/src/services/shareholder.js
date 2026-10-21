import api from './api';

function authConfig(token) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

export const searchShareholders = (token, params) => api.get('/shareholders', {
  ...authConfig(token),
  params,
});

export const getShareholderPurchases = (token, id) => api.get(
  `/shareholders/${id}/purchases`,
  authConfig(token),
);

export const getWalletLogs = (token, params) => api.get('/shareholders/wallet-logs', {
  ...authConfig(token),
  params: Object.fromEntries(Object.entries(params).filter(([, value]) => value !== '')),
});
