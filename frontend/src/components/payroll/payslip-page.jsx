'use client';

import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Printer } from 'lucide-react';
import { Badge, Button, Card, Select, Table } from '@/components/ui';
import { getEmployees, getPayslip, getSalarySheet, getSalarySheets } from '@/services/payroll';
import { employeeId, formatPayrollDate, formatPayrollMoney } from './payroll-utils.mjs';

const can = (permissions, permission) => permissions.includes('*') || permissions.includes(permission);

export default function PayslipPage() {
  const { token, user, initialized } = useSelector((state) => state.auth);
  const permissions = user?.permissions || [];
  const canRead = can(permissions, 'payroll:read');
  const canReadEmployees = can(permissions, 'employees:read');
  const [sheets, setSheets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [sheetId, setSheetId] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [sheet, setSheet] = useState(null);
  const [payslip, setPayslip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token || !canRead) return undefined;
    let active = true;
    Promise.all([
      getSalarySheets(token),
      ...(canReadEmployees ? [getEmployees(token)] : []),
    ])
      .then((responses) => {
        if (!active) return;
        const availableSheets = responses[0].data.sheets;
        setSheets(availableSheets);
        if (canReadEmployees) setEmployees(responses[1].data.employees);
        const params = new URLSearchParams(window.location.search);
        const requestedSheet = params.get('sheetId');
        const requestedEmployee = params.get('employeeId') || '';
        setSheetId(availableSheets.some((item) => item._id === requestedSheet)
          ? requestedSheet : availableSheets[0]?._id || '');
        setSelectedEmployeeId(requestedEmployee);
      })
      .catch((requestError) => active && setError(
        requestError.response?.data?.message || 'Unable to load salary sheets.',
      ))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [canRead, canReadEmployees, token]);

  useEffect(() => {
    if (!token || !sheetId || !canRead) {
      setSheet(null);
      setPayslip(null);
      return undefined;
    }
    let active = true;
    setError('');
    setSheet(null);
    setPayslip(null);
    getSalarySheet(token, sheetId)
      .then(({ data }) => {
        if (!active) return;
        setSheet(data.sheet);
        const lineIds = data.sheet.lines.map((line) => employeeId(line.employeeId));
        if (!lineIds.includes(selectedEmployeeId)) setSelectedEmployeeId(lineIds[0] || '');
      })
      .catch((requestError) => active && setError(
        requestError.response?.data?.message || 'Unable to load the selected salary sheet.',
      ));
    return () => { active = false; };
  }, [canRead, sheetId, token]);

  useEffect(() => {
    if (!token || !sheetId || !selectedEmployeeId || !sheet) return undefined;
    if (!sheet.lines.some((line) => employeeId(line.employeeId) === selectedEmployeeId)) return undefined;
    let active = true;
    getPayslip(token, sheetId, selectedEmployeeId)
      .then(({ data }) => active && setPayslip(data.payslip))
      .catch((requestError) => active && setError(
        requestError.response?.data?.message || 'Unable to load this payslip.',
      ));
    return () => { active = false; };
  }, [selectedEmployeeId, sheet, sheetId, token]);

  const employeeById = new Map(employees.map((employee) => [employee._id, employee]));
  const selectedSheet = sheets.find((item) => item._id === sheetId);

  if (!initialized) return <p role="status" className="py-10 text-center text-sm text-slate-500">Loading payslips...</p>;
  if (!token || !canRead) return <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">You do not have permission to view payslips.</p>;

  const advanceColumns = [
    { key: 'requestedAt', label: 'Date', render: formatPayrollDate },
    { key: 'reason', label: 'Reason' },
    { key: 'amount', label: 'Amount', render: formatPayrollMoney },
  ];

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-slate-500">HR / Payroll</p>
          <h1 className="text-2xl font-semibold text-slate-900">Payslips</h1>
          <p className="mt-1 text-sm text-slate-600">Review an employee's monthly payroll statement or print a copy.</p>
        </div>
        {payslip && <Button variant="secondary" onClick={() => window.print()}><Printer size={16} /> Print payslip</Button>}
      </div>
      {error && <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}

      <Card title="Choose payslip" description="Select a salary sheet and employee to view their read-only statement.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Select label="Salary sheet" name="payslipSheet" value={sheetId} onChange={(event) => { setSheetId(event.target.value); setSelectedEmployeeId(''); }}>
            <option value="">Select a salary sheet</option>
            {sheets.map((item) => <option key={item._id} value={item._id}>{item.month} · {item.status}</option>)}
          </Select>
          <Select label="Employee" name="payslipEmployee" value={selectedEmployeeId} onChange={(event) => setSelectedEmployeeId(event.target.value)} disabled={!sheet}>
            <option value="">Select an employee</option>
            {(sheet?.lines || []).map((line) => {
              const id = employeeId(line.employeeId);
              const employee = employeeById.get(id);
              return <option key={id} value={id}>{employee ? `${employee.employeeCode} · ${employee.name}` : `Employee ${id.slice(-8)}`}</option>;
            })}
          </Select>
        </div>
      </Card>

      {loading ? <p role="status" className="py-8 text-center text-sm text-slate-500">Loading payslip data...</p>
        : payslip && (
          <Card title="Employee payslip" description={`${payslip.month} · ${payslip.employee?.employeeCode || ''}`}>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{payslip.employee?.name || 'Employee'}</h2>
                <p className="text-sm text-slate-600">{payslip.employee?.designation || '—'} · {payslip.month}</p>
              </div>
              <Badge tone={payslip.status === 'Paid' ? 'success' : payslip.status === 'Approved' ? 'warning' : 'neutral'}>{payslip.status}</Badge>
            </div>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div><dt className="text-sm text-slate-500">Base salary</dt><dd className="mt-1 font-semibold text-slate-800">{formatPayrollMoney(payslip.baseSalary)}</dd></div>
              <div><dt className="text-sm text-slate-500">Allowances</dt><dd className="mt-1 font-semibold text-slate-800">{formatPayrollMoney(payslip.allowances)}</dd></div>
              <div><dt className="text-sm text-slate-500">Gross pay</dt><dd className="mt-1 font-semibold text-slate-800">{formatPayrollMoney(payslip.gross)}</dd></div>
              <div><dt className="text-sm text-slate-500">Advance deductions</dt><dd className="mt-1 font-semibold text-slate-800">{formatPayrollMoney(payslip.advanceDeduction)}</dd></div>
              <div><dt className="text-sm text-slate-500">Other deductions</dt><dd className="mt-1 font-semibold text-slate-800">{formatPayrollMoney(payslip.otherDeductions)}</dd></div>
              <div><dt className="text-sm text-slate-500">Total deductions</dt><dd className="mt-1 font-semibold text-slate-800">{formatPayrollMoney(payslip.totalDeductions)}</dd></div>
              <div className="sm:col-span-2 lg:col-span-3"><dt className="text-sm text-slate-500">Net pay</dt><dd className="mt-1 text-2xl font-bold text-slate-900">{formatPayrollMoney(payslip.netAmount)}</dd></div>
              {payslip.paidAt && <div><dt className="text-sm text-slate-500">Paid date</dt><dd className="mt-1 font-semibold text-slate-800">{formatPayrollDate(payslip.paidAt)}</dd></div>}
            </dl>
            <div className="mt-6">
              <h3 className="mb-2 font-semibold text-slate-800">Advance deductions</h3>
              <Table columns={advanceColumns} rows={payslip.advances || []} rowKey="_id" emptyMessage="No advances were deducted for this employee." />
            </div>
          </Card>
        )}
      {!loading && !payslip && selectedSheet && !error && <p className="rounded border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">Select an employee to view their payslip.</p>}
    </section>
  );
}
