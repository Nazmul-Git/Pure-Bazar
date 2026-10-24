function errorMiddleware(error, req, res, next) {
  if (res.headersSent) return next(error);

  let candidateStatus = error.status || error.statusCode || 500;
  let message = error.message;
  if (error.type === 'entity.parse.failed') message = 'Malformed JSON body';
  if (error.name === 'MulterError') candidateStatus = 400;

  const status = candidateStatus >= 400 && candidateStatus <= 599 ? candidateStatus : 500;
  if (status === 500) {
    message = 'Internal server error';
    if (process.env.NODE_ENV !== 'test') console.error(`[error] ${req.method} ${req.path}: ${error.message}`);
  }
  const errors = Array.isArray(error.errors) ? error.errors : [];

  res.status(status).json({ success: false, message, errors });
}

module.exports = errorMiddleware;