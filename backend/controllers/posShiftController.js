const posShiftService = require('../services/posShiftService');

async function openShift(req, res, next) {
  try {
    const result = await posShiftService.openShift(req);
    return res.status(201).json({ success: true, ...result });
  } catch (error) {
    return next(error);
  }
}

async function getCurrentShift(req, res, next) {
  try {
    const result = await posShiftService.getCurrentShift(req);
    return res.json({ success: true, ...result });
  } catch (error) {
    return next(error);
  }
}

async function getShiftReport(req, res, next) {
  try {
    const result = await posShiftService.getShiftReport(req);
    return res.json({ success: true, ...result });
  } catch (error) {
    return next(error);
  }
}

async function closeShift(req, res, next) {
  try {
    const result = await posShiftService.closeShift(req);
    return res.json({ success: true, ...result });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  openShift, getCurrentShift, getShiftReport, closeShift,
};
