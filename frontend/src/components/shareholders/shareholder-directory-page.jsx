'use client';

import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Search, ShoppingBag } from 'lucide-react';
import { Badge, Button, Card, Input, Select, Table } from '@/components/ui';
import { getShareholderPurchases, searchShareholders } from '@/services/shareholder';
import { T } from '@/i18n/language-provider';
import useToastMessages from '@/hooks/use-toast-messages';

const can = (permissions, permission) => permissions.includes('*') || permissions.includes(permission);
const formatDate = (value) => new Intl.DateTimeFormat('en-BD', {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date(value));
const formatMoney = (value) => new Intl.NumberFormat('en-BD', {
  style: 'currency',
  currency: 'BDT',
}).format(Number(value) || 0);

function shareholderStatus(shareholder) {
  const statuses = {
    valid: { label: 'Valid', tone: 'success' },
    invalid: { label: 'Invalid', tone: 'danger' },
    inactive: { label: 'Inactive', tone: 'neutral' },
    'wallet disabled': { label: 'Wallet disabled', tone: 'neutral' },
  };
  if (statuses[shareholder.status]) return statuses[shareholder.status];
  if (!shareholder.active) return { label: 'Inactive', tone: 'neutral' };
  return shareholder.verified
    ? { label: 'Valid', tone: 'success' }
    : { label: 'Invalid', tone: 'danger' };
}

export default function ShareholderDirectoryPage() {
  const { token, user, initialized } = useSelector((state) => state.auth);
  const permissions = user?.permissions || [];
  const canRead = can(permissions, 'shareholders:read');
  const [searchType, setSearchType] = useState('mobile');
  const [query, setQuery] = useState('');
  const [shareholders, setShareholders] = useState([]);
  const [selectedShareholder, setSelectedShareholder] = useState(null);
  const [purchases, setPurchases] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loadingPurchases, setLoadingPurchases] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState('');
  useToastMessages({ error });

  async function submitSearch(event) {
    event.preventDefault();
    const value = query.trim();
    if (!value) {
      setError(`Enter a ${searchType === 'mobile' ? 'mobile number' : 'member ID'} to search.`);
      return;
    }

    setSearching(true);
    setHasSearched(false);
    setError('');
    setShareholders([]);
    setSelectedShareholder(null);
    setPurchases([]);
    try {
      const response = await searchShareholders(token, { [searchType]: value });
      setShareholders(response.data.shareholders);
      setHasSearched(true);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to search shareholders.');
    } finally {
      setSearching(false);
    }
  }

  async function viewPurchases(shareholder) {
    setSelectedShareholder(shareholder);
    setPurchases([]);
    setLoadingPurchases(true);
    setError('');
    try {
      const response = await getShareholderPurchases(token, shareholder._id);
      setPurchases(response.data.purchases);
    } catch (requestError) {
      setSelectedShareholder(null);
      setError(requestError.response?.data?.message || 'Unable to load purchase history.');
    } finally {
      setLoadingPurchases(false);
    }
  }

  const columns = [
    {
      key: 'name',
      label: 'Shareholder',
      render: (name, shareholder) => (
        <div>
          <strong className="block text-slate-800">{name}</strong>
          <small className="text-slate-500">ID: {shareholder.memberId}</small>
        </div>
      ),
    },
    { key: 'mobile', label: 'Mobile' },
    {
      key: 'status',
      label: 'Status',
      render: (_, shareholder) => {
        const status = shareholderStatus(shareholder);
        return <Badge tone={status.tone}>{status.label}</Badge>;
      },
    },
    {
      key: 'walletEnabled',
      label: 'Wallet',
      render: (enabled) => <Badge tone={enabled ? 'info' : 'neutral'}>{enabled ? 'Enabled' : 'Disabled'}</Badge>,
    },
    {
      key: 'actions',
      label: 'Purchase history',
      render: (_, shareholder) => (
        <Button
          size="sm"
          variant={selectedShareholder?._id === shareholder._id ? 'secondary' : 'ghost'}
          onClick={() => viewPurchases(shareholder)}
          disabled={loadingPurchases}
        >
          <ShoppingBag size={15} />
          {selectedShareholder?._id === shareholder._id ? 'Viewing' : 'View purchases'}
        </Button>
      ),
    },
  ];

  const purchaseColumns = [
    { key: 'orderNumber', label: 'Order' },
    { key: 'createdAt', label: 'Date', render: formatDate },
    { key: 'grandTotal', label: 'Total', render: formatMoney },
    {
      key: 'paymentStatus',
      label: 'Payment',
      render: (status) => <Badge tone={status === 'PAID' ? 'success' : 'danger'}>{status}</Badge>,
    },
  ];

  if (!initialized) {
    return <p role="status" className="py-10 text-center text-sm text-slate-500"><T>{"Loading shareholder directory..."}</T></p>;
  }
  if (!token || !canRead) {
    return <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><T>{"You do not have permission to view shareholders."}</T></p>;
  }

  return (
    <section className="space-y-5">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase text-slate-500"><T>{"Shareholders"}</T></p>
        <h1 className="text-2xl font-semibold text-slate-900"><T>{"Shareholder Directory"}</T></h1>
        <p className="mt-1 text-sm text-slate-600"><T>{"Find a member by mobile number or member ID and review their purchase history."}</T></p>
      </div>


      <Card title="Find a shareholder" description="Search by one member identifier.">
        <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={submitSearch}>
          <div className="sm:w-44">
            <Select label="Search by" name="searchType" value={searchType} onChange={(event) => {
              setSearchType(event.target.value);
              setHasSearched(false);
            }}>
              <option value="mobile"><T>{"Mobile number"}</T></option>
              <option value="memberId"><T>{"Member ID"}</T></option>
            </Select>
          </div>
          <div className="flex-1">
            <Input
              label={searchType === 'mobile' ? 'Mobile number' : 'Member ID'}
              name="query"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setHasSearched(false);
              }}
              placeholder={searchType === 'mobile' ? 'Enter mobile number' : 'Enter member ID'}
              autoComplete="off"
            />
          </div>
          <Button type="submit" disabled={searching}>
            <Search size={16} />
            {searching ? 'Searching...' : 'Search'}
          </Button>
        </form>
      </Card>

      {shareholders.length > 0 && (
        <Card title="Search results" description={`${shareholders.length} shareholder${shareholders.length === 1 ? '' : 's'} found`}>
          <Table columns={columns} rows={shareholders} rowKey="_id" emptyMessage="No shareholders found." />
        </Card>
      )}
      {!searching && hasSearched && !error && shareholders.length === 0 && (
        <Card title="Search results">
          <p className="text-sm text-slate-500"><T>{"No shareholders found. Check the identifier and try again."}</T></p>
        </Card>
      )}

      {selectedShareholder && (
        <Card
          title={`Purchase history — ${selectedShareholder.name}`}
          description={`Member ID ${selectedShareholder.memberId} · ${selectedShareholder.mobile}`}
        >
          {loadingPurchases ? (
            <p role="status" className="py-6 text-center text-sm text-slate-500"><T>{"Loading purchase history..."}</T></p>
          ) : (
            <Table
              columns={purchaseColumns}
              rows={purchases}
              rowKey="_id"
              emptyMessage="No purchases recorded for this shareholder."
            />
          )}
        </Card>
      )}
    </section>
  );
}
