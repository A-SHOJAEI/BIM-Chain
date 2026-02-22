import { buildApp } from '../src/app';

describe('Health endpoint', () => {
  const app = buildApp();

  afterAll(async () => {
    await app.close();
  });

  it('should return ok status', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.status).toBe('ok');
    expect(body.service).toBe('bim-chain-middleware');
  });
});
