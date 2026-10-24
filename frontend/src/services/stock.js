import api from './api';

function authConfig(token) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

export const getLocations = (token, type) => api.get('/locations', {
  ...authConfig(token),
  params: type ? { type } : undefined,
});
export const getStockTransfers = (token) => api.get('/stock-transfers', authConfig(token));
export const createStockTransfer = (token, payload) => api.post('/stock-transfers', payload, authConfig(token));
export const dispatchStockTransfer = (token, id, payload) => api.post(`/stock-transfers/${id}/dispatch`, payload, authConfig(token));
export const receiveStockTransfer = (token, id, payload) => api.post(`/stock-transfers/${id}/receive`, payload, authConfig(token));
export const getWarehouseStock = (token, warehouseId) => api.get('/stock', {
  ...authConfig(token),
  params: { warehouseId },
});
export const getStockAdjustments = (token, params) => api.get('/stock-adjustments', {
  ...authConfig(token),
  params,
});
export const createStockAdjustment = (token, payload) => api.post('/stock-adjustments', payload, authConfig(token));
export const approveStockAdjustment = (token, id) => api.post(`/stock-adjustments/${id}/approve`, {}, authConfig(token));
export const rejectStockAdjustment = (token, id) => api.post(`/stock-adjustments/${id}/reject`, {}, authConfig(token));
export const getStockCounts = (token, params) => api.get('/stock-counts', {
  ...authConfig(token),
  params,
});
export const createStockCount = (token, payload) => api.post('/stock-counts', payload, authConfig(token));
export const postStockCount = (token, id) => api.post(`/stock-counts/${id}/post`, {}, authConfig(token));
export const getReceiveVendors = (token) => api.get('/stock/vendors', authConfig(token));
export const getNextChallanNumber = (token, vendorId) => api.get(
  `/stock/vendors/${vendorId}/next-challan`,
  authConfig(token),
);
export const searchReceiveProducts = (token, params) => api.get('/stock/products', {
  ...authConfig(token),
  params,
});
export const getGoodsReceives = (token) => api.get('/goods-receives', authConfig(token));
export const createGoodsReceive = (token, payload) => api.post('/goods-receives', payload, authConfig(token));
export const approveGoodsReceive = (token, id) => api.post(`/goods-receives/${id}/approve`, {}, authConfig(token));
export const getPrintableGoodsReceive = (token, id) => api.get(`/goods-receives/${id}/print`, authConfig(token));
