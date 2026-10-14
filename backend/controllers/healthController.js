const mongoose = require('mongoose');

function getHealth(req, res) {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ status: 'error', db: 'disconnected' });
  }

  return res.json({ status: 'ok', db: 'connected' });
}

module.exports = { getHealth };