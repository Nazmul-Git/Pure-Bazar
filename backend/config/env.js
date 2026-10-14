const dotenv = require('dotenv');
const Joi = require('joi');

dotenv.config();

const envSchema = Joi.object({
  MONGODB_URI: Joi.string()
    .uri({ scheme: ['mongodb', 'mongodb+srv'] })
    .required(),
  JWT_SECRET: Joi.string().min(32).required(),
  PORT: Joi.number().integer().min(1).max(65535).default(5000),
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development')
}).unknown();

function loadEnv() {
  const { error, value } = envSchema.validate(process.env, {
    abortEarly: false,
    convert: true
  });

  if (error) {
    const missingOrInvalid = error.details
      .map((detail) => detail.message.replace(/"/g, ''))
      .join('; ');
    throw new Error(missingOrInvalid);
  }

  return value;
}

module.exports = { loadEnv };