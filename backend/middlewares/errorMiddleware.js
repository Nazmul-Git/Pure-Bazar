function errorMiddleware(error, req, res, next) {
  const status = error.status || error.statusCode || 500;
  const message = status === 500 ? 'Internal server error' : error.message;

  res.status(status).json({ message });
}

module.exports = errorMiddleware;