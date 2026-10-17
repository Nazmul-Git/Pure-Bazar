const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');

jest.mock('../models', () => ({
  Location: { find: jest.fn() },
  User: { findById: jest.fn() },
}));

const { Location, User } = require('../models');
const locationRoutes = require('../routes/locationRoutes');
const errorMiddleware = require('../middlewares/errorMiddleware');

const secret = 'location-integration-test-secret';
const userId = '65b000000000000000000001';
const centralLocation = {
  _id: { toString: () => '65b000000000000000000002' },
  type: 'CENTRAL',
  name: 'Central Warehouse',
};

function createApp() {
  const app = express();
  app.use('/api', locationRoutes);
  app.use(errorMiddleware);
  return app;
}

function locationQuery(locations) {
  const query = {
    sort: jest.fn(() => query),
    lean: jest.fn().mockResolvedValue(locations),
  };
  return query;
}

describe('location API', () => {
  const app = createApp();
  const auth = {
    Authorization: `Bearer ${jwt.sign({ sub: userId }, secret, { expiresIn: '1h' })}`,
  };

  beforeEach(() => {
    process.env.JWT_SECRET = secret;
    jest.clearAllMocks();
    User.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue({
        _id: userId,
        isActive: true,
        roleId: { name: 'Warehouse Staff', permissions: ['stock:read'] },
      }),
    });
    Location.find.mockReturnValue(locationQuery([centralLocation]));
  });

  it('returns the central location with a stable ID for stock and GRN screens', async () => {
    const response = await request(app).get('/api/locations?type=CENTRAL').set(auth);

    expect(response.status).toBe(200);
    expect(response.body.locations).toEqual([{
      id: centralLocation._id.toString(), type: 'CENTRAL', name: 'Central Warehouse',
    }]);
    expect(Location.find).toHaveBeenCalledWith({ type: 'CENTRAL' });
  });

  it('rejects unsupported location filters', async () => {
    const response = await request(app).get('/api/locations?type=STORE').set(auth);

    expect(response.status).toBe(400);
    expect(Location.find).not.toHaveBeenCalled();
  });

  it('requires stock read permission', async () => {
    User.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue({
        _id: userId, isActive: true, roleId: { name: 'Cashier', permissions: [] },
      }),
    });

    const response = await request(app).get('/api/locations').set(auth);

    expect(response.status).toBe(403);
  });
});
