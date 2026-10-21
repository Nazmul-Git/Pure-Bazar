const {
  Order, Shareholder, WalletReconciliation,
} = require('../models');
const probashiWalletService = require('./probashiWalletService');

const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const cents = (value) => Math.round(Number(value) * 100);
const money = (centValue) => centValue / 100;
const dhakaDate = (value) => new Date(new Date(value).getTime() + DHAKA_OFFSET_MS).toISOString().slice(0, 10);

function dayRange(date) {
  const start = new Date(`${date}T00:00:00+06:00`);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

function walletAmountCents(order) {
  return order.payments
    .filter((payment) => payment.method === 'WALLET')
    .reduce((sum, payment) => sum + cents(payment.amount), 0);
}

// Matches each Wallet bill of the day against the member's Probashi
// transactions: exact amount first, then any same-day leftover as a mismatch.
function matchMember(bills, transactions, date) {
  const pool = transactions
    .filter((tx) => tx.date && dhakaDate(tx.date) === date)
    .map((tx) => ({ tx, cents: cents(tx.amount), used: false }));
  const results = new Map();

  bills.forEach((bill) => {
    const hit = pool.find((entry) => !entry.used && entry.cents === bill.cents);
    if (hit) {
      hit.used = true;
      results.set(bill.record, { status: 'Matched', tx: hit.tx });
    }
  });
  bills.forEach((bill) => {
    if (results.has(bill.record)) return;
    const near = pool.find((entry) => !entry.used);
    if (near) {
      near.used = true;
      results.set(bill.record, { status: 'Mismatch', mismatchType: 'AMOUNT_MISMATCH', tx: near.tx });
    } else {
      results.set(bill.record, { status: 'Mismatch', mismatchType: 'MISSING' });
    }
  });
  return results;
}

async function reconcileDate(date) {
  const { start, end } = dayRange(date);
  const orders = await Order.find({
    'payments.method': 'WALLET',
    paymentStatus: 'PAID',
    $or: [
      { soldAt: { $gte: start, $lt: end } },
      { soldAt: { $exists: false }, createdAt: { $gte: start, $lt: end } },
    ],
  }).lean();
  const shareholders = await Shareholder.find({
    _id: { $in: orders.map((order) => order.memberId).filter(Boolean) },
  }).lean();
  const memberIds = new Map(shareholders.map((member) => [String(member._id), member.memberId]));

  const byMember = new Map();
  for (const order of orders) {
    const memberId = memberIds.get(String(order.memberId));
    const amount = walletAmountCents(order);
    if (!memberId || amount <= 0) continue;
    let record = await WalletReconciliation.findOne({ orderId: order._id });
    if (record && record.resolved) continue;
    if (!record) {
      record = await WalletReconciliation.create({
        businessDate: date, orderId: order._id, orderNumber: order.orderNumber, memberId, amount: money(amount),
      });
    }
    if (!byMember.has(memberId)) byMember.set(memberId, []);
    byMember.get(memberId).push({ record, cents: amount });
  }

  for (const [memberId, bills] of byMember) {
    const report = await probashiWalletService.getTransactionReport({
      memberId, from: start.toISOString(), to: end.toISOString(),
    });
    const results = matchMember(bills, report.transactions, date);
    for (const { record } of bills) {
      const result = results.get(record);
      record.status = result.status;
      record.mismatchType = result.mismatchType;
      record.probashiTransactionId = result.tx ? String(result.tx.transactionId || '') : undefined;
      record.probashiAmount = result.tx ? money(cents(result.tx.amount)) : undefined;
      record.checkedAt = new Date();
      await record.save();
    }
  }
  return summarize(date);
}

async function summarize(date) {
  const records = await WalletReconciliation.find({ businessDate: date }).lean();
  const unresolved = records.filter((r) => r.status === 'Mismatch' && !r.resolved).length;
  return {
    date,
    records,
    totals: {
      matched: records.filter((r) => r.status === 'Matched').length,
      mismatch: records.filter((r) => r.status === 'Mismatch').length,
      pending: records.filter((r) => r.status === 'Pending').length,
      unresolved,
    },
  };
}

module.exports = { reconcileDate, summarize, dhakaDate };
