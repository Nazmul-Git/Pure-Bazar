require('dns').setDefaultResultOrder('ipv4first'); // IPv6 সমস্যা এড়াতে (সবার উপরে থাকতে হবে)
require('dotenv').config();

const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const connectDB = require('./config/db');
const { loadEnv } = require('./config/env');
const errorMiddleware = require('./middlewares/errorMiddleware');
const authRoutes = require('./routes/authRoutes');
const healthRoutes = require('./routes/healthRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const productRoutes = require('./routes/productRoutes');
const posRoutes = require('./routes/posRoutes');
const roleRoutes = require('./routes/roleRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const shareholderRoutes = require('./routes/shareholderRoutes');
const stockRoutes = require('./routes/stockRoutes');
const userRoutes = require('./routes/userRoutes');
const vendorRoutes = require('./routes/vendorRoutes');
const financeRoutes = require('./routes/financeRoutes');
const payrollRoutes = require('./routes/payrollRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const { startSettlementJob } = require('./services/vendorSettlementJob');

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api', inventoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/pos', posRoutes);
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api', settingsRoutes);
app.use('/api/shareholders', shareholderRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api', stockRoutes);
app.use('/api', healthRoutes);
app.use((req, res, next) => {
  const error = new Error('Route not found');
  error.status = 404;
  next(error);
});

app.use(errorMiddleware);

async function startServer() {
  let env;
  try {
    env = loadEnv();
  } catch (error) {
    console.error(`Environment configuration error: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  // নিরাপদ ডিবাগ: পাসওয়ার্ড লুকিয়ে URI দেখুন
  const safeUri = env.MONGODB_URI.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:****@');
  console.log('Connecting to:', safeUri);

  try {
    await connectDB(env.MONGODB_URI);
    console.log('MongoDB connected');
  } catch (error) {
    console.error('Database connection failed');
    console.error('message:', error.message);

    // প্রতিটি shard-এর আসল এরর দেখাবে (MongoNetworkError-এর ভেতরের বার্তা)
    const servers = error.reason?.servers;
    if (servers) {
      for (const [addr, server] of servers) {
        console.error(' ', addr, '=>', server.error?.message);
      }
    }

    process.exitCode = 1;
    return;
  }

  startSettlementJob();

  app.listen(env.PORT, () => {
    console.log(`PureBazar API listening on port ${env.PORT}`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = app;
