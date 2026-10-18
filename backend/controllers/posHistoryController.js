const posHistoryReturnService = require('../services/posHistoryReturnService');

async function listSalesHistory(req, res, next) {
  try {
    const orders = await posHistoryReturnService.listSalesHistory(req);
    return res.json({ success: true, orders });
  } catch (error) {
    return next(error);
  }
}

async function returnBill(req, res, next) {
  try {
    const returned = await posHistoryReturnService.returnBill(req);
    return res.json({ success: true, return: returned });
  } catch (error) {
    return next(error);
  }
}

module.exports = { listSalesHistory, returnBill };
