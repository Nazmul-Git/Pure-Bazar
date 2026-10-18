const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const probashiWalletService = require('../services/probashiWalletService');

describe('Probashi wallet mock mode', () => {
  const originalMode = process.env.PROBASHI_MODE;

  beforeEach(() => {
    process.env.PROBASHI_MODE = 'mock';
  });

  describe('Probashi live transport', () => {
    const envKeys = ['PROBASHI_MODE', 'PROBASHI_API_URL', 'PROBASHI_API_KEY', 'PROBASHI_API_SECRET'];
    const savedEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

    beforeEach(() => {
      process.env.PROBASHI_MODE = 'live';
      process.env.PROBASHI_API_URL = 'https://probashi.example.test/';
      process.env.PROBASHI_API_KEY = 'test-api-key';
      process.env.PROBASHI_API_SECRET = 'test-api-secret';
    });

    afterEach(() => {
      jest.restoreAllMocks();
      for (const key of envKeys) {
        if (savedEnv[key] === undefined) delete process.env[key];
        else process.env[key] = savedEnv[key];
      }
    });

    it('HMAC-signs requests and retries server failures', async () => {
      const response = (status, payload) => ({
        ok: status >= 200 && status < 300,
        status,
        json: jest.fn().mockResolvedValue(payload),
      });
      const fetchMock = jest.spyOn(global, 'fetch')
        .mockResolvedValueOnce(response(503, {}))
        .mockResolvedValueOnce(response(200, {
          memberId: 'PB-LIVE-1',
          name: 'Live Member',
          mobile: '01700000001',
          valid: true,
          active: true,
          walletEnabled: true,
        }));
      const result = await probashiWalletService.verifyMember({ memberId: 'PB-LIVE-1' });
      const [, options] = fetchMock.mock.calls[1];
      const timestamp = options.headers['x-probashi-timestamp'];
      const expectedSignature = crypto.createHmac('sha256', 'test-api-secret')
        .update(`${timestamp}\n${options.body}`)
        .digest('hex');

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(options.headers['x-probashi-key']).toBe('test-api-key');
      expect(options.headers['x-probashi-signature']).toBe(expectedSignature);
      expect(result).toMatchObject({ valid: true, memberId: 'PB-LIVE-1' });
    });
  });

  afterAll(() => {
    if (originalMode === undefined) delete process.env.PROBASHI_MODE;
    else process.env.PROBASHI_MODE = originalMode;
  });

  it('verifies valid members', async () => {
    await expect(probashiWalletService.verifyMember({
      memberId: 'PB-VALID-1',
      mobile: '01700000001',
    })).resolves.toEqual({
      memberId: 'PB-VALID-1',
      name: 'Mock Shareholder',
      mobile: '01700000001',
      valid: true,
      active: true,
      walletEnabled: true,
    });
  });

  it('simulates invalid members', async () => {
    await expect(probashiWalletService.verifyMember({ memberId: 'MOCK-INVALID-1' }))
      .resolves.toMatchObject({ valid: false, active: false, walletEnabled: false });
  });

  it('simulates inactive members', async () => {
    await expect(probashiWalletService.verifyMember({ memberId: 'MOCK-INACTIVE-1' }))
      .resolves.toMatchObject({ valid: true, active: false, walletEnabled: true });
  });

  it('simulates members with wallet disabled', async () => {
    await expect(probashiWalletService.verifyMember({ memberId: 'MOCK-WALLET_DISABLED-1' }))
      .resolves.toMatchObject({ valid: true, active: true, walletEnabled: false });
  });

  it('returns only sufficient or not-sufficient for balance checks', async () => {
    await expect(probashiWalletService.checkWalletBalance({
      memberId: 'PB-VALID-1', amount: 250.25,
    })).resolves.toEqual({ sufficient: true });
    await expect(probashiWalletService.checkWalletBalance({
      memberId: 'PB-INSUFFICIENT-1', amount: 250.25,
    })).resolves.toEqual({ sufficient: false });
    await expect(probashiWalletService.checkWalletBalance({
      memberId: 'MOCK-INACTIVE-1', amount: 1,
    })).resolves.toEqual({ sufficient: false });
  });

  it('simulates transaction report and refund', async () => {
    await expect(probashiWalletService.getTransactionReport({ memberId: 'PB-VALID-1' }))
      .resolves.toEqual({ memberId: 'PB-VALID-1', transactions: [] });
    await expect(probashiWalletService.refund({
      memberId: 'PB-VALID-1', transactionId: 'TX-1', amount: 50,
    })).resolves.toEqual({ refunded: true });
  });

  it('rejects missing identifiers and invalid monetary inputs', async () => {
    await expect(probashiWalletService.verifyMember({})).rejects.toMatchObject({ status: 400 });
    await expect(probashiWalletService.checkWalletBalance({ memberId: 'PB-1', amount: 0 }))
      .rejects.toMatchObject({ status: 400 });
    await expect(probashiWalletService.refund({
      memberId: 'PB-1', transactionId: 'TX-1', amount: 1.001,
    })).rejects.toMatchObject({ status: 400 });
  });

  it('keeps Probashi credentials out of frontend source', () => {
    const frontendRoot = path.resolve(__dirname, '../../frontend/src');
    const sourceFiles = [];
    function collect(directory) {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) collect(entryPath);
        else if (/\.(?:js|jsx|ts|tsx)$/.test(entry.name)) sourceFiles.push(entryPath);
      }
    }
    collect(frontendRoot);
    const credentialPattern = /PROBASHI_(?:API_KEY|API_SECRET)|x-probashi-key/i;
    for (const file of sourceFiles) {
      expect(fs.readFileSync(file, 'utf8')).not.toMatch(credentialPattern);
    }
    expect(path.resolve(__dirname, '../services/probashiWalletService.js'))
      .toContain(`${path.resolve(__dirname, '..')}${path.sep}`);
  });
});
