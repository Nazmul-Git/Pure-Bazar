import api from './api';

export const getSalesHistory = (params) => api.get('/pos/history', { params });
export const returnPosOrder = (orderId, payload) => api.post(`/pos/${orderId}/return`, payload);
export const getCurrentPosShift = () => api.get('/pos/shifts/current');
export const getPosShiftReport = (shiftId) => api.get(`/pos/shifts/${shiftId}/report`);
export const openPosShift = (payload) => api.post('/pos/shifts', payload);
export const closePosShift = (shiftId, payload) => api.post(`/pos/shifts/${shiftId}/close`, payload);
