const rateLimit = require('express-rate-limit');

function corsOptions(env = process.env) {
  const configured = (env.CORS_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean);
  const allowed = configured.length
    ? configured
    : env.NODE_ENV === 'production' ? [] : ['http://localhost:3000', 'http://127.0.0.1:3000'];

  return {
    origin(origin, callback) {
      // Requests without an Origin header (server-to-server, curl) are not browser CORS requests.
      if (!origin || allowed.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  };
}

function limiter({ windowMs, max, message, keyGenerator, skipSuccessfulRequests = false }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    ...(keyGenerator ? { keyGenerator } : {}),
    handler: (req, res) => res.status(429).json({ success: false, message, errors: [] }),
  });
}

function createLoginLimiter(options = {}) {
  return limiter({
    windowMs: options.windowMs || 15 * 60 * 1000,
    max: options.max || Number(process.env.LOGIN_RATE_MAX) || 10,
    skipSuccessfulRequests: true,
    message: 'Too many login attempts. Please try again later.',
    keyGenerator: (req) => `${req.ip}|${String(req.body?.email || '').toLowerCase()}`,
  });
}

function createApiLimiter(options = {}) {
  return limiter({
    windowMs: options.windowMs || 60 * 1000,
    max: options.max || Number(process.env.API_RATE_MAX) || 600,
    message: 'Too many requests. Please slow down.',
  });
}

// Rejects Mongo operator keys ($ne, $gt, ...) in request input to block NoSQL injection.
function hasOperatorKey(value, depth = 0) {
  if (!value || typeof value !== 'object' || depth > 10) return false;
  return Object.keys(value).some((key) => key.startsWith('$') || hasOperatorKey(value[key], depth + 1));
}

function rejectOperatorKeys(req, res, next) {
  if (hasOperatorKey(req.body) || hasOperatorKey(req.query)) {
    const error = new Error('Request contains disallowed characters in field names');
    error.status = 400;
    return next(error);
  }
  return next();
}

module.exports = { corsOptions, createLoginLimiter, createApiLimiter, rejectOperatorKeys };
