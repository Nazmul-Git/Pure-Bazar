import api from './api';

function authConfig(token) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

export const getEmployees = (token, status = '') => api.get('/payroll/employees', {
  ...authConfig(token),
  params: status ? { status } : undefined,
});
export const saveEmployee = (token, payload, id) => api.request({
  method: id ? 'PATCH' : 'POST',
  url: id ? `/payroll/employees/${id}` : '/payroll/employees',
  data: payload,
  ...authConfig(token),
});
export const getAdvances = (token, params = {}) => api.get('/payroll/advances', {
  ...authConfig(token),
  params: Object.fromEntries(Object.entries(params).filter(([, value]) => value !== '')),
});
export const createAdvance = (token, payload) => api.post('/payroll/advances', payload, authConfig(token));
export const transitionAdvance = (token, id, action) => api.post(
  `/payroll/advances/${id}/${action}`,
  {},
  authConfig(token),
);
export const getSalarySheets = (token) => api.get('/payroll/sheets', authConfig(token));
export const getSalarySheet = (token, id) => api.get(`/payroll/sheets/${id}`, authConfig(token));
export const createSalarySheet = (token, month) => api.post('/payroll/sheets', { month }, authConfig(token));
export const updateSalaryLine = (token, sheetId, employeeId, payload) => api.patch(
  `/payroll/sheets/${sheetId}/lines/${employeeId}`,
  payload,
  authConfig(token),
);
export const transitionSalarySheet = (token, id, action, payload = {}) => api.post(
  `/payroll/sheets/${id}/${action}`,
  payload,
  authConfig(token),
);
export const getPayslip = (token, sheetId, employeeId) => api.get(
  `/payroll/sheets/${sheetId}/payslips/${employeeId}`,
  authConfig(token),
);
