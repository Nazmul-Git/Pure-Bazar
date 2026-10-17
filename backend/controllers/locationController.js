const { Location } = require('../models');

async function listLocations(req, res, next) {
  try {
    const filter = req.query.type ? { type: req.query.type } : {};
    const locations = await Location.find(filter).sort({ type: 1, name: 1 }).lean();
    return res.json({
      success: true,
      locations: locations.map((location) => ({
        id: location._id.toString(),
        type: location.type,
        name: location.name,
      })),
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { listLocations };
