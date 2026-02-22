import { buildApp } from '../src/app';
import { MockFabricService } from '../src/services/fabric-service';

describe('Changes endpoints', () => {
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

  it('POST /api/v1/changes with valid single record returns 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/changes',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        modelId: 'model-1',
        elementUniqueId: 'elem-1',
        changeType: 'ADD',
        elementHash: 'hash-1',
        userId: 'user1',
        orgId: 'Org1MSP',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.txIds).toBeDefined();
    expect(body.txIds.length).toBe(1);
  });

  it('POST /api/v1/changes with valid batch returns 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/changes',
      headers: { authorization: `Bearer ${token}` },
      payload: [
        { modelId: 'm1', elementUniqueId: 'e1', changeType: 'ADD', elementHash: 'h1', userId: 'u1', orgId: 'o1' },
        { modelId: 'm1', elementUniqueId: 'e2', changeType: 'MODIFY', elementHash: 'h2', userId: 'u1', orgId: 'o1' },
      ],
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.txIds.length).toBe(2);
  });

  it('POST /api/v1/changes missing modelId returns 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/changes',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        elementUniqueId: 'elem-1',
        changeType: 'ADD',
        elementHash: 'hash-1',
        userId: 'user1',
        orgId: 'Org1MSP',
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /api/v1/changes missing elementHash returns 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/changes',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        modelId: 'model-1',
        elementUniqueId: 'elem-1',
        changeType: 'ADD',
        userId: 'user1',
        orgId: 'Org1MSP',
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /api/v1/changes without auth returns 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/changes',
      payload: {
        modelId: 'model-1',
        elementUniqueId: 'elem-1',
        changeType: 'ADD',
        elementHash: 'hash-1',
        userId: 'user1',
        orgId: 'Org1MSP',
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/v1/audit-trail/:modelId returns records', async () => {
    // First create a record
    await app.inject({
      method: 'POST',
      url: '/api/v1/changes',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        modelId: 'test-model',
        elementUniqueId: 'elem-test',
        changeType: 'ADD',
        elementHash: 'hash-test',
        userId: 'user1',
        orgId: 'Org1MSP',
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/audit-trail/test-model',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const records = JSON.parse(res.payload);
    expect(Array.isArray(records)).toBe(true);
    expect(records.length).toBeGreaterThan(0);
  });

  it('GET /api/v1/audit-trail/:modelId with no records returns empty array', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/audit-trail/nonexistent-model',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const records = JSON.parse(res.payload);
    expect(records).toEqual([]);
  });

  it('POST /api/v1/changes accepts orgMspId directly (alternative to orgId)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/changes',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        modelId: 'model-org-test',
        elementUniqueId: 'elem-org',
        changeType: 'ADD',
        elementHash: 'hash-org',
        userId: 'user1',
        orgMspId: 'Org2MSP',
      },
    });
    expect(res.statusCode).toBe(201);

    // Verify it was stored with orgMspId mapped correctly
    const trailRes = await app.inject({
      method: 'GET',
      url: '/api/v1/audit-trail/model-org-test',
      headers: { authorization: `Bearer ${token}` },
    });
    const records = JSON.parse(trailRes.payload);
    expect(records.length).toBe(1);
    expect(records[0].orgMspId).toBe('Org2MSP');
  });

  it('POST /api/v1/changes maps orgId to orgMspId for the chaincode', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/changes',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        modelId: 'model-mapping-test',
        elementUniqueId: 'elem-map',
        changeType: 'MODIFY',
        elementHash: 'hash-map',
        userId: 'user1',
        orgId: 'Org1MSP',
      },
    });
    expect(res.statusCode).toBe(201);

    const trailRes = await app.inject({
      method: 'GET',
      url: '/api/v1/audit-trail/model-mapping-test',
      headers: { authorization: `Bearer ${token}` },
    });
    const records = JSON.parse(trailRes.payload);
    expect(records.length).toBe(1);
    expect(records[0].orgMspId).toBe('Org1MSP');
  });

  it('GET /api/v1/audit-trail/:modelId with timeRange query params filters', async () => {
    // Submit records with specific timestamps
    await app.inject({
      method: 'POST',
      url: '/api/v1/changes',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        modelId: 'time-model',
        elementUniqueId: 'e1',
        changeType: 'ADD',
        elementHash: 'h1',
        userId: 'u1',
        orgId: 'o1',
        timestamp: '2025-01-15T10:00:00Z',
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/audit-trail/time-model?startTime=2025-01-15T09:00:00Z&endTime=2025-01-15T11:00:00Z',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const records = JSON.parse(res.payload);
    expect(Array.isArray(records)).toBe(true);
  });
});
