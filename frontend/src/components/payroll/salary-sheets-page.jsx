'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSelector } from 'react-redux';
import { Badge, Button, Card, Input, Select, Table } from '@/components/ui';
import { getLocations } from '@/services/stock';
import {
  createSalarySheet, getEmployees, getSalarySheet, getSalarySheets,
  transitionSalarySheet, updateSalaryLine,
} from '@/services/payroll';
import { employeeId, formatPayrollMoney, monthNow } from './payroll-utils.mjs';

const can = (permissions, permission) => permissions.includes('*') || permissions.includes(permission);
const paymentMethods = ['Cash', 'Bank', 'bKash', 'Nagad', 'Card'];

export default function SalarySheetsPage() {
  const { token, user, initialized } = useSelector((state) => state.auth);
  const permissions = user?.permissions || [];
  const canRead = can(permissions, 'payroll:read');
  const canWrite = can(permissions, 'payroll:write');
  const canReadEmployees = can(permissions, 'employees:read');
  const [sheets, setSheets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [sheet, setSheet] = useState(null);
  const [month, setMonth] = useState(monthNow());
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [locationId, setLocationId] = useState('');
  const [lineEdits, setLineEdits] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!token || !canRead) return undefined;
    let active = true;
    setLoading(true);
    setError('');
    const requests = [getSalarySheets(token)];
    if (canReadEmployees) requests.push(getEmployees(token));
    if (can(permissions, 'expenses:read') || can(permissions, 'stock:read')) requests.push(getLocations(token));
    Promise.all(requests)
      .then((responses) => {
        if (!active) return;
        setSheets(responses[0].data.sheets);
        if (canReadEmployees) setEmployees(responses[1].data.employees);
        if (requests.length > (canReadEmployees ? 1 : 0) + 1) setLocations(responses[responses.length - 1].data.locations);
        setSelectedId((current) => current || responses[0].data.sheets[0]?._id || '');
      })
      .catch((requestError) => active && setError(
        requestError.response?.data?.message || 'Unable to load salary sheets.',
      ))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [canRead, canReadEmployees, permissions, reload, token]);

  useEffect(() => {
    if (!token || !selectedId || !canRead) {
      setSheet(null);
      return undefined;
    }
    let active = true;
    setSheet(null);
    getSalarySheet(token, selectedId)
      .then(({ data }) => {
        if (!active) return;
        setSheet(data.sheet);
        setLineEdits(Object.fromEntries(data.sheet.lines.map((line) => [employeeId(line.employeeId), {
          allowances: String(line.allowances || 0),
          otherDeductions: String(line.otherDeductions || 0),
        }])));
      })
      .catch((requestError) => active && setError(
        requestError.response?.data?.message || 'Unable to load the selected salary sheet.',
      ));
    return () => { active = false; };
  }, [canRead, reload, selectedId, token]);

  const employeeById = useMemo(
    () => new Map(employees.map((employee) => [employee._id, employee])),
    [employees],
  );

  async function createSheet(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { data } = await createSalarySheet(token, month);
      setSelectedId(data.sheet._id);
      setNotice(`Salary sheet for ${data.sheet.month} created.`);
      setReload((value) => value + 1);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to create the salary sheet.');
    } finally {
      setBusy(false);
    }
  }

  async function saveLine(employee, line) {
    const id = employeeId(line.employeeId);
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { data } = await updateSalaryLine(token, sheet._id, id, {
        allowances: Number(lineEdits[id]?.allowances || 0),
        otherDeductions: Number(lineEdits[id]?.otherDeductions || 0),
      });
      setSheet(data.sheet);
      setLineEdits(Object.fromEntries(data.sheet.lines.map((item) => [employeeId(item.employeeId), {
        allowances: String(item.allowances || 0), otherDeductions: String(item.otherDeductions || 0),
      }])));
      setNotice(`${employee?.name || 'Employee'}'s payroll line saved.`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save this payroll line.');
    } finally {
      setBusy(false);
    }
  }

  async function runSheetAction(action) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await transitionSalarySheet(token, sheet._id, action, action === 'pay'
        ? { paymentMethod, ...(locationId ? { locationId } : {}) }
        : {});
      setNotice(action === 'approve' ? 'Salary sheet approved.' : 'Salary sheet paid.');
      setReload((value) => value + 1);
    } catch (requestError) {
      setError(requestError.response?.data?.message || `Unable to ${action} the salary sheet.`);
    } finally {
      setBusy(false);
    }
  }

  const columns = [
    {
      key: 'employeeId',
      label: 'Employee',
      render: (value) => {
        const employee = employeeById.get(employeeId(value));
        return employee ? <div><strong className="block text-slate-800">{employee.name}</strong><small className="text-slate-500">{employee.employeeCode}</small></div> : <span className="text-xs text-slate-500">{employeeId(value).slice(-8)}</span>;
      },
    },
    { key: 'baseSalary', label: 'Base salary', render: formatPayrollMoney },
    {
      key: 'allowances',
      label: 'Allowances',
      render: (value, line) => sheet?.status === 'Draft' && canWrite
        ? <Input aria-label={`Allowances for ${employeeId(line.employeeId)}`} type="number" min="0" step="0.01" value={lineEdits[employeeId(line.employeeId)]?.allowances ?? value} onChange={(event) => setLineEdits((current) => ({ ...current, [employeeId(line.employeeId)]: { ...current[employeeId(line.employeeId)], allowances: event.target.value } }))} />
        : formatPayrollMoney(value),
    },
    { key: 'advanceDeduction', label: 'Advance', render: formatPayrollMoney },
    {
      key: 'otherDeductions',
      label: 'Other deductions',
      render: (value, line) => sheet?.status === 'Draft' && canWrite
        ? <Input aria-label={`Other deductions for ${employeeId(line.employeeId)}`} type="number" min="0" step="0.01" value={lineEdits[employeeId(line.employeeId)]?.otherDeductions ?? value} onChange={(event) => setLineEdits((current) => ({ ...current, [employeeId(line.employeeId)]: { ...current[employeeId(line.employeeId)], otherDeductions: event.target.value } }))} />
        : formatPayrollMoney(value),
    },
    { key: 'netAmount', label: 'Net pay', render: formatPayrollMoney },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, line) => (
        <div className="flex flex-wrap gap-2">
          {sheet?.status === 'Draft' && canWrite && <Button size="sm" variant="secondary" disabled={busy} onClick={() => saveLine(employeeById.get(employeeId(line.employeeId)), line)}>Save</Button>}
          <Link className="ui-button button-secondary button-sm" href={`/payroll/payslips?sheetId=${sheet?._id}&employeeId=${employeeId(line.employeeId)}`}>Payslip</Link>
        </div>
      ),
    },
  ];

  if (!initialized) return <p role="status" className="py-10 text-center text-sm text-slate-500">Loading salary sheets...</p>;
  if (!token || !canRead) return <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">You do not have permission to view salary sheets.</p>;

  return (
    <section className="space-y-5">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase text-slate-500">HR / Payroll</p>
        <h1 className="text-2xl font-semibold text-slate-900">Salary Sheet</h1>
        <p className="mt-1 text-sm text-slate-600">Prepare monthly payroll, review deductions, and record salary payments.</p>
      </div>
      {error && <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{notice}</p>}

      <Card title="Create monthly sheet" description="A sheet includes active employees and eligible paid advances. Only one sheet can exist per month.">
        <form className="flex flex-wrap items-end gap-3" onSubmit={createSheet}>
          <Input label="Payroll month" name="month" type="month" required value={month} onChange={(event) => setMonth(event.target.value)} />
          {canWrite && <Button type="submit" disabled={busy || !month}>{busy ? 'Working...' : 'Create sheet'}</Button>}
        </form>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[18rem_1fr]">
        <Card title="Salary sheets" description="Select a month to review its payroll.">
          {loading ? <p role="status" className="py-6 text-center text-sm text-slate-500">Loading sheets...</p> : (
            <div className="space-y-2">
              {sheets.map((item) => (
                <button key={item._id} type="button" className={`w-full rounded-lg border p-3 text-left ${selectedId === item._id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`} onClick={() => setSelectedId(item._id)}>
                  <span className="flex items-center justify-between gap-2 font-semibold text-slate-800">{item.month}<Badge tone={item.status === 'Paid' ? 'success' : item.status === 'Approved' ? 'warning' : 'neutral'}>{item.status}</Badge></span>
                  <span className="mt-2 block text-sm text-slate-600">{formatPayrollMoney(item.totalAmount)}</span>
                </button>
              ))}
              {!sheets.length && <p className="py-5 text-center text-sm text-slate-500">No salary sheets created.</p>}
            </div>
          )}
        </Card>

        <Card title={sheet ? `Payroll · ${sheet.month}` : 'Payroll details'} description={sheet ? `${sheet.lines.length} employees · Total ${formatPayrollMoney(sheet.totalAmount)}` : 'Choose an existing salary sheet to view its lines.'}>
          {sheet && <>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <Badge tone={sheet.status === 'Paid' ? 'success' : sheet.status === 'Approved' ? 'warning' : 'neutral'}>{sheet.status}</Badge>
              {canWrite && sheet.status === 'Draft' && <Button disabled={busy} onClick={() => runSheetAction('approve')}>Approve sheet</Button>}
              {canWrite && sheet.status === 'Approved' && <>
                <Select label="Payment method" name="payMethod" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                  {paymentMethods.map((method) => <option key={method} value={method}>{method}</option>)}
                </Select>
                {locations.length > 0 && (
                  <Select label="Expense location (optional)" name="payLocation" value={locationId} onChange={(event) => setLocationId(event.target.value)}>
                    <option value="">No location</option>
                    {locations.map((location) => <option key={location.id} value={location.id}>{location.name} · {location.type}</option>)}
                  </Select>
                )}
                <Button disabled={busy} onClick={() => runSheetAction('pay')}>Record payment</Button>
              </>}
              {sheet.status === 'Paid' && <span className="text-sm text-slate-600">Paid · {sheet.paidAt ? new Date(sheet.paidAt).toLocaleDateString('en-BD') : 'date unavailable'}</span>}
            </div>
            <Table columns={columns} rows={sheet.lines} rowKey="_id" emptyMessage="This sheet has no payroll lines." />
          </>}
        </Card>
      </div>
    </section>
  );
}
