import api from './api';

function authConfig(token, params = {}) {
  return {
    headers: { Authorization: `Bearer ${token}` },
    params: Object.fromEntries(Object.entries(params).filter(([, value]) => value !== '' && value != null)),
  };
}

const reportPaths = {
  sales: '/reports/sales',
  stock: '/reports/stock',
  vendor: '/reports/vendor-profitability',
  profitLoss: '/reports/profit-loss',
  vatDiscount: '/reports/vat-discount',
};

export function getReport(token, type, params) {
  return api.get(reportPaths[type], authConfig(token, params));
}

export function downloadReport(token, type, params, format) {
  return api.get(reportPaths[type], {
    ...authConfig(token, { ...params, format }),
    responseType: 'blob',
  });
}
