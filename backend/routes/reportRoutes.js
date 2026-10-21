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
const exportFormats = [
  query('format').optional().isIn(['json', 'xlsx', 'pdf']).withMessage('format must be json, xlsx or pdf'),
];
const periodSubtitle = (report) => `Period: ${report.from || 'start'} to ${report.to || 'today'}`;
const sendReportExport = async (res, format, filename, sheet) => {
  if (format === 'xlsx') {
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.set('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
    return res.send(await toExcel(sheet));
  }
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', `attachment; filename="${filename}.pdf"`);
  return res.send(await toPdf(sheet));
};

router.get('/sales', salesStockAccess, dateRange, [
  query('groupBy').optional().isIn(['day', 'month']).withMessage('groupBy must be day or month'),
  ...exportFormats,
], validateRequest, wrap(async (req, res) => {
  const report = await salesReport(req.query);
  const format = req.query.format || 'json';
  if (format === 'json') return res.json({ success: true, report });
  return sendReportExport(res, format, 'sales-report', {
    title: 'Sales Report',
    subtitle: periodSubtitle(report),
    columns: [
      { key: 'period', label: 'Period', width: 18 },
      { key: 'billCount', label: 'Bills' },
      { key: 'subtotal', label: 'Subtotal' },
      { key: 'discounts', label: 'Discounts' },
      { key: 'vat', label: 'VAT' },
      { key: 'totalSales', label: 'Total sales' },
    ],
    rows: report.rows,
    totals: report.totals,
  });
}));

router.get('/stock', salesStockAccess, dateRange, [
  query('lowStockThreshold').optional().isFloat({ min: 0 }).withMessage('Threshold must be 0 or more').toFloat(),
  ...exportFormats,
], validateRequest, wrap(async (req, res) => {
  const report = await stockReport(req.query);
  const format = req.query.format || 'json';
  if (format === 'json') return res.json({ success: true, report });
  return sendReportExport(res, format, 'stock-report', {
    title: 'Stock Report',
    subtitle: `${periodSubtitle(report)}; low stock threshold: ${report.lowStockThreshold}`,
    columns: [
      { key: 'productName', label: 'Product', width: 28 },
      { key: 'barcode', label: 'Barcode', width: 20 },
      { key: 'opening', label: 'Opening' },
      { key: 'received', label: 'Received' },
      { key: 'sold', label: 'Sold net' },
      { key: 'otherChange', label: 'Other change' },
      { key: 'closing', label: 'Closing' },
      { key: 'onHand', label: 'On hand' },
      { key: 'turnover', label: 'Turnover' },
    ],
    rows: report.rows,
  });
}));

router.get('/vendor-profitability', reportsAccess, dateRange, [
  ...exportFormats,
], validateRequest, wrap(async (req, res) => {
  const report = await vendorProfitability(req.query);
  const format = req.query.format || 'json';
  if (format === 'json') return res.json({ success: true, report });
  return sendReportExport(res, format, 'vendor-profitability', {
    title: 'Vendor Profitability',
    subtitle: periodSubtitle(report),
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
  });
}));

router.get('/profit-loss', reportsAccess, dateRange, exportFormats, validateRequest, wrap(async (req, res) => {
  const report = await profitLoss(req.query);
  const format = req.query.format || 'json';
  if (format === 'json') return res.json({ success: true, report });
  const rows = [
    { item: 'Vendor margin income', amount: report.marginIncome },
    { item: 'Own-stock margin', amount: report.ownStockMargin },
    { item: 'Discounts', amount: report.discounts },
    { item: 'Expenses', amount: report.expenses },
    ...report.expensesByCategory.map((expense) => ({ item: `Expense: ${expense.category}`, amount: expense.total })),
    { item: 'Net profit', amount: report.netProfit },
  ];
  return sendReportExport(res, format, 'profit-loss-report', {
    title: 'Profit and Loss Report',
    subtitle: periodSubtitle(report),
    columns: [{ key: 'item', label: 'Item', width: 36 }, { key: 'amount', label: 'Amount' }],
    rows,
  });
}));

router.get('/vat-discount', reportsAccess, dateRange, exportFormats, validateRequest, wrap(async (req, res) => {
  const report = await vatDiscountReport(req.query);
  const format = req.query.format || 'json';
  if (format === 'json') return res.json({ success: true, report });
  return sendReportExport(res, format, 'vat-discount-report', {
    title: 'VAT and Discount Report',
    subtitle: periodSubtitle(report),
    columns: [
      { key: 'period', label: 'Period', width: 18 },
      { key: 'billCount', label: 'Bills' },
      { key: 'vat', label: 'VAT' },
      { key: 'itemDiscount', label: 'Item discount' },
      { key: 'billDiscount', label: 'Bill discount' },
      { key: 'shareholderDiscount', label: 'Shareholder discount' },
      { key: 'totalDiscount', label: 'Total discount' },
    ],
    rows: report.rows,
    totals: report.totals,
  });
}));

module.exports = router;
