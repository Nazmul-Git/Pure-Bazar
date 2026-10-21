const express = require('express');
const { query } = require('express-validator');
const authMiddleware = require('../middlewares/authMiddleware');
const authorizeMiddleware = require('../middlewares/authorizeMiddleware');
const validateRequest = require('../middlewares/validateRequest');
const { salesReport, stockReport } = require('../services/salesStockReportService');
const { vendorProfitability, profitLoss, vatDiscountReport } = require('../services/financeReportService');
const { toExcel, toPdf } = require('../services/reportExportService');

const router = express.Router();
router.use(authMiddleware);

const dateRange = [
  query('from').optional().isISO8601({ strict: true }).matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('from must be YYYY-MM-DD'),
  query('to').optional().isISO8601({ strict: true }).matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('to must be YYYY-MM-DD'),
  query('to').custom((to, { req }) => !req.query.from || !to || to >= req.query.from).withMessage('to must not be before from'),
];
const wrap = (handler) => async (req, res, next) => {
  try {
    await handler(req, res);
  } catch (error) {
    next(error);
  }
};
const salesStockAccess = authorizeMiddleware({ anyPermissions: ['reports:read', 'reports:sales-stock:read'] });
const reportsAccess = authorizeMiddleware({ permissions: ['reports:read'] });

router.get('/sales', salesStockAccess, dateRange, [
  query('groupBy').optional().isIn(['day', 'month']).withMessage('groupBy must be day or month'),
], validateRequest, wrap(async (req, res) => {
  res.json({ success: true, report: await salesReport(req.query) });
}));

router.get('/stock', salesStockAccess, dateRange, [
  query('lowStockThreshold').optional().isFloat({ min: 0 }).withMessage('Threshold must be 0 or more').toFloat(),
], validateRequest, wrap(async (req, res) => {
  res.json({ success: true, report: await stockReport(req.query) });
}));

router.get('/vendor-profitability', reportsAccess, dateRange, [
  query('format').optional().isIn(['json', 'xlsx', 'pdf']).withMessage('format must be json, xlsx or pdf'),
], validateRequest, wrap(async (req, res) => {
  const report = await vendorProfitability(req.query);
  const format = req.query.format || 'json';
  if (format === 'json') return res.json({ success: true, report });
  const sheet = {
    title: 'Vendor Profitability',
    subtitle: `Period: ${report.from || 'start'} to ${report.to || 'today'}`,
    columns: [
      { key: 'vendorName', label: 'Vendor', width: 28 },
      { key: 'shopName', label: 'Shop', width: 24 },
      { key: 'billCount', label: 'Bills' },
      { key: 'quantitySold', label: 'Qty sold' },
      { key: 'vendorPayable', label: 'Vendor payable' },
      { key: 'companyNet', label: 'Company net' },
    ],
    rows: report.rows,
    totals: report.totals,
  };
  if (format === 'xlsx') {
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.set('Content-Disposition', 'attachment; filename="vendor-profitability.xlsx"');
    return res.send(await toExcel(sheet));
  }
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', 'attachment; filename="vendor-profitability.pdf"');
  return res.send(await toPdf(sheet));
}));

router.get('/profit-loss', reportsAccess, dateRange, validateRequest, wrap(async (req, res) => {
  res.json({ success: true, report: await profitLoss(req.query) });
}));

router.get('/vat-discount', reportsAccess, dateRange, validateRequest, wrap(async (req, res) => {
  res.json({ success: true, report: await vatDiscountReport(req.query) });
}));

module.exports = router;
