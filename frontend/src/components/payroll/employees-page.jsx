'use client';

import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Badge, Button, Card, Input, Select, Table } from '@/components/ui';
import { getEmployees, saveEmployee } from '@/services/payroll';
import { formatPayrollDate, formatPayrollMoney } from './payroll-utils.mjs';

const blankEmployee = () => ({
  employeeCode: '', name: '', phone: '', email: '', designation: '', department: '',
  baseSalary: '', hireDate: '', status: 'ACTIVE',
});
const can = (permissions, permission) => permissions.includes('*') || permissions.includes(permission);

export default function EmployeesPage() {
  const { token, user, initialized } = useSelector((state) => state.auth);
  const permissions = user?.permissions || [];
  const canRead = can(permissions, 'employees:read');
  const canWrite = can(permissions, 'employees:write');
  const [employees, setEmployees] = useState([]);
  const [status, setStatus] = useState('');
  const [form, setForm] = useState(blankEmployee);
  const [editingId, setEditingId] = useState('');
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
    getEmployees(token, status)
      .then(({ data }) => active && setEmployees(data.employees))
      .catch((requestError) => active && setError(
        requestError.response?.data?.message || 'Unable to load employees.',
      ))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [canRead, reload, status, token]);

  function editEmployee(employee) {
    setEditingId(employee._id);
    setForm({
      employeeCode: employee.employeeCode,
      name: employee.name,
      phone: employee.phone || '',
      email: employee.email || '',
      designation: employee.designation || '',
      department: employee.department || '',
      baseSalary: String(employee.baseSalary),
      hireDate: employee.hireDate ? String(employee.hireDate).slice(0, 10) : '',
      status: employee.status,
    });
    setNotice('');
  }

  function resetForm() {
    setEditingId('');
    setForm(blankEmployee());
  }

  async function submitEmployee(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    const payload = Object.fromEntries(
      Object.entries(form).filter(([, value]) => value !== ''),
    );
    try {
      await saveEmployee(token, payload, editingId);
      setNotice(editingId ? 'Employee updated.' : 'Employee added.');
      resetForm();
      setReload((value) => value + 1);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save the employee.');
    } finally {
      setSaving(false);
    }
  }

  const columns = [
    {
      key: 'name',
      label: 'Employee',
      render: (name, row) => <div><strong className="block text-slate-800">{name}</strong><small className="text-slate-500">{row.employeeCode}</small></div>,
    },
    { key: 'designation', label: 'Designation', render: (value) => value || '—' },
    { key: 'department', label: 'Department', render: (value) => value || '—' },
    { key: 'phone', label: 'Phone', render: (value) => value || '—' },
    { key: 'baseSalary', label: 'Base salary', render: formatPayrollMoney },
    { key: 'hireDate', label: 'Hire date', render: formatPayrollDate },
    {
      key: 'status',
      label: 'Status',
      render: (value) => <Badge tone={value === 'ACTIVE' ? 'success' : 'neutral'}>{value}</Badge>,
    },
    ...(canWrite ? [{
      key: 'actions',
      label: 'Actions',
      render: (_, employee) => <Button size="sm" variant="secondary" onClick={() => editEmployee(employee)}>Edit</Button>,
    }] : []),
  ];

  if (!initialized) return <p role="status" className="py-10 text-center text-sm text-slate-500">Loading employees...</p>;
  if (!token || !canRead) return <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">You do not have permission to view employees.</p>;

  return (
    <section className="space-y-5">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase text-slate-500">HR / Payroll</p>
        <h1 className="text-2xl font-semibold text-slate-900">Employees</h1>
        <p className="mt-1 text-sm text-slate-600">Maintain employee details and current payroll status.</p>
      </div>
      {error && <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{notice}</p>}

      {canWrite && (
        <Card title={editingId ? 'Edit employee' : 'Add employee'} description="Employee codes must be unique. Base salary is recorded in BDT.">
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" onSubmit={submitEmployee}>
            <Input label="Employee code" name="employeeCode" required maxLength={50} value={form.employeeCode} onChange={(event) => setForm({ ...form, employeeCode: event.target.value })} />
            <Input label="Full name" name="name" required maxLength={150} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            <Input label="Base salary (BDT)" name="baseSalary" type="number" min="0" step="0.01" required value={form.baseSalary} onChange={(event) => setForm({ ...form, baseSalary: event.target.value })} />
            <Input label="Phone" name="phone" maxLength={30} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            <Input label="Email" name="email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            <Input label="Designation" name="designation" maxLength={100} value={form.designation} onChange={(event) => setForm({ ...form, designation: event.target.value })} />
            <Input label="Department" name="department" maxLength={100} value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} />
            <Input label="Hire date" name="hireDate" type="date" value={form.hireDate} onChange={(event) => setForm({ ...form, hireDate: event.target.value })} />
            <Select label="Status" name="status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
              <option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option>
            </Select>
            <div className="flex items-end gap-2">
              <Button type="submit" disabled={saving}>{saving ? 'Saving...' : editingId ? 'Save changes' : 'Add employee'}</Button>
              {editingId && <Button type="button" variant="secondary" onClick={resetForm}>Cancel</Button>}
            </div>
          </form>
        </Card>
      )}

      <Card title="Employee directory" description={`${employees.length} employee${employees.length === 1 ? '' : 's'} shown`}>
        <div className="mb-4 max-w-xs">
          <Select label="Filter by status" name="employeeFilter" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All employees</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option>
          </Select>
        </div>
        {loading ? <p role="status" className="py-8 text-center text-sm text-slate-500">Loading employees...</p>
          : <Table columns={columns} rows={employees} rowKey="_id" emptyMessage="No employees match this filter." />}
      </Card>
    </section>
  );
}
