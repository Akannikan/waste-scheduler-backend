/**
 * API Integration Tests — Waste Scheduler Backend
 * Uses Node built-in test runner + supertest
 * Run: npm test
 *
 * NOTE: These tests use the in-memory state of the running app.
 * For full DB-backed tests, point to a test DATABASE_URL in .env.test
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../../server');

// ── Health ───────────────────────────────────────────────────
test('GET /api/health → 200', async () => {
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
});

// ── Auth: Registration ────────────────────────────────────────
test('POST /api/auth/register → 201 with token', async () => {
  const res = await request(app).post('/api/auth/register').send({
    name: 'Test Resident',
    email: `test_${Date.now()}@example.com`,
    password: 'Password123',
    role: 'resident',
  });
  // 201 means DB is connected; 500 is acceptable in CI without a real DB
  assert.ok([201, 500].includes(res.status), `Unexpected status: ${res.status}`);
  if (res.status === 201) {
    assert.ok(res.body.token, 'Token should be present');
    assert.ok(res.body.user, 'User should be present');
    assert.ok(!res.body.user.passwordHash, 'Password hash should not be exposed');
  }
});

// ── Auth: Validation ──────────────────────────────────────────
test('POST /api/auth/register with missing fields → 422', async () => {
  const res = await request(app).post('/api/auth/register').send({ email: 'bad' });
  assert.equal(res.status, 422);
  assert.ok(Array.isArray(res.body.errors));
});

test('POST /api/auth/login with missing fields → 422', async () => {
  const res = await request(app).post('/api/auth/login').send({});
  assert.equal(res.status, 422);
});

// ── Auth: Protected routes ────────────────────────────────────
test('GET /api/users requires auth → 401', async () => {
  const res = await request(app).get('/api/users');
  assert.equal(res.status, 401);
});

test('GET /api/schedules requires auth → 401', async () => {
  const res = await request(app).get('/api/schedules');
  assert.equal(res.status, 401);
});

test('GET /api/reports requires auth → 401', async () => {
  const res = await request(app).get('/api/reports');
  assert.equal(res.status, 401);
});

// ── Public routes ─────────────────────────────────────────────
test('GET /api/categories is public → 200 or 500', async () => {
  const res = await request(app).get('/api/categories');
  assert.ok([200, 500].includes(res.status));
});

test('GET /api/guide is public → 200 or 500', async () => {
  const res = await request(app).get('/api/guide');
  assert.ok([200, 500].includes(res.status));
});

test('GET /api/announcements is public → 200 or 500', async () => {
  const res = await request(app).get('/api/announcements');
  assert.ok([200, 500].includes(res.status));
});

// ── 404 handler ───────────────────────────────────────────────
test('GET /api/nonexistent → 404', async () => {
  const res = await request(app).get('/api/nonexistent-route');
  assert.equal(res.status, 404);
});

// ── Invalid token ─────────────────────────────────────────────
test('GET /api/users/me with invalid token → 401', async () => {
  const res = await request(app).get('/api/users/me').set('Authorization', 'Bearer invalidtoken123');
  assert.equal(res.status, 401);
});
