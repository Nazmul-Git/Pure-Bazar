const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DAILY_POINTS = 14;
const WEEKLY_POINTS = 8;
const MONTHLY_POINTS = 6;

const cents = (value) => Math.round((Number(value) + Number.EPSILON) * 100);
const money = (totalCents) => totalCents / 100;

const soldTime = (order) => new Date(order.soldAt || order.createdAt).getTime();
const dhakaDayIndex = (time) => Math.floor((time + DHAKA_OFFSET_MS) / DAY_MS);
const dayLabel = (index) => new Date(index * DAY_MS).toISOString().slice(0, 10);
const monthKey = (time) => new Date(time + DHAKA_OFFSET_MS).toISOString().slice(0, 7);

function recentMonthKeys(now, count) {
  const local = new Date(now.getTime() + DHAKA_OFFSET_MS);
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - (count - 1 - i), 1));
    return date.toISOString().slice(0, 7);
  });
}

function buildBuckets(orders, labels, keyOf) {
  const totals = new Map(labels.map((label) => [label, 0]));
  orders.forEach((order) => {
    const key = keyOf(soldTime(order));
    if (totals.has(key)) totals.set(key, totals.get(key) + cents(order.grandTotal));
  });
  return labels.map((label) => ({ label, sales: money(totals.get(label)) }));
}

// Weeks are rolling 7-day windows ending today (Asia/Dhaka).
function buildTrends(orders, expenses, now) {
  const today = dhakaDayIndex(now.getTime());
  const dailyLabels = Array.from({ length: DAILY_POINTS }, (_, i) => dayLabel(today - (DAILY_POINTS - 1 - i)));
  const weekOf = (time) => Math.floor((today - dhakaDayIndex(time)) / 7);
  const weeklyLabels = Array.from({ length: WEEKLY_POINTS }, (_, i) => WEEKLY_POINTS - 1 - i);
  const weekly = buildBuckets(orders, weeklyLabels, weekOf).map((point) => ({
    label: point.label === 0 ? 'This week' : `${point.label}w ago`,
    sales: point.sales,
  }));

  const months = recentMonthKeys(now, MONTHLY_POINTS);
  const monthly = buildBuckets(orders, months, monthKey);
  const expenseTotals = new Map(months.map((month) => [month, 0]));
  expenses.forEach((expense) => {
    const key = monthKey(new Date(expense.expenseDate).getTime());
    if (expenseTotals.has(key)) expenseTotals.set(key, expenseTotals.get(key) + cents(expense.amount));
  });

  const yesterday = orders
    .filter((order) => dhakaDayIndex(soldTime(order)) === today - 1)
    .reduce((sum, order) => sum + cents(order.grandTotal), 0);

  return {
    salesTrend: {
      daily: buildBuckets(orders, dailyLabels, (time) => dayLabel(dhakaDayIndex(time))),
      weekly,
      monthly,
    },
    monthlyFinance: monthly.map((point) => ({
      label: point.label, revenue: point.sales, expenses: money(expenseTotals.get(point.label)),
    })),
    yesterdaySales: money(yesterday),
  };
}

module.exports = { buildTrends };
