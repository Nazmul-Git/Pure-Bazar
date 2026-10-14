const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../server');

describe('GET /api/health', () => {
  const originalReadyState = mongoose.connection.readyState;

  afterEach(() => {
    mongoose.connection.readyState = originalReadyState;
  });

  it('returns the healthy response when MongoDB is connected', async () => {
    mongoose.connection.readyState = 1;

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', db: 'connected' });
  });
});