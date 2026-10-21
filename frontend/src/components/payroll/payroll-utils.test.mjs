import test from 'node:test';
import assert from 'node:assert/strict';
import {
  employeeId, formatPayrollDate, formatPayrollMoney, monthNow,
} from './payroll-utils.mjs';

test('formats payroll money to two decimals', () => {
  assert.match(formatPayrollMoney(12), /12\.00/);
});

test('formats valid dates and handles invalid dates', () => {
  assert.equal(formatPayrollDate('not-a-date'), '—');
  assert.notEqual(formatPayrollDate('2026-02-01'), '—');
});

test('reads employee IDs from raw or populated references', () => {
  assert.equal(employeeId('employee-id'), 'employee-id');
  assert.equal(employeeId({ _id: 'employee-id' }), 'employee-id');
  assert.equal(employeeId(null), '');
});

test('creates a local YYYY-MM month value', () => {
  assert.equal(monthNow(new Date('2026-04-15T12:00:00Z')).length, 7);
});
