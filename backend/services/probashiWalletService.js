const crypto = require('crypto');

const LIVE_TIMEOUT_MS = 5000;
const LIVE_RETRIES = 2;
const mockMembers = {
  INVALID: { valid: false, active: false, walletEnabled: false },
  INACTIVE: { valid: true, active: false, walletEnabled: true },
  WALLET_DISABLED: { valid: true, active: true, walletEnabled: false },
};

function serviceError(message, status = 502) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function mode() {
  const value = process.env.PROBASHI_MODE || 'mock';
  if (!['mock', 'live'].includes(value)) {
    throw serviceError('PROBASHI_MODE must be mock or live', 500);
  }
  return value;
}

function memberKey(input) {
  return String(input.memberId || input.mobile || '').trim();
}

function mockMember(input) {
  const key = memberKey(input);
  const marker = Object.keys(mockMembers).find((state) => key.toUpperCase().includes(state));
  const state = mockMembers[marker] || { valid: true, active: true, walletEnabled: true };
  return {
    memberId: input.memberId || (input.mobile ? `MOCK-${input.mobile}` : key),
    name: state.valid ? 'Mock Shareholder' : '',
    mobile: input.mobile || '01700000000',
    ...state,
  };
}

function validatePositiveAmount(amount) {
  return Number.isFinite(amount) && amount > 0
    && Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-7;
}

async function liveRequest(path, payload) {
  const baseUrl = process.env.PROBASHI_API_URL;
  const apiKey = process.env.PROBASHI_API_KEY;
  const secret = process.env.PROBASHI_API_SECRET;
  if (!baseUrl || !apiKey || !secret) {
    throw serviceError('Live Probashi mode requires API URL, key, and secret', 503);
  }

  const body = JSON.stringify(payload);
  let lastError;
  for (let attempt = 0; attempt <= LIVE_RETRIES; attempt += 1) {
    const timestamp = Date.now().toString();
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}\n${body}`)
      .digest('hex');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LIVE_TIMEOUT_MS);
    try {
      const response = await fetch(new URL(path, baseUrl), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-probashi-key': apiKey,
          'x-probashi-timestamp': timestamp,
          'x-probashi-signature': signature,
        },
        body,
        signal: controller.signal,
      });
      if (response.status >= 500 && attempt < LIVE_RETRIES) continue;
      if (!response.ok) throw serviceError(`Probashi request failed with status ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error.name === 'AbortError'
        ? serviceError('Probashi request timed out')
        : error;
      if (attempt === LIVE_RETRIES || (error.status && error.status < 500)) throw lastError;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError || serviceError('Probashi request failed');
}

async function verifyMember(input) {
  input = input || {};
  if (!memberKey(input)) throw serviceError('A member ID or mobile is required', 400);
  const payload = {
    ...(input.memberId ? { memberId: input.memberId } : {}),
    ...(input.mobile ? { mobile: input.mobile } : {}),
  };
  const result = mode() === 'mock'
    ? mockMember(payload)
    : await liveRequest('/member/verify', payload);
  const member = {
    memberId: String(result.memberId || payload.memberId || ''),
    name: String(result.name || ''),
    mobile: String(result.mobile || payload.mobile || ''),
    valid: result.valid === true,
    active: result.active === true,
    walletEnabled: result.walletEnabled === true,
  };
  if (member.valid && (!member.memberId || !member.name || !member.mobile)) {
    throw serviceError('Probashi returned an incomplete valid-member record');
  }
  return member;
}

async function checkWalletBalance(input = {}) {
  const { memberId, amount } = input;
  if (!memberId || !validatePositiveAmount(amount)) {
    throw serviceError('A member ID and positive amount are required', 400);
  }
  if (mode() === 'mock') {
    const status = mockMember({ memberId });
    return {
      sufficient: status.valid && status.active && status.walletEnabled
        && !/INSUFFICIENT|LOW_BALANCE/i.test(memberId),
    };
  }
  const result = await liveRequest('/wallet/balance-check', { memberId, amount });
  return { sufficient: result.sufficient === true };
}

async function getTransactionReport(input = {}) {
  const { memberId, from, to } = input;
  if (!memberId) throw serviceError('A member ID is required', 400);
  if (mode() === 'mock') return { memberId, transactions: [] };
  const result = await liveRequest('/wallet/transactions', { memberId, from, to });
  if (!Array.isArray(result.transactions)) {
    throw serviceError('Probashi returned an invalid transaction report');
  }
  return { memberId, transactions: result.transactions };
}

async function refund(input = {}) {
  const { memberId, transactionId, amount } = input;
  if (!memberId || !transactionId || !validatePositiveAmount(amount)) {
    throw serviceError('A member ID, transaction ID, and positive amount are required', 400);
  }
  if (mode() === 'mock') return { refunded: true };
  const result = await liveRequest('/wallet/refund', { memberId, transactionId, amount });
  return { refunded: result.refunded === true };
}

module.exports = {
  checkWalletBalance,
  getTransactionReport,
  refund,
  verifyMember,
};
