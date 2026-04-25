/**
 * Integration tests for user-service CRUD endpoints.
 * Mocks pg so no real database is needed.
 */
jest.mock('fs', () => {
  const crypto = require('crypto');
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pub = publicKey.export({ type: 'spki', format: 'pem' });
  return { readFileSync: jest.fn(() => pub) };
});

// ─── Build a JWT we can sign for tests ────────────────────────────────────────
const crypto = require('crypto');
const { privateKey: testPrivKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });

function signToken(payload) {
  const jwt = require('jsonwebtoken');
  // temporarily replace verify to use our test private key's public half
  return jwt.sign(payload, testPrivKey.export({ type: 'pkcs8', format: 'pem' }), {
    algorithm: 'RS256',
    expiresIn: '1h',
  });
}

// Mock jwt.verify to accept any token and return our payload
jest.mock('jsonwebtoken', () => {
  const real = jest.requireActual('jsonwebtoken');
  return {
    ...real,
    verify: jest.fn((token, _key, _opts) => {
      const parts = token.split('.');
      if (parts.length !== 3) throw new Error('bad token');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      return payload;
    }),
  };
});

// ─── Mock pg ──────────────────────────────────────────────────────────────────
const mockQuery = jest.fn();
jest.mock('pg', () => ({ Pool: jest.fn(() => ({ query: mockQuery })) }));

process.env.JWT_PUBLIC_KEY_PATH = './keys/public.pem';
process.env.POSTGRES_URL        = 'postgresql://test:test@localhost/test';

const request = require('supertest');
const jwt     = require('jsonwebtoken');
const app     = require('../../src/app');

// ─── Helpers ──────────────────────────────────────────────────────────────────
function userToken(override = {}) {
  const payload = { sub: 'user-uuid-1', email: 'user@test.com', role: 'user', ...override };
  return `Bearer ${signToken(payload)}`;
}
function adminToken() { return userToken({ sub: 'admin-uuid-1', role: 'admin' }); }

const fakeUser = { id: 'user-uuid-1', email: 'user@test.com', name: 'Test User', avatar: null, role: 'user', created_at: new Date().toISOString() };
const fakeAdmin = { id: 'admin-uuid-1', email: 'admin@test.com', name: 'Admin', role: 'admin' };

beforeEach(() => {
  jest.clearAllMocks();
  // Default: initDB CREATE TABLE (called at startup, rows not used)
  mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
});

// ─── GET /health ──────────────────────────────────────────────────────────────
describe('GET /health', () => {
  it('returns 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });
});

// ─── GET /users/me ────────────────────────────────────────────────────────────
describe('GET /users/me', () => {
  it('returns own profile', async () => {
    mockQuery.mockResolvedValue({ rows: [fakeUser] });
    const res = await request(app).get('/users/me').set('Authorization', userToken());
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('user@test.com');
  });

  it('returns 404 when user does not exist', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const res = await request(app).get('/users/me').set('Authorization', userToken());
    expect(res.status).toBe(404);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/users/me');
    expect(res.status).toBe(401);
  });
});

// ─── GET /users/:id ───────────────────────────────────────────────────────────
describe('GET /users/:id', () => {
  it('returns user by id', async () => {
    mockQuery.mockResolvedValue({ rows: [fakeUser] });
    const res = await request(app).get('/users/user-uuid-1').set('Authorization', userToken());
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('user-uuid-1');
  });

  it('returns 404 for unknown user', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const res = await request(app).get('/users/unknown-id').set('Authorization', userToken());
    expect(res.status).toBe(404);
  });
});

// ─── PATCH /users/me ──────────────────────────────────────────────────────────
describe('PATCH /users/me', () => {
  it('updates own profile', async () => {
    const updated = { ...fakeUser, name: 'New Name' };
    mockQuery.mockResolvedValue({ rows: [updated] });
    const res = await request(app)
      .patch('/users/me')
      .set('Authorization', userToken())
      .send({ name: 'New Name' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New Name');
  });

  it('returns 400 when no fields provided', async () => {
    const res = await request(app)
      .patch('/users/me')
      .set('Authorization', userToken())
      .send({});
    expect(res.status).toBe(400);
  });
});

// ─── PATCH /users/:id/role ────────────────────────────────────────────────────
describe('PATCH /users/:id/role', () => {
  it('allows admin to change user role', async () => {
    mockQuery.mockResolvedValue({ rows: [{ ...fakeUser, role: 'admin' }] });
    const res = await request(app)
      .patch('/users/user-uuid-1/role')
      .set('Authorization', adminToken())
      .send({ role: 'admin' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('admin');
  });

  it('returns 403 for non-admin', async () => {
    const res = await request(app)
      .patch('/users/user-uuid-1/role')
      .set('Authorization', userToken())
      .send({ role: 'admin' });
    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid role value', async () => {
    const res = await request(app)
      .patch('/users/user-uuid-1/role')
      .set('Authorization', adminToken())
      .send({ role: 'superuser' });
    expect(res.status).toBe(400);
  });
});

// ─── DELETE /users/:id ────────────────────────────────────────────────────────
describe('DELETE /users/:id', () => {
  it('admin can delete a user', async () => {
    mockQuery.mockResolvedValue({ rowCount: 1 });
    const res = await request(app)
      .delete('/users/user-uuid-1')
      .set('Authorization', adminToken());
    expect(res.status).toBe(204);
  });

  it('returns 404 when user not found', async () => {
    mockQuery.mockResolvedValue({ rowCount: 0 });
    const res = await request(app)
      .delete('/users/nonexistent')
      .set('Authorization', adminToken());
    expect(res.status).toBe(404);
  });

  it('returns 403 for regular user', async () => {
    const res = await request(app)
      .delete('/users/someone')
      .set('Authorization', userToken());
    expect(res.status).toBe(403);
  });
});

// ─── GET /users (admin list) ──────────────────────────────────────────────────
describe('GET /users', () => {
  it('returns user list for admin', async () => {
    mockQuery.mockResolvedValue({ rows: [fakeUser, fakeAdmin] });
    const res = await request(app)
      .get('/users')
      .set('Authorization', adminToken());
    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(2);
  });

  it('returns 403 for regular user', async () => {
    const res = await request(app)
      .get('/users')
      .set('Authorization', userToken());
    expect(res.status).toBe(403);
  });
});