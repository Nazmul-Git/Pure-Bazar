const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const connectDB = require('./config/db');
const { loadEnv } = require('./config/env');
const errorMiddleware = require('./middlewares/errorMiddleware');
const authRoutes = require('./routes/authRoutes');
const healthRoutes = require('./routes/healthRoutes');

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use('/api/auth', authRoutes);
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

  try {
    await connectDB(env.MONGODB_URI);
  } catch (error) {
    console.error(`Database connection failed: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  app.listen(env.PORT, () => {
    console.log(`PureBazar API listening on port ${env.PORT}`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = app;