const { Location } = require('../models');

async function getDefaultPosOutlet() {
  return Location.findOne({
    type: 'OUTLET',
    isActive: { $ne: false },
  }).sort({ isPrimary: -1, createdAt: 1 }).lean();
}

module.exports = { getDefaultPosOutlet };
