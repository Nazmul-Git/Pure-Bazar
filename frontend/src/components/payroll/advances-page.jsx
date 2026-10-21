'use client';

import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Badge, Button, Card, Input, Select, Table } from '@/components/ui';
import { createAdvance, getAdvances, getEmployees, transitionAdvance } from '@/services/payroll';
import { employeeId, formatPayrollDate, formatPayrollMoney } from './payroll-utils.mjs';

const can = (permissions, permission) => permissions.includes('*') || permissions.includes(permission);
const statusTone = { Draft: 'warning', Approved: 'success', Paid: 'success', Rejected: 'neutral' };

export default function AdvancesPage() {
  const { token, user, initialized } = useSelector((state) => state.auth);
  const permissions = user?.permissions || [];
  const canRead = can(permissions, 'payroll:read');
  const canWrite = can(permissions, 'payroll:write');
  const canReadEmployees = can(permissions, 'employees:read');
  const [employees, setEmployees] = useState([]);
  const [advances, setAdvances] = useState([]);
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [form, setForm] = useState({ employeeId: '', amount: '', reason: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [reload, setReload] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!token || !canRead) return undefined;
    let active = true;
    setLoading(true);
    setError('');
    const requests = [getAdvances(token, { employeeId: employeeFilter, status: statusFilter })];
    if (canReadEmployees) requests.push(getEmployees(token));
    Promise.all(requests)
      .then(([advanceResponse, employeeResponse]) => {
        if (!active) return;
        setAdvances(advanceResponse.data.advances);
        setEmployees(employeeResponse?.data.employees || []);
      })
      .catch((requestError) => active && setError(
        requestError.response?.data?.message || 'Unable to load salary advances.',
      ))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [canRead, canReadEmployees, employeeFilter, reload, statusFilter, token]);

  async function submitAdvance(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await createAdvance(token, {
        ...form,
        amount: Number(form.amount),
      });
      setNotice('Salary advance request created as Draft.');
      setForm({ employeeId: '', amount: '', reason: '' });
      setReload((value) => value + 1);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to create the salary advance.');
    } finally {
      setSaving(false);
    }
  }

  async function updateAdvance(advance, action) {
    setBusyId(advance._id);
    setError('');
    setNotice('');
    try {
      await transitionAdvance(token, advance._id, action);
      setNotice({
        approve: 'Advance approved.',
        reject: 'Advance rejected.',
        pay: 'Advance marked paid.',
      }[action]);
      setReload((value) => value + 1);
    } catch (requestError) {
      setError(requestError.response?.data?.message || `Unable to ${action} this advance.`);
    } finally {
      setBusyId('');
    }
  }

  const employeeById = new Map(employees.map((employee) => [employee._id, employee]));
  const columns = [
    {
      key: 'employeeId',
      label: 'Employee',
      render: (id) => {
        const employee = employeeById.get(employeeId(id));
        return employee ? <div><strong className="block text-slate-800">{employee.name}</strong><small className="text-slate-500">{employee.employeeCode}</small></div> : '—';
      },
    },
    { key: 'requestedAt', label: 'Requested', render: formatPayrollDate },
    { key: 'reason', label: 'Reason' },
    { key: 'amount', label: 'Amount', render: formatPayrollMoney },
    {
      key: 'status',
      label: 'Status',
      render: (value) => <Badge tone={statusTone[value] || 'neutral'}>{value}</Badge>,
    },
    { key: 'deductedMonth', label: 'Deducted month', render: (value) => value || '—' },
    ...(canWrite ? [{
      key: 'actions',
      label: 'Actions',
      render: (_, advance) => (
        <div className="flex flex-wrap gap-2">
          {advance.status === 'Draft' && <>
            <Button size="sm" disabled={busyId === advance._id} onClick={() => updateAdvance(advance, 'approve')}>Approve</Button>
            <Button size="sm" variant="secondary" disabled={busyId === advance._id} onClick={() => updateAdvance(advance, 'reject')}>Reject</Button>
          </>}
          {advance.status === 'Approved' && <Button size="sm" disabled={busyId === advance._id} onClick={() => updateAdvance(advance, 'pay')}>Mark paid</Button>}
        </div>
      ),
    }] : []),
  ];

  if (!initialized) return <p role="status" className="py-10 text-center text-sm text-slate-500">Loading salary advances...</p>;
  if (!token || !canRead) return <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">You do not have permission to view salary advances.</p>;

  return (
    <section className="space-y-5">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase text-slate-500">HR / Payroll</p>
        <h1 className="text-2xl font-semibold text-slate-900">Salary Advances</h1>
        <p className="mt-1 text-sm text-slate-600">Record requests, track approval and payment, and see deductions assigned to a salary sheet.</p>
      </div>
      {error && <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{notice}</p>}

      {canWrite && (
        <Card title="Record an advance" description="New requests begin in Draft. Paid advances may be deducted on a future salary sheet.">
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" onSubmit={submitAdvance}>
            <Select label="Active employee" name="employeeId" required value={form.employeeId} onChange={(event) => setForm({ ...form, employeeId: event.target.value })}>
              <option value="">Select employee</option>
              {employees.filter((employee) => employee.status === 'ACTIVE').map((employee) => <option key={employee._id} value={employee._id}>{employee.employeeCode} · {employee.name}</option>)}
            </Select>
            <Input label="Amount (BDT)" name="amount" type="number" min="0.01" step="0.01" required value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
            <Input label="Reason" name="reason" required maxLength={500} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} />
            <div className="flex items-end"><Button type="submit" disabled={saving || !employees.some((employee) => employee.status === 'ACTIVE')}>{saving ? 'Saving...' : 'Create request'}</Button></div>
            {!canReadEmployees && <p className="text-sm text-amber-700 sm:col-span-2 lg:col-span-3">Employee directory access is required to create an advance request.</p>}
          </form>
        </Card>
      )}

      <Card title="Advance register" description={`${advances.length} advance${advances.length === 1 ? '' : 's'} found`}>
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <Select label="Employee" name="advanceEmployee" value={employeeFilter} onChange={(event) => setEmployeeFilter(event.target.value)}>
            <option value="">All employees</option>
            {employees.map((employee) => <option key={employee._id} value={employee._id}>{employee.employeeCode} · {employee.name}</option>)}
          </Select>
          <Select label="Status" name="advanceStatus" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All statuses</option>
            {['Draft', 'Approved', 'Paid', 'Rejected'].map((status) => <option key={status} value={status}>{status}</option>)}
          </Select>
        </div>
        {loading ? <p role="status" className="py-8 text-center text-sm text-slate-500">Loading advances...</p>
          : <Table columns={columns} rows={advances} rowKey="_id" emptyMessage="No advances match these filters." />}
      </Card>
    </section>
  );
}
