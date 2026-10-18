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
