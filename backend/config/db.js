const mongoose = require('mongoose');

async function connectDB(uri) {
  return mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
}

module.exports = connectDB;