import { buildApp } from '../src/app';
import { MockFabricService } from '../src/services/fabric-service';

describe('IP Attribution endpoints', () => {
  const fabricService = new MockFabricService();
  const app = buildApp(fabricService);
  let token: string;

  beforeAll(async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: 'admin', password: 'adminpw' },
    });
    token = JSON.parse(res.payload).token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/v1/ip-attribution/register creates new IP record', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ip-attribution/register',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        elementUniqueId: 'elem-ip-1',
        creatorUserId: 'user1',
        creatorOrgMspId: 'Org1MSP',
        familyName: 'Custom Door',
      },
    });
    expect(res.statusCode).toBe(201);
  });

  it('GET /api/v1/ip-attribution/:elementId returns ownership record', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/ip-attribution/elem-ip-1',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.elementUniqueId).toBe('elem-ip-1');
  });

  it('GET /api/v1/ip-attribution/:elementId not found returns 404', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/ip-attribution/nonexistent',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('GET /api/v1/ip-attribution?org=Org1MSP returns org elements', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/ip-attribution?org=Org1MSP',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const records = JSON.parse(res.payload);
    expect(Array.isArray(records)).toBe(true);
  });

  it('POST /api/v1/ip-attribution/contribute adds contribution', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ip-attribution/contribute',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        elementId: 'elem-ip-1',
        userId: 'engineer1',
        orgMspId: 'Org2MSP',
        changeHash: 'contrib-hash-1',
        description: 'Updated structure',
      },
    });
    expect(res.statusCode).toBe(201);
  });
});
