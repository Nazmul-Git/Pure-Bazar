const toCents = (value) => Math.round(Number(value || 0) * 100);
const fromCents = (cents) => cents / 100;

// Builds one salary line per employee. Paid, not-yet-deducted advances are
// deducted oldest first, but only while the running total stays within gross pay;
// the rest roll over to a later month.
function buildSalaryLines(employees, advances) {
  return employees.map((employee) => {
    const grossCents = toCents(employee.baseSalary);
    const mine = advances
      .filter((advance) => String(advance.employeeId) === String(employee._id))
      .sort((a, b) => new Date(a.requestedAt) - new Date(b.requestedAt));
    let deductedCents = 0;
    const advanceIds = [];
    for (const advance of mine) {
      const cents = toCents(advance.amount);
      if (deductedCents + cents > grossCents) break;
      deductedCents += cents;
      advanceIds.push(advance._id);
    }
    return {
      employeeId: employee._id,
      baseSalary: employee.baseSalary,
      allowances: 0,
      advanceDeduction: fromCents(deductedCents),
      otherDeductions: 0,
      advanceIds,
    };
  });
}

function lineGrossCents(line) {
  return toCents(line.baseSalary) + toCents(line.allowances);
}

function lineDeductionCents(line) {
  return toCents(line.advanceDeduction) + toCents(line.otherDeductions);
}

module.exports = {
  buildSalaryLines, fromCents, lineDeductionCents, lineGrossCents, toCents,
};
