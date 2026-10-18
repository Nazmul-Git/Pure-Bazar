'use client';

import { useCallback, useEffect, useState } from 'react';
import useAuth from '@/store/use-auth';
import { getSalesHistory } from '@/services/pos-admin';
import { buildSalesHistoryParams } from '@/services/pos-screen-utils.cjs';

export default function usePosSales() {
  const { initialized, token, hasPermission } = useAuth();
  const canRead = hasPermission('pos:read');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadOrders = useCallback(async (filters = {}) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await getSalesHistory(buildSalesHistoryParams(filters));
      setOrders(data.orders);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load sales history.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialized) return;
    if (!token || !canRead) {
      setLoading(false);
      return;
    }
    loadOrders();
  }, [canRead, initialized, loadOrders, token]);

  return {
    orders,
    loading,
    error,
    canRead,
    loadOrders,
  };
}
