const crypto = require('crypto');
const mongoose = require('mongoose');
const {
  AuditLog, DiscountLog, Location, Order, StockMovement, VendorLedger,
  WalletAuditLog, WalletLog,
} = require('../models');
const {
  billOutput, loadBill, receiptData, statusError,
} = require('./posBillService');
const { getDefaultPosOutlet } = require('./posOutletService');
const probashiWalletService = require('./probashiWalletService');

function money(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function objectOf(value) {
  return value?.toObject ? value.toObject() : value;
}

function validatePayments(result) {
  const payments = result.payments;
  if (payments.some((payment) => !Number.isFinite(payment.amount) || payment.amount <= 0)) {
    throw statusError('Every payment must have a positive amount');
  }
  const total = money(payments.reduce((sum, payment) => sum + payment.amount, 0));
  if (total !== result.bill.grandTotal) throw statusError('Payments must equal the final bill total');
  const allowed = {
    CASH: 'Cash', BKASH: 'bKash', NAGAD: 'Nagad', CARD: 'Card', WALLET: 'Wallet',
  };
  const enabled = result.settings.enabledPaymentMethods;
  if (enabled && payments.some((payment) => !enabled.includes(allowed[payment.method]))) {
    throw statusError('A selected payment method is disabled in Settings', 400);
  }
  if (result.wallet && (!result.walletEligible || !result.shareholder)) {
    throw statusError('Wallet payment requires an attached, verified shareholder', 403);
  }
}

async function checkWallet(result, userId) {
  if (!result.wallet) return null;
  let balance;
  try {
    balance = await probashiWalletService.checkWalletBalance({
      memberId: result.shareholder.memberId,
      amount: result.bill.grandTotal,
    });
  } finally {
    await WalletAuditLog.create({
      memberId: result.shareholder.memberId,
      action: 'WALLET_BALANCE_CHECK',
      succeeded: Boolean(balance?.sufficient),
      createdBy: userId,
    });
  }
  return balance.sufficient;
}

async function resolveOutlet(body, user) {
  const outletId = user.role === 'Super Admin' && body.outletId ? body.outletId : user.locationId;
  const outlet = outletId
    ? await Location.findById(outletId).lean()
    : await getDefaultPosOutlet();
  if (!outlet || outlet.type !== 'OUTLET' || outlet.isActive === false) {
    throw statusError(
      outletId ? 'POS sales must be assigned to an active outlet' : 'No active POS outlet is configured',
      outletId ? 400 : 503,
    );
  }
  return outlet._id;
}

async function existingOfflineOrder(offlineId) {
  return Order.findOne({ offlineId }).lean();
}

async function commitBill(req, res, next, offline) {
  let session;
  try {
    if (offline && !req.body.offlineId) throw statusError('offlineId is required for offline sync');
    if (!offline && req.body.offlineId) throw statusError('Use offline sync for queued bills');
    if (offline) {
      const existing = await existingOfflineOrder(req.body.offlineId);
      if (existing) {
        return res.json({
          success: true, synced: true, duplicate: true, order: existing, receipt: receiptData(existing),
        });
      }
    }
    const result = await loadBill(req.body, req.user);
    if (offline && result.wallet) throw statusError('Wallet payments cannot be queued offline');
    if (result.approvalRequired && !result.approvedBy) {
      throw statusError('Discount exceeds this role limit; Super Admin approval is required', 403);
    }
    validatePayments(result);
    const sufficient = await checkWallet(result, req.user._id);
    if (sufficient === false) {
      const repriced = await loadBill({
        ...req.body,
        payments: req.body.payments.map((payment) => ({
          method: payment.method === 'WALLET' ? 'CASH' : payment.method,
        })),
        shareholderId: undefined,
      }, req.user, result.settings);
      return res.status(409).json({
        success: false,
        message: 'Insufficient wallet balance; the bill has been repriced at MRP',
        sufficient: false,
        bill: billOutput(repriced),
      });
    }

    const outletId = await resolveOutlet(req.body, req.user);
    const orderNumber = `POS-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const saleDate = new Date(req.body.soldAt || Date.now());
    session = await mongoose.startSession();
    let order;
    await session.withTransaction(async () => {
      const quantities = new Map();
      result.lines.forEach(({ item }) => {
        quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.quantity);
      });
      const stock = await StockMovement.aggregate([
        {
          $match: {
            warehouseId: outletId,
            productId: { $in: [...quantities.keys()].map((id) => new mongoose.Types.ObjectId(id)) },
          },
        },
        { $group: { _id: '$productId', quantity: { $sum: '$quantity' } } },
      ]).session(session);
      const available = new Map(stock.map((item) => [item._id.toString(), item.quantity]));
      for (const [productId, quantity] of quantities) {
        if ((available.get(productId) || 0) < quantity) {
          throw statusError(`Insufficient outlet stock for product ${productId}`, 409);
        }
      }
      const [created] = await Order.create([{
        orderNumber,
        ...(offline ? { offlineId: req.body.offlineId, soldAt: saleDate } : {}),
        channel: 'POS',
        lines: result.bill.ledgerLines.map((line, index) => {
          const { item, product } = result.lines[index];
          return {
            productId: product._id,
            productName: product.name,
            barcode: product.barcode,
            quantity: line.quantity,
            mrp: product.mrp,
            subtotal: line.subtotal,
            itemDiscountAmount: line.itemDiscountAmount,
            billDiscountAmount: line.billDiscountAmount,
            shareholderDiscountAmount: line.shareholderDiscountAmount,
            vatAmount: line.vatAmount,
            total: money(line.subtotal - line.discountAmount + line.vatAmount),
            ...(item.discount ? { discountReason: item.discount.reason } : {}),
          };
        }),
        subtotal: result.bill.subtotal,
        otherDiscountAmount: result.bill.otherDiscountAmount,
        otherDiscountReason: [...new Set([
          ...req.body.items.map((item) => item.discount?.reason),
          req.body.billDiscount?.reason,
        ].filter(Boolean))].join('; ') || undefined,
        shareholderDiscountAmount: result.bill.shareholderDiscountAmount,
        vatAmount: result.bill.vatAmount,
        grandTotal: result.bill.grandTotal,
        payments: result.payments,
        paymentStatus: 'PAID',
        ...(result.verifiedMember ? { memberId: result.shareholder._id } : {}),
        cashier: req.user._id,
        outlet: outletId,
      }], { session });
      order = created;
      await StockMovement.create([...quantities].map(([productId, quantity]) => ({
        productId,
        warehouseId: outletId,
        quantity: -quantity,
        type: 'SALE',
        userId: req.user._id,
        referenceId: created._id,
        referenceType: 'Order',
      })), { session });

      const ledgerRows = result.bill.ledgerLines.filter((line) => line.ownerType === 'VENDOR').map((line) => ({
        vendorId: line.vendorId,
        orderId: created._id,
        productId: line.productId,
        quantity: line.quantity,
        entryType: 'SALE',
        vendorPayable: line.vendorPayable,
        companyNet: line.companyNet,
      }));
      if (ledgerRows.length) await VendorLedger.create(ledgerRows, { session });
      if (result.wallet) {
        await WalletLog.create([{
          memberId: result.shareholder._id,
          orderId: created._id,
          amount: result.bill.grandTotal,
          type: 'DEBIT',
        }], { session });
      }
      const discountRows = [];
      result.bill.ledgerLines.forEach((line, index) => {
        const discount = req.body.items[index].discount;
        if (line.itemDiscountAmount > 0) discountRows.push({
          orderId: created._id, productId: line.productId, scope: 'ITEM',
          discountType: discount.type, amount: line.itemDiscountAmount,
          reason: discount.reason, appliedBy: req.user._id,
          ...(result.approvedBy ? { approvedBy: result.approvedBy } : {}),
        });
      });
      const billDiscountAmount = money(
        result.bill.ledgerLines.reduce((sum, line) => sum + line.billDiscountAmount, 0),
      );
      if (billDiscountAmount > 0) discountRows.push({
        orderId: created._id, scope: 'BILL', discountType: req.body.billDiscount.type,
        amount: billDiscountAmount, reason: req.body.billDiscount.reason,
        appliedBy: req.user._id, ...(result.approvedBy ? { approvedBy: result.approvedBy } : {}),
      });
      if (result.bill.shareholderDiscountAmount > 0) discountRows.push({
        orderId: created._id, scope: 'BILL', discountType: 'FIXED',
        amount: result.bill.shareholderDiscountAmount,
        reason: 'Verified shareholder wallet discount', appliedBy: req.user._id,
      });
      if (discountRows.length) await DiscountLog.create(discountRows, { session });
      await AuditLog.create([{
        actorId: req.user._id,
        action: offline ? 'SYNC' : 'FINALIZE',
        entity: 'Order',
        entityId: created._id,
        after: objectOf(created),
        metadata: { offlineId: offline ? req.body.offlineId : undefined, approvedBy: result.approvedBy },
        ipAddress: req.ip,
      }], { session });
    });
    const output = objectOf(order);
    return res.status(offline ? 200 : 201).json({
      success: true,
      ...(offline ? { synced: true, duplicate: false } : {}),
      order: output,
      receipt: receiptData(output),
    });
  } catch (error) {
    if (offline && error.code === 11000) {
      try {
        const existing = await existingOfflineOrder(req.body.offlineId);
        if (existing) {
          return res.json({
            success: true, synced: true, duplicate: true, order: existing, receipt: receiptData(existing),
          });
        }
      } catch (lookupError) {
        return next(lookupError);
      }
    }
    return next(error);
  } finally {
    if (session) await session.endSession();
  }
}

module.exports = {
  finalizeBill: (req, res, next) => commitBill(req, res, next, false),
  resolveOutlet,
  syncOfflineBill: (req, res, next) => commitBill(req, res, next, true),
};
