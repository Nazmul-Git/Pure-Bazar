/* Calls every route with no token and with a role that has no permissions. Models are stubbed, no DB needed. */
process.env.JWT_SECRET = 'security-route-check-secret-that-is-long-enough';
process.env.NODE_ENV = 'test';

const path = require('path');
const Module = require('module');
const jwt = require('jsonwebtoken');
const request = require('supertest');

const noRoleUser = {
  _id: { toString: () => '65b000000000000000000001' },
  name: 'No Permission User',
  email: 'nobody@example.test',
  isActive: true,
  roleId: { _id: '65b000000000000000000002', name: 'Nobody', permissions: [] },
};

function stubModel() {
  const handler = {
    get: (target, prop) => {
      if (prop === 'findById') {
        return () => ({ populate: async () => noRoleUser, then: (res) => res(noRoleUser) });
      }
      return () => Promise.resolve(null);
    },
  };
  return new Proxy({}, handler);
}

const modelsPath = require.resolve(path.join(__dirname, '..', 'models'));
require(modelsPath);
require.cache[modelsPath].exports = new Proxy({}, { get: () => stubModel() });
void Module;

const app = require('../server');

const PUBLIC = new Set(['POST /api/auth/login', 'GET /api/health']);
const AUTH_ONLY_OK = new Set(['GET /api/auth/me', 'POST /api/auth/logout']);

function mountPath(layer) {
  const source = layer.regexp.source;
  if (layer.regexp.fast_slash) return '';
  const match = source.replace('^\\/', '/').replace('\\/?(?=\\/|$)', '').replace(/\\\//g, '/');
  return match.replace(/\(\?:\(\[\^\/\]\+\?\)\)/g, ':param').replace(/\$$/, '');
}

function collect(stack, prefix, out) {
  for (const layer of stack) {
    if (layer.route) {
      for (const method of Object.keys(layer.route.methods)) {
        out.push({ method: method.toUpperCase(), path: prefix + layer.route.path });
      }
    } else if (layer.name === 'router' && layer.handle.stack) {
      collect(layer.handle.stack, prefix + mountPath(layer), out);
    }
  }
}

async function main() {
  const routes = [];
  collect(app._router.stack, '', routes);
  const token = jwt.sign({ sub: '65b000000000000000000001' }, process.env.JWT_SECRET);
  const problems = [];

  for (const route of routes) {
    const url = route.path.replace(/:[A-Za-z]+/g, '65b000000000000000000009');
    const key = `${route.method} ${route.path}`;
    const send = (auth) => {
      const req = request(app)[route.method.toLowerCase()](url).send({});
      return auth ? req.set('Authorization', `Bearer ${token}`) : req;
    };

    const anon = await send(false);
    if (!PUBLIC.has(key) && anon.status !== 401) problems.push(`${key}: no token -> ${anon.status}`);

    if (!PUBLIC.has(key) && !AUTH_ONLY_OK.has(key)) {
      const wrong = await send(true);
      if (wrong.status !== 403) problems.push(`${key}: wrong role -> ${wrong.status}`);
    }
  }

  console.log(`Routes checked: ${routes.length}`);
  if (problems.length) {
    console.log(`PROBLEMS (${problems.length}):`);
    problems.forEach((p) => console.log(`  ${p}`));
    process.exitCode = 1;
  } else {
    console.log('All routes reject missing tokens (401) and wrong roles (403).');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
