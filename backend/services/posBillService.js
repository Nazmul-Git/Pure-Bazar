const Joi = require('joi');
const {
  Category, Product, Settings, Shareholder,
} = require('../models');
const { calculateBill } = require('./billEngine');

const methods = ['CASH', 'BKASH', 'NAGAD', 'CARD', 'WALLET'];
const billSchema = Joi.object({
  items: Joi.array().min(1).items(Joi.object({
    productId: Joi.string().hex().length(24).lowercase().required(),
    quantity: Joi.number().positive().required(),
    discount: Joi.object({
      type: Joi.string().valid('PERCENT', 'FIXED').required(),
      value: Joi.number().min(0).required(),
      reason: Joi.string().trim().min(1).max(300).required(),
    }).optional(),
  }).unknown(false)).required(),
  payments: Joi.array().min(1).items(Joi.object({
    method: Joi.string().valid(...methods).required(),
    amount: Joi.number().positive(),
  }).unknown(false)),
  paymentMethod: Joi.string().valid(...methods),
  shareholderId: Joi.string().hex().length(24).lowercase(),
  billDiscount: Joi.object({
    type: Joi.string().valid('PERCENT', 'FIXED').required(),
    value: Joi.number().min(0).required(),
    reason: Joi.string().trim().min(1).max(300).required(),
  }),
  discountApproved: Joi.boolean(),
  outletId: Joi.string().hex().length(24),
  offlineId: Joi.string().trim().min(1).max(120),
  soldAt: Joi.date().iso(),
}).unknown(false);

function statusError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function settingMap(value) {
  if (value instanceof Map) return Object.fromEntries(value);
  return value || {};
}

function paymentMethodsFor(body) {
  const payments = body.payments || (body.paymentMethod
    ? [{ method: body.paymentMethod }]
    : [{ method: 'CASH' }]);
  const selected = payments.map((payment) => payment.method);
  if (selected.includes('WALLET') && (selected.length !== 1 || selected[0] !== 'WALLET')) {
    throw statusError('Wallet cannot be split with another payment method');
  }
  if (new Set(selected).size !== selected.length) {
    throw statusError('Each payment method can only be used once');
  }
  return { payments, selected };
}

async function loadSettings() {
  return (await Settings.findOne({ singleton: 'global' }).lean()) || {};
}

async function loadBill(body, user, settingsInput) {
  const { error } = billSchema.validate(body, { abortEarly: false, convert: true });
  if (error) throw statusError(error.details.map((detail) => detail.message).join('; '));
  const { payments, selected } = paymentMethodsFor(body);
  const ids = [...new Set(body.items.map((item) => item.productId))];
  const products = await Product.find({ _id: { $in: ids } }).lean();
  if (products.length !== ids.length) throw statusError('One or more products were not found', 404);
  const productsById = new Map(products.map((product) => [product._id.toString(), product]));
  const categoryIds = [...new Set(products.map((product) => product.categoryId?.toString()).filter(Boolean))];
  const categories = categoryIds.length
    ? await Category.find({ _id: { $in: categoryIds } }).select('_id vatRate').lean()
    : [];
  const categoryRates = new Map(categories.map((category) => [category._id.toString(), category.vatRate]));

  const shareholder = body.shareholderId ? await Shareholder.findById(body.shareholderId).lean() : null;
  const wallet = selected[0] === 'WALLET';
  const verifiedMember = shareholder?.verified === true && shareholder.active === true;
  const walletEligible = verifiedMember && shareholder.walletEnabled === true;
  const settings = settingsInput || await loadSettings();
  const bill = calculateBill({
    items: body.items.map((item) => {
      const product = productsById.get(item.productId);
      return {
        productId: product._id,
        vendorId: product.vendorId,
        ownerType: product.ownerType,
        quantity: item.quantity,
        mrp: product.mrp,
        vendorPrice: product.vendorPrice,
        vatApplicable: product.vatApplicable,
        vatRate: product.vatRate,
        categoryVatRate: categoryRates.get(product.categoryId?.toString()),
        discount: item.discount,
      };
    }),
    paymentMethod: wallet ? 'WALLET' : selected[0],
    shareholder: walletEligible ? { verified: true } : null,
    billDiscount: body.billDiscount,
    settings,
  });
  const limit = Number(settingMap(settings.discountLimitByRole)[user.role] ?? 0);
  const discountPercent = bill.subtotal ? bill.otherDiscountAmount / bill.subtotal * 100 : 0;
  const approvalRequired = discountPercent > limit;
  if (body.discountApproved && user.role !== 'Super Admin') {
    throw statusError('Only a Super Admin can approve discounts above the role limit', 403);
  }
  return {
    bill,
    lines: body.items.map((item) => ({ item, product: productsById.get(item.productId) })),
    payments,
    shareholder,
    verifiedMember,
    walletEligible,
    wallet,
    settings,
    approvalRequired,
    approvedBy: approvalRequired && body.discountApproved ? user._id : undefined,
  };
}

function billOutput(result) {
  return {
    ...result.bill,
    discountApprovalRequired: result.approvalRequired,
    requiresVerifiedMember: result.wallet && !result.walletEligible,
  };
}

function receiptData(order) {
  return {
    orderNumber: order.orderNumber,
    soldAt: order.soldAt || order.createdAt,
    outlet: order.outlet,
    cashier: order.cashier,
    lines: order.lines,
    subtotal: order.subtotal,
    otherDiscountAmount: order.otherDiscountAmount,
    otherDiscountReason: order.otherDiscountReason,
    shareholderDiscountAmount: order.shareholderDiscountAmount,
    vatAmount: order.vatAmount,
    grandTotal: order.grandTotal,
    payments: order.payments,
    memberId: order.memberId || null,
  };
}

module.exports = {
  billOutput,
  loadBill,
  receiptData,
  statusError,
};
