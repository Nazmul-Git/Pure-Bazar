'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Search } from 'lucide-react';
import { Badge, Card, Input, Table } from '@/components/ui';
import { getLocations, getWarehouseStock } from '@/services/stock';

const can = (permissions, permission) => permissions.includes('*') || permissions.includes(permission);

export default function WarehousePage() {
  const { token, user, initialized } = useSelector((state) => state.auth);
  const canRead = can(user?.permissions || [], 'stock:read');
  const [location, setLocation] = useState(null);
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!initialized) return undefined;
    if (!token || !canRead) {
      setLoading(false);
      return undefined;
    }
    let active = true;
    getLocations(token, 'CENTRAL')
      .then(async (response) => {
        const central = response.data.locations.find(({ type }) => type === 'CENTRAL');
        if (!central) throw new Error('Central Warehouse is not configured. Run the default data seed first.');
        const stockResponse = await getWarehouseStock(token, central.id);
        if (!active) return;
        setLocation(central);
        setStock(stockResponse.data.stock);
      })
      .catch((requestError) => active && setError(
        requestError.response?.data?.message || requestError.message || 'Unable to load Central Warehouse stock.',
      ))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [canRead, initialized, token]);

  const visibleStock = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return stock;
    return stock.filter((item) => `${item.productName} ${item.barcode}`.toLowerCase().includes(query));
  }, [search, stock]);

  const columns = [
    { key: 'productName', label: 'Product' },
    { key: 'barcode', label: 'Barcode' },
    {
      key: 'ownerType',
      label: 'Owner',
      render: (ownerType) => <Badge tone={ownerType === 'VENDOR' ? 'info' : 'neutral'}>{ownerType === 'VENDOR' ? 'Vendor' : 'Company'}</Badge>,
    },
    { key: 'quantity', label: 'Current stock', render: (quantity) => <strong className="text-slate-900">{Number(quantity) || 0}</strong> },
  ];

  if (!initialized || loading) return <p role="status" className="py-10 text-center text-sm text-slate-500">Loading Central Warehouse stock...</p>;
  if (!token || !canRead) return <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">You do not have permission to view warehouse stock.</p>;

  return (
    <section className="space-y-5">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Inventory</p>
        <h1 className="text-2xl font-semibold text-slate-900">{location?.name || 'Central Warehouse'} Stock</h1>
        <p className="mt-1 text-sm text-slate-600">Current balance is calculated from approved stock movements.</p>
      </div>
      {error && <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      <Card title="Stock on hand" description={`${stock.length} products with stock movement history`}>
        <div className="mb-4 max-w-sm">
          <Input label="Search stock" name="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Product name or barcode" />
          <Search size={16} aria-hidden="true" className="pointer-events-none relative -mt-7 ml-auto mr-3 text-slate-400" />
        </div>
        <Table columns={columns} rows={visibleStock} rowKey="productId" emptyMessage={search ? 'No stock items match your search.' : 'No stock movement has been recorded for this warehouse.'} />
      </Card>
    </section>
  );
}
