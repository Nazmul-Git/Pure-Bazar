function errorMiddleware(error, req, res, next) {
  if (res.headersSent) return next(error);

  const candidateStatus = error.status || error.statusCode || 500;
  const status = candidateStatus >= 400 && candidateStatus <= 599 ? candidateStatus : 500;
  const message = status === 500 ? 'Internal server error' : error.message;
  const errors = Array.isArray(error.errors) ? error.errors : [];

  res.status(status).json({ success: false, message, errors });
}

module.exports = errorMiddleware;