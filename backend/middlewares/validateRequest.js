const { validationResult } = require('express-validator');

function validateRequest(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const error = new Error('Request validation failed');
  error.status = 400;
  error.errors = result.array({ onlyFirstError: true }).map(({ path, msg }) => ({
    field: path,
    message: msg,
  }));
  return next(error);
}

module.exports = validateRequest;