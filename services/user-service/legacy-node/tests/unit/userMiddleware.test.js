/**
 * Unit tests for user-service jwtMiddleware
 */
const { verifyJWT, requireRole } = require('../../src/middleware/jwtMiddleware');

jest.mock('jsonwebtoken', () => ({ verify: jest.fn() }));
jest.mock('fs', () => ({ readFileSync: jest.fn(() => 'mock-public-key') }));
const jwt = require('jsonwebtoken');

function makeReq(token) {
  return { headers: { authorization: token ? `Bearer ${token}` : '' } };
}
function makeRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json   = jest.fn(() => res);
  return res;
}

describe('verifyJWT', () => {
  beforeEach(() => jest.clearAllMocks());

  test('attaches user payload and calls next()', () => {
    const payload = { sub: 'u1', role: 'user' };
    jwt.verify.mockReturnValue(payload);
    const req = makeReq('tok'); const res = makeRes(); const next = jest.fn();
    verifyJWT(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual(payload);
  });

  test('401 when no token provided', () => {
    const req = makeReq(null); const res = makeRes(); const next = jest.fn();
    verifyJWT(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requireRole', () => {
  test('allows user with matching role', () => {
    const req = { user: { role: 'admin' } }; const res = makeRes(); const next = jest.fn();
    requireRole('admin')(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('blocks user with insufficient role', () => {
    const req = { user: { role: 'user' } }; const res = makeRes(); const next = jest.fn();
    requireRole('admin')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
