import api from './api';

export const scanPosItem = (barcode) => api.get(`/pos/scan/${encodeURIComponent(barcode)}`);
export const searchPosItems = (q) => api.get('/pos/search', { params: { q } });
export const previewPosBill = (payload) => api.post('/pos/bill', payload);
export const verifyPosMember = (payload) => api.post('/pos/verify-member', payload);
export const checkPosWalletBalance = (payload) => api.post('/shareholders/balance-check', payload);
export const checkoutPosBill = (payload) => api.post('/pos/checkout', payload);

export function posErrorMessage(error) {
  return error.response?.data?.message || error.message || 'The POS request could not be completed.';
}
