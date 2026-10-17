const mongoose = require('mongoose');
const {
  AuditLog, GoodsReceive, Product, StockMovement, Vendor,
} = require('../models');

function statusError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeLines(lines) {
  const combined = new Map();
  for (const line of lines) {
    const current = combined.get(line.productId) || {
      productId: line.productId, receivedQuantity: 0, acceptedQuantity: 0, rejectedQuantity: 0,
    };
    current.receivedQuantity += line.receivedQuantity;
    current.acceptedQuantity += line.acceptedQuantity;
    current.rejectedQuantity += line.rejectedQuantity;
    combined.set(line.productId, current);
  }
  return [...combined.values()];
}

async function validateProducts(ownerType, vendorId, lines) {
  if (ownerType === 'VENDOR') {
    if (!vendorId) throw statusError('Vendor purchases require a vendor', 400);
    if (!(await Vendor.exists({ _id: vendorId }))) throw statusError('Vendor not found', 400);
  } else if (vendorId) {
    throw statusError('Company purchases cannot have a vendor', 400);
  }

  const productIds = lines.map(({ productId }) => productId);
  const products = await Product.find({ _id: { $in: productIds } })
    .select('_id name barcode ownerType vendorId').lean();
  if (products.length !== productIds.length) throw statusError('One or more products were not found', 400);
  const validProducts = products.every((product) => (
    product.ownerType === ownerType
    && (ownerType === 'COMPANY' || product.vendorId?.toString() === vendorId.toString())
  ));
  if (!validProducts) throw statusError('Products must match the purchase owner and vendor', 400);
}

function receiveOutput(receive, products = []) {
  const productMap = new Map(products.map((product) => [product._id.toString(), product]));
  const data = receive.toObject ? receive.toObject() : receive;
  return {
    id: data._id.toString(),
    ownerType: data.ownerType,
    vendorId: data.vendorId?.toString() || null,
    warehouseId: data.warehouseId.toString(),
    vendorChallanNumber: data.vendorChallanNumber || null,
    status: data.status,
    createdBy: data.createdBy?.toString(),
    approvedBy: data.approvedBy?.toString() || null,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    lines: data.lines.map((line) => {
      const product = productMap.get(line.productId.toString());
      return {
        productId: line.productId.toString(),
        productName: product?.name,
        barcode: product?.barcode,
        receivedQuantity: line.receivedQuantity,
        acceptedQuantity: line.acceptedQuantity,
        rejectedQuantity: line.rejectedQuantity,
      };
    }),
  };
}

async function searchProducts(req, res, next) {
  try {
    const { ownerType, vendorId, q } = req.query;
    if (ownerType === 'VENDOR' && !(await Vendor.exists({ _id: vendorId }))) {
      throw statusError('Vendor not found', 404);
    }
    const filter = { ownerType };
    if (ownerType === 'VENDOR') filter.vendorId = vendorId;
    if (q) {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [{ name: new RegExp(escaped, 'i') }, { barcode: new RegExp(escaped, 'i') }];
    }
    const products = await Product.find(filter).select('_id name barcode ownerType vendorId')
      .sort({ name: 1 }).lean();
    return res.json({
      success: true,
      products: products.map((product) => ({
        id: product._id.toString(),
        name: product.name,
        barcode: product.barcode,
        ownerType: product.ownerType,
        vendorId: product.vendorId?.toString() || null,
      })),
    });
  } catch (error) {
    return next(error);
  }
}

async function listVendors(req, res, next) {
  try {
    const vendors = await Vendor.find({})
      .select('_id name shopName memberId')
      .sort({ name: 1 })
      .lean();
    return res.json({
      success: true,
      vendors: vendors.map((vendor) => ({
        id: vendor._id.toString(),
        name: vendor.name,
        shopName: vendor.shopName,
        memberId: vendor.memberId,
        status: vendor.status,
      })),
    });
  } catch (error) {
    return next(error);
  }
}

async function listGoodsReceives(req, res, next) {
  try {
    const receives = await GoodsReceive.find().sort({ createdAt: -1 }).lean();
    return res.json({ success: true, goodsReceives: receives.map((receive) => receiveOutput(receive)) });
  } catch (error) {
    return next(error);
  }
}

async function createGoodsReceive(req, res, next) {
  try {
    const lines = normalizeLines(req.body.lines);
    await validateProducts(req.body.ownerType, req.body.vendorId, lines);
    if (req.body.ownerType === 'VENDOR' && !req.body.vendorChallanNumber) {
      throw statusError('Vendor purchases require a challan number', 400);
    }
    const [receive] = await GoodsReceive.create([{
      ownerType: req.body.ownerType,
      ...(req.body.vendorId ? { vendorId: req.body.vendorId } : {}),
      warehouseId: req.body.warehouseId,
      ...(req.body.vendorChallanNumber ? { vendorChallanNumber: req.body.vendorChallanNumber } : {}),
      lines,
      createdBy: req.user._id,
    }]);
    await AuditLog.create({
      actorId: req.user._id, action: 'CREATE', entity: 'GoodsReceive', entityId: receive._id,
      after: receive.toObject(), ipAddress: req.ip,
    });
    return res.status(201).json({ success: true, goodsReceive: receiveOutput(receive) });
  } catch (error) {
    return next(error);
  }
}

