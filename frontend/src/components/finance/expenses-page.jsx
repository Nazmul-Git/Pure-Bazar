'use client';

import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Badge, Button, Card, Input, Select, Table } from '@/components/ui';
import { getLocations } from '@/services/stock';
import {
  createExpenseCategory,
  getExpenseCategories,
  getExpenses,
  saveExpense,
} from '@/services/finance';
import {
  firstDayOfMonth,
  formatFinanceDate,
  formatFinanceMoney,
  localDateInput,
} from './finance-utils';

const paymentMethods = ['Cash', 'Bank', 'bKash', 'Nagad', 'Card'];
const newForm = () => ({
  categoryId: '', amount: '', description: '', paymentMethod: 'Cash', locationId: '', expenseDate: localDateInput(),
});
const populatedId = (value) => (typeof value === 'string' ? value : value?._id || '');

export default function ExpensesPage() {
  const { token, user, initialized } = useSelector((state) => state.auth);
  const permissions = user?.permissions || [];
  const canRead = permissions.includes('*') || permissions.includes('expenses:read');
  const canWrite = permissions.includes('*') || permissions.includes('expenses:write');
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [filters, setFilters] = useState({
    startDate: firstDayOfMonth(), endDate: localDateInput(), categoryId: '', locationId: '', paymentMethod: '',
  });
  const [form, setForm] = useState(newForm());
  const [attachment, setAttachment] = useState(null);
  const [editingId, setEditingId] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!token || !canRead) return undefined;
    let active = true;
    setLoading(true);
    setError('');
    if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) {
      setError('Start date must be on or before end date.');
      setLoading(false);
      return () => { active = false; };
    }
    Promise.all([
      getExpenseCategories(token),
      getExpenses(token, filters),
      getLocations(token),
    ])
      .then(([categoryResponse, expenseResponse, locationResponse]) => {
        if (!active) return;
        setCategories(categoryResponse.data.categories);
        setExpenses(expenseResponse.data.expenses);
        setLocations(locationResponse.data.locations);
      })
      .catch((requestError) => active && setError(
        requestError.response?.data?.message || 'Unable to load expenses and reference data.',
      ))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [canRead, filters, reload, token]);

  function startEdit(expense) {
    setEditingId(expense._id);
    setAttachment(null);
    setForm({
      categoryId: populatedId(expense.categoryId),
      amount: String(expense.amount),
      description: expense.description,
      paymentMethod: expense.paymentMethod,
      locationId: populatedId(expense.locationId),
      expenseDate: String(expense.expenseDate).slice(0, 10),
    });
    setNotice('');
  }

  function cancelEdit() {
    setEditingId('');
    setAttachment(null);
    setForm(newForm());
  }

  async function submitExpense(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    const payload = new FormData();
    Object.entries(form).forEach(([key, value]) => payload.append(key, value));
    if (attachment) payload.append('attachment', attachment);
    try {
      await saveExpense(token, payload, editingId);
      setNotice(editingId ? 'Expense updated.' : 'Expense recorded.');
      cancelEdit();
      setReload((value) => value + 1);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save the expense.');
    } finally {
      setSaving(false);
    }
  }

  async function submitCategory(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    try {
      const { data } = await createExpenseCategory(token, { name: categoryName });
      setCategoryName('');
      setNotice(`Category "${data.category.name}" created.`);
      setReload((value) => value + 1);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to create the expense category.');
    }
  }

  const columns = [
    { key: 'expenseDate', label: 'Date', render: (value) => formatFinanceDate(value) },
    { key: 'categoryId', label: 'Category', render: (value) => value?.name || '—' },
    { key: 'description', label: 'Description', render: (value, row) => <><span>{value}</span>{row.attachment?.originalName && <small className="mt-1 block text-slate-500">Attachment: {row.attachment.originalName}</small>}</> },
    { key: 'locationId', label: 'Location', render: (value) => value?.name || '—' },
    { key: 'paymentMethod', label: 'Payment' },
    { key: 'amount', label: 'Amount', render: (value) => formatFinanceMoney(value) },
    { key: 'actions', label: 'Actions', render: (_, row) => row.sourceType === 'SALARY_SHEET'
      ? <Badge tone="neutral">Payroll locked</Badge>
      : canWrite && <Button size="sm" variant="secondary" onClick={() => startEdit(row)}>Edit</Button> },
  ];

  if (!initialized) return <p role="status" className="py-10 text-center text-sm text-slate-500">Loading expenses...</p>;
  if (!token || !canRead) return <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">You do not have permission to view expenses.</p>;

  return (
    <section className="space-y-5">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Finance</p>
        <h1 className="text-2xl font-semibold text-slate-900">Expenses</h1>
        <p className="mt-1 text-sm text-slate-600">Track operating expenses by category, location and payment method.</p>
      </div>
      {error && <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{notice}</p>}

      {canWrite && (
        <Card title={editingId ? 'Edit expense' : 'Record an expense'} description="Expenses in a paid payroll month and payroll-generated entries cannot be edited.">
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" onSubmit={submitExpense}>
            <Select label="Category" name="categoryId" required value={form.categoryId} onChange={(event) => setForm((value) => ({ ...value, categoryId: event.target.value }))}>
              <option value="">Select a category</option>
              {categories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}
            </Select>
            <Input label="Amount (BDT)" name="amount" type="number" min="0.01" step="0.01" required value={form.amount} onChange={(event) => setForm((value) => ({ ...value, amount: event.target.value }))} />
            <Input label="Expense date" name="expenseDate" type="date" required value={form.expenseDate} onChange={(event) => setForm((value) => ({ ...value, expenseDate: event.target.value }))} />
            <Select label="Location" name="locationId" required value={form.locationId} onChange={(event) => setForm((value) => ({ ...value, locationId: event.target.value }))}>
              <option value="">Select a location</option>
              {locations.map((location) => <option key={location.id} value={location.id}>{location.name} · {location.type}</option>)}
            </Select>
            <Select label="Payment method" name="paymentMethod" required value={form.paymentMethod} onChange={(event) => setForm((value) => ({ ...value, paymentMethod: event.target.value }))}>
              {paymentMethods.map((method) => <option key={method} value={method}>{method}</option>)}
            </Select>
            <label className="ui-field">
              <span className="field-label">Receipt attachment (PDF, PNG or JPEG; max 5 MB)</span>
              <input className="ui-input" type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" onChange={(event) => setAttachment(event.target.files?.[0] || null)} />
            </label>
            <label className="ui-field sm:col-span-2 lg:col-span-3" htmlFor="expense-description">
              <span className="field-label">Description</span>
              <textarea id="expense-description" className="ui-input min-h-20" required maxLength={500} value={form.description} onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))} />
            </label>
            <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
              <Button type="submit" disabled={saving || !categories.length || !locations.length}>{saving ? 'Saving...' : editingId ? 'Save changes' : 'Record expense'}</Button>
              {editingId && <Button type="button" variant="secondary" onClick={cancelEdit}>Cancel</Button>}
            </div>
          </form>
          <form className="mt-5 flex flex-wrap items-end gap-2 border-t border-slate-200 pt-4" onSubmit={submitCategory}>
            <Input label="New category" name="categoryName" value={categoryName} maxLength={100} required onChange={(event) => setCategoryName(event.target.value)} />
            <Button type="submit" variant="secondary">Add category</Button>
          </form>
        </Card>
      )}

      <Card title="Expense register" description="Totals and rows reflect the active filters.">
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Input label="From" name="startDate" type="date" value={filters.startDate} onChange={(event) => setFilters((value) => ({ ...value, startDate: event.target.value }))} />
          <Input label="To" name="endDate" type="date" value={filters.endDate} onChange={(event) => setFilters((value) => ({ ...value, endDate: event.target.value }))} />
          <Select label="Category" name="categoryFilter" value={filters.categoryId} onChange={(event) => setFilters((value) => ({ ...value, categoryId: event.target.value }))}>
            <option value="">All categories</option>
            {categories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}
          </Select>
          <Select label="Location" name="locationFilter" value={filters.locationId} onChange={(event) => setFilters((value) => ({ ...value, locationId: event.target.value }))}>
            <option value="">All locations</option>
            {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
          </Select>
          <Select label="Payment method" name="paymentFilter" value={filters.paymentMethod} onChange={(event) => setFilters((value) => ({ ...value, paymentMethod: event.target.value }))}>
            <option value="">All methods</option>
            {paymentMethods.map((method) => <option key={method} value={method}>{method}</option>)}
          </Select>
        </div>
        {loading ? <p role="status" className="py-8 text-center text-sm text-slate-500">Loading expenses...</p> : (
          <>
            <div className="mb-3 text-sm text-slate-600">{expenses.length} expenses · <strong>{formatFinanceMoney(expenses.reduce((sum, row) => sum + Math.round((Number(row.amount) + Number.EPSILON) * 100), 0) / 100)}</strong> total</div>
            <Table columns={columns} rows={expenses} rowKey="_id" emptyMessage="No expenses match these filters." />
          </>
        )}
      </Card>
    </section>
  );
}
