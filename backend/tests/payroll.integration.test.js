const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const request = require('supertest');

jest.mock('../models', () => {
  const actual = {
    Employee: jest.requireActual('../models/Employee'),
    Expense: jest.requireActual('../models/Expense'),
    ExpenseCategory: jest.requireActual('../models/ExpenseCategory'),
    SalaryAdvance: jest.requireActual('../models/SalaryAdvance'),
    SalarySheet: jest.requireActual('../models/SalarySheet'),
  };
  const { fakeModel } = require('./helpers/fakeModel');
  const stores = {};
  const mocked = { AuditLog: { create: jest.fn() }, User: { findById: jest.fn() }, __stores: stores };
  Object.entries(actual).forEach(([name, Real]) => {
    stores[name] = [];
    mocked[name] = fakeModel(Real, stores[name]);
  });
  return mocked;
});

const models = require('../models');
const payrollRoutes = require('../routes/payrollRoutes');
const errorMiddleware = require('../middlewares/errorMiddleware');

const secret = 'payroll-api-test-secret';
const userId = new mongoose.Types.ObjectId('65d000000000000000000001');
const stores = models.__stores;

describe('payroll API', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/payroll', payrollRoutes);
  app.use(errorMiddleware);
  const token = () => jwt.sign({ sub: userId.toString() }, secret);
  const auth = { get Authorization() { return `Bearer ${token()}`; } };
  let permissions;
  let alice;
  let bob;

  const post = (url, body) => request(app).post(url).set(auth).send(body);

  async function paidAdvance(employeeId, amount, requestedAt) {
    const created = await post('/api/payroll/advances', { employeeId, amount, reason: 'Emergency', requestedAt });
    const { _id } = created.body.advance;
    await post(`/api/payroll/advances/${_id}/approve`);
    await post(`/api/payroll/advances/${_id}/pay`);
    return _id;
  }

  beforeEach(async () => {
    process.env.JWT_SECRET = secret;
    Object.values(stores).forEach((store) => { store.length = 0; });
    models.AuditLog.create.mockReset().mockResolvedValue({});
    permissions = ['employees:read', 'employees:write', 'payroll:read', 'payroll:write'];
    models.User.findById.mockImplementation(() => {
      const user = {
        _id: userId, isActive: true, roleId: { _id: userId, name: 'Accountant', permissions },
      };
      return { populate: jest.fn(async () => user) };
    });
    alice = (await post('/api/payroll/employees', { employeeCode: 'E1', name: 'Alice', baseSalary: 30000.555 })).body.employee;
    bob = (await post('/api/payroll/employees', { employeeCode: 'E2', name: 'Bob', baseSalary: 20000 })).body.employee;
  });

  it('manages employees with validation and unique codes', async () => {
    expect(alice.baseSalary).toBe(30000.56);
    expect((await post('/api/payroll/employees', { employeeCode: 'E1', name: 'X', baseSalary: 1 })).status).toBe(409);
    expect((await post('/api/payroll/employees', { name: 'No code', baseSalary: -1 })).status).toBe(400);
    const patched = await request(app).patch(`/api/payroll/employees/${bob._id}`).set(auth).send({ status: 'INACTIVE' });
    expect(patched.body.employee.status).toBe('INACTIVE');
    permissions = ['payroll:read'];
    expect((await post('/api/payroll/employees', { employeeCode: 'E3', name: 'Z', baseSalary: 1 })).status).toBe(403);
  });

  it('runs the advance workflow and rejects invalid transitions', async () => {
    const created = await post('/api/payroll/advances', { employeeId: alice._id, amount: 500, reason: 'Medical' });
    expect(created.status).toBe(201);
    const { _id } = created.body.advance;
    expect((await post(`/api/payroll/advances/${_id}/pay`)).status).toBe(409);
    expect((await post(`/api/payroll/advances/${_id}/approve`)).body.advance.status).toBe('Approved');
    expect((await post(`/api/payroll/advances/${_id}/reject`)).status).toBe(409);
    expect((await post(`/api/payroll/advances/${_id}/pay`)).body.advance.status).toBe('Paid');
    const other = (await post('/api/payroll/advances', { employeeId: bob._id, amount: 10, reason: 'x' })).body.advance;
    expect((await post(`/api/payroll/advances/${other._id}/reject`)).body.advance.status).toBe('Rejected');
    expect((await post('/api/payroll/advances', { employeeId: bob._id, amount: 0, reason: 'x' })).status).toBe(400);
  });

  it('deducts paid advances once, oldest first, within gross pay', async () => {
    await paidAdvance(alice._id, 1000.1, '2026-08-01');
    await paidAdvance(alice._id, 2000.2, '2026-08-02');
    await paidAdvance(bob._id, 25000, '2026-08-03');
    const draft = await post('/api/payroll/advances', { employeeId: bob._id, amount: 100, reason: 'unpaid' });
    expect(draft.status).toBe(201);

    const sheet = (await post('/api/payroll/sheets', { month: '2026-08' })).body.sheet;
    const aliceLine = sheet.lines.find((l) => l.employeeId === alice._id);
    const bobLine = sheet.lines.find((l) => l.employeeId === bob._id);
    expect(aliceLine.advanceDeduction).toBe(3000.3);
    expect(aliceLine.netAmount).toBe(27000.26);
    expect(bobLine.advanceDeduction).toBe(0);
    expect(bobLine.netAmount).toBe(20000);
    expect(sheet.totalAmount).toBe(47000.26);

    await post(`/api/payroll/sheets/${sheet._id}/approve`);
    const next = (await post('/api/payroll/sheets', { month: '2026-09' })).body.sheet;
    expect(next.lines.find((l) => l.employeeId === alice._id).advanceDeduction).toBe(0);
    expect(next.lines.find((l) => l.employeeId === bob._id).advanceDeduction).toBe(0);
    expect(stores.SalaryAdvance.filter((a) => a.deductedMonth === '2026-08')).toHaveLength(2);
  });

  it('edits a draft line only within gross pay and only while Draft', async () => {
    const sheet = (await post('/api/payroll/sheets', { month: '2026-08' })).body.sheet;
    const url = `/api/payroll/sheets/${sheet._id}/lines/${bob._id}`;
    const ok = await request(app).patch(url).set(auth).send({ allowances: 500.5, otherDeductions: 100.25 });
    expect(ok.body.sheet.lines.find((l) => l.employeeId === bob._id).netAmount).toBe(20400.25);
    expect((await request(app).patch(url).set(auth).send({ otherDeductions: 999999 })).status).toBe(400);
    await post(`/api/payroll/sheets/${sheet._id}/approve`);
    expect((await request(app).patch(url).set(auth).send({ allowances: 1 })).status).toBe(409);
  });

  it('moves Draft to Approved to Paid and creates exactly one Salary expense', async () => {
    await paidAdvance(bob._id, 1000, '2026-08-01');
    const sheet = (await post('/api/payroll/sheets', { month: '2026-08' })).body.sheet;
    expect((await post('/api/payroll/sheets', { month: '2026-08' })).status).toBe(409);
    expect((await post(`/api/payroll/sheets/${sheet._id}/pay`, { paymentMethod: 'Bank' })).status).toBe(409);
    expect(stores.Expense).toHaveLength(0);

    const approved = await post(`/api/payroll/sheets/${sheet._id}/approve`);
    expect(approved.body.sheet.status).toBe('Approved');
    expect((await post(`/api/payroll/sheets/${sheet._id}/approve`)).status).toBe(409);
    expect((await post(`/api/payroll/sheets/${sheet._id}/pay`, { paymentMethod: 'Crypto' })).status).toBe(400);

    const paid = await post(`/api/payroll/sheets/${sheet._id}/pay`, { paymentMethod: 'Bank' });
    expect(paid.status).toBe(200);
    expect(paid.body.sheet.status).toBe('Paid');
    expect(stores.Expense).toHaveLength(1);
    const [expense] = stores.Expense;
    expect(expense.amount).toBe(49000.56);
    expect(expense.sourceType).toBe('SALARY_SHEET');
    expect(String(expense.sourceId)).toBe(sheet._id);
    expect(String(paid.body.sheet.expenseId)).toBe(String(expense._id));
    expect(stores.ExpenseCategory.map((c) => c.name)).toEqual(['Salary']);

    expect((await post(`/api/payroll/sheets/${sheet._id}/pay`, { paymentMethod: 'Bank' })).status).toBe(409);
    expect(stores.Expense).toHaveLength(1);
    const entities = models.AuditLog.create.mock.calls.map(([log]) => `${log.entity}:${log.action}`);
    expect(entities).toEqual(expect.arrayContaining(['SalarySheet:CREATE', 'SalarySheet:APPROVE', 'SalarySheet:PAY', 'Expense:CREATE']));
  });

  it('returns a payslip with the deducted advances', async () => {
    await paidAdvance(alice._id, 1500, '2026-08-01');
    const sheet = (await post('/api/payroll/sheets', { month: '2026-08' })).body.sheet;
    const res = await request(app).get(`/api/payroll/sheets/${sheet._id}/payslips/${alice._id}`).set(auth);
    expect(res.status).toBe(200);
    expect(res.body.payslip).toMatchObject({
      month: '2026-08', gross: 30000.56, advanceDeduction: 1500, totalDeductions: 1500, netAmount: 28500.56,
    });
    expect(res.body.payslip.employee.name).toBe('Alice');
    expect(res.body.payslip.advances).toHaveLength(1);
    const missing = await request(app).get(`/api/payroll/sheets/${sheet._id}/payslips/${new mongoose.Types.ObjectId()}`).set(auth);
    expect(missing.status).toBe(404);
  });
});
