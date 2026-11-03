const { getVendorOverview } = require('../services/vendorOverviewService');

async function overview(req, res, next) {
  try {
    const data = await getVendorOverview(req.params.vendorId, req.query);
    return res.json({ success: true, ...data });
  } catch (error) {
    return next(error);
  }
}

module.exports = { overview };
