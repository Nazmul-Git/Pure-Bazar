const crypto = require('crypto');
const mongoose = require('mongoose');
const {
  AuditLog, Order, Return, StockMovement, VendorLedger, WalletLog,
} = require('../models');
const { statusError } = require('./posBillService');
const { resolveOutlet } = require('./posCheckoutService');

function money(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function objectOf(value) {
  return value?.toObject ? value.toObject() : value;
}

function dateClause(query) {
  let start;
  let end;
  if (query.date) {
    start = new Date(`${query.date}T00:00:00.000Z`);
    end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  } else {
    if (query.from) start = new Date(query.from);
    if (query.to) {
      end = new Date(query.to);
      if (/^\d{4}-\d{2}-\d{2}$/.test(query.to)) {
        end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
      }
    }
  }
  if (!start && !end) return null;

  const saleDate = {};
  if (start) saleDate.$gte = start;
  if (end) {
    saleDate[/^\d{4}-\d{2}-\d{2}$/.test(query.to || '') || query.date ? '$lt' : '$lte'] = end;
  }
  return {
    $or: [
      { soldAt: saleDate },
      { soldAt: { $exists: false }, createdAt: saleDate },
      { soldAt: null, createdAt: saleDate },
    ],
  };
}

async function listSalesHistory(req) {
  const { query } = req;
  const filter = {};
  const clauses = [];

  if (req.user.role !== 'Super Admin') {
    const outlet = await resolveOutlet({}, req.user);
    if (query.outlet && query.outlet !== outlet.toString()) {
      throw statusError('Sales history is limited to the assigned outlet', 403);
    }
    filter.outlet = outlet;
  } else if (query.outlet) {
    filter.outlet = query.outlet;
  }
  if (query.cashier) filter.cashier = query.cashier;
  if (query.shareholderId) filter.memberId = query.shareholderId;
  if (query.paymentMethod) filter['payments.method'] = query.paymentMethod;

  if (query.vendor) {
    const orderIds = await VendorLedger.distinct('orderId', {
      vendorId: query.vendor,
      entryType: 'SALE',
    });
    if (!orderIds.length) return [];
    filter._id = { $in: orderIds };
  }
  const dates = dateClause(query);
  if (dates) clauses.push(dates);
  if (clauses.length) filter.$and = clauses;

  return Order.find(filter).sort({ createdAt: -1 }).limit(100).lean();
}

async function returnBill(req) {
  let session;
  try {
    session = await mongoose.startSession();
    let returnRecord;
    await session.withTransaction(async () => {
      const order = await Order.findById(req.params.orderId).session(session).lean();
      if (!order) throw statusError('POS bill was not found', 404);
      if (req.user.role !== 'Super Admin') {
        const outlet = await resolveOutlet({}, req.user);
        if (order.outlet.toString() !== outlet.toString()) {
          throw statusError('Bill returns are limited to the assigned outlet', 403);
        }
      }
      if (order.paymentStatus !== 'PAID') {
        throw statusError('Bill has already been returned', 409);
      }

      const existingReturn = await Return.findOne({ orderId: order._id }).session(session).lean();
      if (existingReturn) throw statusError('Bill has already been returned', 409);

      const walletSale = order.payments.some((payment) => payment.method === 'WALLET');
      const walletRefunded = req.body.walletRefunded === true;
      if (walletRefunded && !walletSale) {
        throw statusError('Wallet refund status only applies to wallet-paid bills', 400);
      }

      const saleLedgers = await VendorLedger.find({
        orderId: order._id,
        entryType: 'SALE',
      }).session(session).lean();
      const createdReturn = (await Return.create([{
        returnNumber: `RET-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
        orderId: order._id,
        lines: order.lines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          amount: money(line.total),
        })),
        refundAmount: money(order.grandTotal),
        walletRefunded,
        ...(walletRefunded ? { walletRefundMethod: req.body.walletRefundMethod } : {}),
        createdBy: req.user._id,
      }], { session }))[0];
      returnRecord = createdReturn;

      const quantities = new Map();
      order.lines.forEach((line) => {
        const productId = line.productId.toString();
        quantities.set(productId, (quantities.get(productId) || 0) + line.quantity);
      });
      await StockMovement.create([...quantities].map(([productId, quantity]) => ({
        productId: new mongoose.Types.ObjectId(productId),
        warehouseId: order.outlet,
        quantity,
        type: 'RETURN',
        userId: req.user._id,
        referenceId: createdReturn._id,
        referenceType: 'Return',
      })), { session });

      if (saleLedgers.length) {
        await VendorLedger.create(saleLedgers.map((ledger) => ({
          vendorId: ledger.vendorId,
          orderId: order._id,
          returnId: createdReturn._id,
          productId: ledger.productId,
          quantity: ledger.quantity,
          entryType: 'RETURN',
          vendorPayable: money(ledger.vendorPayable),
          companyNet: money(-ledger.companyNet),
        })), { session });
      }
      if (walletRefunded) {
        await WalletLog.create([{
          memberId: order.memberId,
          orderId: order._id,
          amount: money(order.grandTotal),
          type: 'REFUND',
        }], { session });
      }

      const updatedOrder = await Order.findOneAndUpdate(
        { _id: order._id, paymentStatus: 'PAID' },
        { $set: { paymentStatus: 'REFUNDED' } },
        { new: true, runValidators: true, session },
      );
      if (!updatedOrder) throw statusError('Bill has already been returned', 409);

      await AuditLog.create([{
        actorId: req.user._id,
        action: 'RETURN',
        entity: 'Order',
        entityId: order._id,
        before: objectOf(order),
        after: objectOf(updatedOrder),
        metadata: {
          returnId: createdReturn._id,
          refundAmount: money(order.grandTotal),
          walletRefunded,
          walletRefundMethod: req.body.walletRefundMethod,
        },
        ipAddress: req.ip,
      }], { session });
    });
    return returnRecord;
  } catch (error) {
    if (error.code === 11000) throw statusError('Bill has already been returned', 409);
    throw error;
  } finally {
    if (session) await session.endSession();
  }
}

module.exports = { listSalesHistory, returnBill };
