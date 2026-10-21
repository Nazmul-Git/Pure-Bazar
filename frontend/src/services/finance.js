import api from './api';

function authConfig(token) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

function withParams(token, params = {}) {
  return {
    ...authConfig(token),
    params: Object.fromEntries(Object.entries(params).filter(([, value]) => value !== '')),
  };
}

export const getRevenueLedger = (token, params) => api.get(
  '/finance/revenue-ledger',
  withParams(token, params),
);

export const getWalletReconciliation = (token, date) => api.get(
  '/finance/wallet-reconciliation',
  withParams(token, { date }),
);

export const runWalletReconciliation = (token, date) => api.post(
  '/finance/wallet-reconciliation/run',
  { date },
  authConfig(token),
);

export const resolveWalletReconciliation = (token, id, reason) => api.post(
  `/finance/wallet-reconciliation/${id}/resolve`,
  { reason },
  authConfig(token),
);

export const getExpenseCategories = (token) => api.get(
  '/finance/expense-categories',
  authConfig(token),
);

export const createExpenseCategory = (token, payload) => api.post(
  '/finance/expense-categories',
  payload,
  authConfig(token),
);

export const getExpenses = (token, params) => api.get(
  '/finance/expenses',
  withParams(token, params),
);

export const saveExpense = (token, payload, id) => api.request({
  method: id ? 'PATCH' : 'POST',
  url: id ? `/finance/expenses/${id}` : '/finance/expenses',
  data: payload,
  ...authConfig(token),
});

export const approvePayoutBatch = (token, statementIds) => api.post(
  '/finance/payout-batches',
  { statementIds },
  authConfig(token),
);
