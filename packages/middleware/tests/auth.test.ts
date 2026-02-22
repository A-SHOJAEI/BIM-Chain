import { buildApp } from '../src/app';
import { MockFabricService } from '../src/services/fabric-service';

describe('Auth endpoints', () => {
  const fabricService = new MockFabricService();
  const app = buildApp(fabricService);

  afterAll(async () => {
    await app.close();
  });

  it('login with valid credentials returns JWT', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: 'admin', password: 'adminpw' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.token).toBeDefined();
    expect(body.username).toBe('admin');
  });

  it('login with invalid credentials returns 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: 'admin', password: 'wrong' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('protected route with valid token allows access', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: 'admin', password: 'adminpw' },
    });
    const { token } = JSON.parse(loginRes.payload);

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/audit-trail/model-1',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it('protected route with expired token returns 401', async () => {
    // Sign a token with exp set to the past
    const nowSec = Math.floor(Date.now() / 1000);
    const token = app.jwt.sign(
      { username: 'admin', orgId: 'Org1MSP', iat: nowSec - 10, exp: nowSec - 5 }
    );

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/audit-trail/model-1',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(401);
  });

  it('protected route without token returns 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/audit-trail/model-1',
    });
    expect(res.statusCode).toBe(401);
  });

  it('refresh token returns new access token', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: 'admin', password: 'adminpw' },
    });
    const { token } = JSON.parse(loginRes.payload);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.token).toBeDefined();
  });
});
