const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { requireBackend, backendRequire } = require('../helpers/project_loader.cjs');
const { createMockReq, createMockRes } = require('../helpers/mock_http.cjs');

const jwt = backendRequire('jsonwebtoken');
const bcrypt = backendRequire('bcryptjs');

const { config } = requireBackend('config/env');
const { User } = requireBackend('models/User');
const authController = requireBackend('controllers/authController');
const { authenticate, authorizeRoles } = requireBackend('middleware/auth');

describe('Authentication & Authorization Unit Tests', () => {
  const originals = {
    findOne: User.findOne,
    findById: User.findById,
    save: User.prototype.save
  };

  afterEach(() => {
    User.findOne = originals.findOne;
    User.findById = originals.findById;
    User.prototype.save = originals.save;
  });

  it('register: rejects missing required fields with HTTP 400', async () => {
    const req = createMockReq({ body: { username: 'alice', email: '' } });
    const res = createMockRes();

    await authController.register(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /required/i);
  });

  it('register: rejects duplicate username or email with HTTP 409', async () => {
    User.findOne = async () => ({ _id: 'existing-id', username: 'alice' });

    const req = createMockReq({
      body: { username: 'alice', email: 'alice@example.com', password: 'Password123!' }
    });
    const res = createMockRes();

    await authController.register(req, res);

    assert.equal(res.statusCode, 409);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /already exists/i);
  });

  it('register: creates new user, signs JWT token, and omits password from response', async () => {
    User.findOne = async () => null;
    User.prototype.save = async function () {
      return this;
    };

    const req = createMockReq({
      body: { username: 'sec_analyst', email: 'analyst@example.com', password: 'StrongPassword123!' }
    });
    const res = createMockRes();

    await authController.register(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.token, 'Expected signed JWT token to be returned');
    assert.equal(res.body.user.username, 'sec_analyst');
    assert.equal(res.body.user.role, 'security_engineer');
    assert.equal(res.body.user.password, undefined);

    const decoded = jwt.verify(res.body.token, config.jwtSecret);
    assert.equal(decoded.role, 'security_engineer');
  });

  it('login: rejects missing email/username or password with HTTP 400', async () => {
    const req = createMockReq({ body: { emailOrUsername: 'alice' } });
    const res = createMockRes();

    await authController.login(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
  });

  it('login: rejects unknown account with HTTP 401', async () => {
    User.findOne = async () => null;

    const req = createMockReq({ body: { emailOrUsername: 'nobody', password: 'Password123!' } });
    const res = createMockRes();

    await authController.login(req, res);

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Invalid credentials/i);
  });

  it('login: rejects invalid password with HTTP 401', async () => {
    const passwordHash = await bcrypt.hash('CorrectPassword123!', 10);
    const fakeUser = new User({
      username: 'alice',
      email: 'alice@example.com',
      password: passwordHash,
      role: 'security_engineer'
    });

    User.findOne = async () => fakeUser;

    const req = createMockReq({ body: { emailOrUsername: 'alice', password: 'WrongPassword!' } });
    const res = createMockRes();

    await authController.login(req, res);

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Invalid credentials/i);
  });

  it('login: succeeds with valid password and issues verifiable JWT', async () => {
    const plainPassword = 'CorrectPassword123!';
    const passwordHash = await bcrypt.hash(plainPassword, 10);
    const fakeUser = new User({
      username: 'alice',
      email: 'alice@example.com',
      password: passwordHash,
      role: 'admin'
    });

    User.findOne = async () => fakeUser;

    const req = createMockReq({ body: { emailOrUsername: 'alice', password: plainPassword } });
    const res = createMockRes();

    await authController.login(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.user.username, 'alice');
    assert.equal(res.body.user.role, 'admin');

    const decoded = jwt.verify(res.body.token, config.jwtSecret);
    assert.equal(String(decoded.id), String(fakeUser._id));
    assert.equal(decoded.role, 'admin');
  });

  it('User model: hashes password with bcrypt and verifies match via comparePassword', async () => {
    const user = new User({
      username: 'hash_tester',
      email: 'hash@example.com',
      password: 'MySecretPassword99!'
    });

    // Simulate mongoose pre-save hook hashing explicitly via bcrypt
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash('MySecretPassword99!', salt);

    assert.notEqual(user.password, 'MySecretPassword99!');
    assert.equal(await user.comparePassword('MySecretPassword99!'), true);
    assert.equal(await user.comparePassword('DifferentPassword!'), false);
  });

  it('authenticate middleware: rejects missing or non-Bearer Authorization header with 401', async () => {
    const reqNoHeader = createMockReq({ headers: {} });
    const resNoHeader = createMockRes();
    let nextCalled = false;

    await authenticate(reqNoHeader, resNoHeader, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(resNoHeader.statusCode, 401);

    const reqBasic = createMockReq({ headers: { authorization: 'Basic abc123' } });
    const resBasic = createMockRes();

    await authenticate(reqBasic, resBasic, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(resBasic.statusCode, 401);
  });

  it('authenticate middleware: rejects expired JWT with TokenExpiredError message', async () => {
    const expiredToken = jwt.sign({ id: 'user-123' }, config.jwtSecret, { expiresIn: '-10s' });
    const req = createMockReq({ headers: { authorization: `Bearer ${expiredToken}` } });
    const res = createMockRes();

    await authenticate(req, res, () => {});

    assert.equal(res.statusCode, 401);
    assert.match(res.body.message, /expired/i);
  });

  it('authenticate middleware: rejects tampered JWT signature with 401', async () => {
    const badToken = jwt.sign({ id: 'user-123' }, 'wrong-signing-secret');
    const req = createMockReq({ headers: { authorization: `Bearer ${badToken}` } });
    const res = createMockRes();

    await authenticate(req, res, () => {});

    assert.equal(res.statusCode, 401);
    assert.match(res.body.message, /Invalid token/i);
  });

  it('authenticate middleware: rejects valid JWT if user does not exist in DB', async () => {
    const token = jwt.sign({ id: 'deleted-user-id' }, config.jwtSecret);
    User.findById = () => ({
      select: async () => null
    });

    const req = createMockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = createMockRes();

    await authenticate(req, res, () => {});

    assert.equal(res.statusCode, 401);
    assert.match(res.body.message, /User not found/i);
  });

  it('authenticate middleware: attaches user and calls next() for valid JWT', async () => {
    const userDoc = { _id: 'u100', username: 'alice', email: 'alice@example.com', role: 'security_engineer' };
    const token = jwt.sign({ id: 'u100', role: 'security_engineer' }, config.jwtSecret);
    User.findById = () => ({
      select: async () => userDoc
    });

    const req = createMockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = createMockRes();
    let nextCalled = false;

    await authenticate(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.deepEqual(req.user, userDoc);
  });

  it('authorizeRoles middleware: enforces RBAC and returns 403 for unauthorized role', () => {
    const guard = authorizeRoles('admin');

    const reqDenied = createMockReq({ user: { _id: 'u1', role: 'viewer' } });
    const resDenied = createMockRes();
    let deniedNext = false;
    guard(reqDenied, resDenied, () => {
      deniedNext = true;
    });
    assert.equal(deniedNext, false);
    assert.equal(resDenied.statusCode, 403);

    const reqAllowed = createMockReq({ user: { _id: 'u2', role: 'admin' } });
    const resAllowed = createMockRes();
    let allowedNext = false;
    guard(reqAllowed, resAllowed, () => {
      allowedNext = true;
    });
    assert.equal(allowedNext, true);
  });

  it('getMe: returns 401 when req.user is missing and 200 with user profile when present', async () => {
    const resUnauth = createMockRes();
    await authController.getMe(createMockReq(), resUnauth);
    assert.equal(resUnauth.statusCode, 401);

    const reqAuth = createMockReq({
      user: { _id: 'u1', username: 'alice', email: 'alice@example.com', role: 'admin', createdAt: '2026-01-01' }
    });
    const resAuth = createMockRes();
    await authController.getMe(reqAuth, resAuth);
    assert.equal(resAuth.statusCode, 200);
    assert.equal(resAuth.body.user.username, 'alice');
  });
});
