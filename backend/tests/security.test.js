const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const request = require('supertest');

const {
  corsOptions, createLoginLimiter, rejectOperatorKeys,
} = require('../config/security');
const errorMiddleware = require('../middlewares/errorMiddleware');

function createApp(extra = (app) => app) {
  const app = express();
  app.use(helmet());
  app.use(cors(corsOptions({ CORS_ORIGINS: 'https://app.example.test', NODE_ENV: 'production' })));
  app.use(express.json({ limit: '1kb' }));
  app.use(rejectOperatorKeys);
  extra(app);
  app.post('/echo', (req, res) => res.json({ ok: true }));
  app.get('/echo', (req, res) => res.json({ ok: true }));
  app.get('/boom', () => { throw new Error('secret database detail'); });
  app.use(errorMiddleware);
  return app;
}

describe('security hardening', () => {
  it('rate limits repeated failed logins per IP and email', async () => {
    const limiter = createLoginLimiter({ max: 2 });
    const app = createApp((a) => a.post('/login', limiter, (req, res) => res.status(401).json({ success: false })));

    expect((await request(app).post('/login').send({ email: 'a@x.test' })).status).toBe(401);
    expect((await request(app).post('/login').send({ email: 'a@x.test' })).status).toBe(401);
    const blocked = await request(app).post('/login').send({ email: 'a@x.test' });
    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toMatch(/too many/i);
    expect((await request(app).post('/login').send({ email: 'other@x.test' })).status).toBe(401);
  });

  it('does not count successful logins toward the limit', async () => {
    const limiter = createLoginLimiter({ max: 1 });
    const app = createApp((a) => a.post('/login', limiter, (req, res) => res.json({ success: true })));
    for (let i = 0; i < 3; i += 1) {
      expect((await request(app).post('/login').send({ email: 'a@x.test' })).status).toBe(200);
    }
  });

  it('only allows configured CORS origins', async () => {
    const app = createApp();
    const allowed = await request(app).get('/echo').set('Origin', 'https://app.example.test');
    const denied = await request(app).get('/echo').set('Origin', 'https://evil.example.test');
    expect(allowed.headers['access-control-allow-origin']).toBe('https://app.example.test');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('sets helmet headers and hides x-powered-by', async () => {
    const response = await request(createApp()).get('/echo');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('rejects Mongo operator keys in body and query', async () => {
    const app = createApp();
    const body = await request(app).post('/echo').send({ email: { $ne: '' } });
    const query = await request(app).get('/echo?status[$ne]=x');
    expect(body.status).toBe(400);
    expect(query.status).toBe(400);
  });

  it('returns safe errors for server failures, bad JSON and oversized bodies', async () => {
    const app = createApp();
    const boom = await request(app).get('/boom');
    const badJson = await request(app).post('/echo').set('Content-Type', 'application/json').send('{bad');
    const large = await request(app).post('/echo').send({ text: 'x'.repeat(5000) });
    expect(boom.status).toBe(500);
    expect(JSON.stringify(boom.body)).not.toMatch(/secret database detail/);
    expect(badJson.status).toBe(400);
    expect(badJson.body.message).toBe('Malformed JSON body');
    expect(large.status).toBe(413);
  });
});
