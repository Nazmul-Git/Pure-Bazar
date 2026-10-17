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
export const getReceiveVendors = (token) => api.get('/stock/vendors', authConfig(token));
export const searchReceiveProducts = (token, params) => api.get('/stock/products', {
  ...authConfig(token),
  params: { ownerType: 'VENDOR', ...params },
});
export const getGoodsReceives = (token) => api.get('/goods-receives', authConfig(token));
export const createGoodsReceive = (token, payload) => api.post('/goods-receives', payload, authConfig(token));
export const approveGoodsReceive = (token, id) => api.post(`/goods-receives/${id}/approve`, {}, authConfig(token));
export const getPrintableGoodsReceive = (token, id) => api.get(`/goods-receives/${id}/print`, authConfig(token));