async function updateGoodsReceive(req, res, next) {
  try {
    const receive = await GoodsReceive.findById(req.params.id);
    if (!receive) throw statusError('Goods receive not found', 404);
    if (receive.status !== 'Draft') throw statusError('Only draft goods receives can be edited', 409);

    const before = receive.toObject();
    const ownerType = req.body.ownerType || receive.ownerType;
    const vendorId = Object.prototype.hasOwnProperty.call(req.body, 'vendorId') ? req.body.vendorId : receive.vendorId;
    const lines = req.body.lines ? normalizeLines(req.body.lines) : receive.lines;
    await validateProducts(ownerType, vendorId, lines);
    const challan = Object.prototype.hasOwnProperty.call(req.body, 'vendorChallanNumber')
      ? req.body.vendorChallanNumber : receive.vendorChallanNumber;
    if (ownerType === 'VENDOR' && !challan) throw statusError('Vendor purchases require a challan number', 400);

    receive.ownerType = ownerType;
    receive.vendorId = vendorId || undefined;
    receive.warehouseId = req.body.warehouseId || receive.warehouseId;
    receive.vendorChallanNumber = challan || undefined;
    receive.lines = lines;
    await receive.save();
    await AuditLog.create({
      actorId: req.user._id, action: 'UPDATE', entity: 'GoodsReceive', entityId: receive._id,
      before, after: receive.toObject(), ipAddress: req.ip,
    });
    return res.json({ success: true, goodsReceive: receiveOutput(receive) });
  } catch (error) {
    return next(error);
  }
}

async function getGoodsReceive(req, res, next) {
  try {
    const receive = await GoodsReceive.findById(req.params.id).lean();
    if (!receive) throw statusError('Goods receive not found', 404);
    const ids = receive.lines.map((line) => line.productId);
    const [products, vendor] = await Promise.all([
      Product.find({ _id: { $in: ids } }).select('_id name barcode').lean(),
      receive.vendorId
        ? Vendor.findById(receive.vendorId).select('_id name shopName memberId').lean()
        : null,
    ]);
    return res.json({
      success: true,
      goodsReceive: {
        ...receiveOutput(receive, products),
        vendor: vendor ? {
          id: vendor._id.toString(), name: vendor.name, shopName: vendor.shopName, memberId: vendor.memberId,
        } : null,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function approveGoodsReceive(req, res, next) {
  let session;
  try {
    session = await mongoose.startSession();
    let output;
    await session.withTransaction(async () => {
      const receive = await GoodsReceive.findById(req.params.id).session(session);
      if (!receive) throw statusError('Goods receive not found', 404);
      if (receive.status !== 'Draft') throw statusError('Only draft goods receives can be approved', 409);

      const before = receive.toObject();
      receive.status = 'Approved';
      receive.approvedBy = req.user._id;
      await receive.save({ session });
      const movements = receive.lines
        .filter((line) => line.acceptedQuantity > 0)
        .map((line) => ({
          productId: line.productId,
          warehouseId: receive.warehouseId,
          quantity: line.acceptedQuantity,
          type: 'GRN',
          userId: req.user._id,
          reason: `Goods receive ${receive._id}`,
          referenceId: receive._id,
          referenceType: 'GoodsReceive',
        }));
      if (movements.length) await StockMovement.create(movements, { session });
      await AuditLog.create([{
        actorId: req.user._id, action: 'APPROVE', entity: 'GoodsReceive', entityId: receive._id,
        before, after: receive.toObject(), ipAddress: req.ip,
      }], { session });
      output = receiveOutput(receive);
    });
    return res.json({ success: true, goodsReceive: output });
  } catch (error) {
    return next(error);
  } finally {
    if (session) await session.endSession();
  }
}

async function rejectGoodsReceive(req, res, next) {
  try {
    const receive = await GoodsReceive.findById(req.params.id);
    if (!receive) throw statusError('Goods receive not found', 404);
    if (receive.status !== 'Draft') throw statusError('Only draft goods receives can be rejected', 409);
    const before = receive.toObject();
    receive.status = 'Rejected';
    await receive.save();
    await AuditLog.create({
      actorId: req.user._id, action: 'REJECT', entity: 'GoodsReceive', entityId: receive._id,
      before, after: receive.toObject(), ipAddress: req.ip,
    });
    return res.json({ success: true, goodsReceive: receiveOutput(receive) });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  searchProducts, listVendors, listGoodsReceives, createGoodsReceive, updateGoodsReceive,
  getGoodsReceive, approveGoodsReceive, rejectGoodsReceive,
};
