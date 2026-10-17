import api from './api';

function authConfig(token) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

const resourceApi = (resource) => `/${resource}`;

export const getCategories = (token) => api.get(resourceApi('categories'), authConfig(token));
export const createCategory = (token, payload) => api.post(resourceApi('categories'), payload, authConfig(token));
export const updateCategory = (token, id, payload) => api.put(`${resourceApi('categories')}/${id}`, payload, authConfig(token));
export const deleteCategory = (token, id) => api.delete(`${resourceApi('categories')}/${id}`, authConfig(token));

function brandFormData(payload) {
  const formData = new FormData();
  formData.append('name', payload.name);
  if (payload.logo) formData.append('logo', payload.logo);
  return formData;
}

export const getBrands = (token) => api.get(resourceApi('brands'), authConfig(token));
export const createBrand = (token, payload) => api.post(resourceApi('brands'), brandFormData(payload), authConfig(token));
export const updateBrand = (token, id, payload) => api.put(`${resourceApi('brands')}/${id}`, brandFormData(payload), authConfig(token));
export const deleteBrand = (token, id) => api.delete(`${resourceApi('brands')}/${id}`, authConfig(token));

export const getUnits = (token) => api.get(resourceApi('units'), authConfig(token));
export const createUnit = (token, payload) => api.post(resourceApi('units'), payload, authConfig(token));
export const updateUnit = (token, id, payload) => api.put(`${resourceApi('units')}/${id}`, payload, authConfig(token));
export const deleteUnit = (token, id) => api.delete(`${resourceApi('units')}/${id}`, authConfig(token));

export const getProducts = (token) => api.get(resourceApi('products'), authConfig(token));
export const createProduct = (token, payload) => api.post(resourceApi('products'), payload, authConfig(token));
