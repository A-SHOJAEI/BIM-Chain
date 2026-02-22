import { buildApp } from '../src/app';
import { MockFabricService } from '../src/services/fabric-service';

describe('Governance endpoints', () => {
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

  it('POST /api/v1/governance/proposals creates proposal', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/governance/proposals',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        proposalId: 'prop-test-1',
        modelId: 'model-1',
        proposerId: 'user1',
        proposerOrg: 'Org1MSP',
        description: 'Add new section',
        changeHash: 'hash-1',
        requiredOrgs: ['Org1MSP', 'Org2MSP'],
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.proposalId).toBe('prop-test-1');
  });

  it('POST /api/v1/governance/proposals/:id/approve approves', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/governance/proposals/prop-test-1/approve',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        orgMspId: 'Org1MSP',
        userId: 'user1',
        comment: 'Looks good',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.status).toBe('ok');
  });

  it('POST /api/v1/governance/proposals/:id/reject rejects', async () => {
    // Create a new proposal to reject
    await app.inject({
      method: 'POST',
      url: '/api/v1/governance/proposals',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        proposalId: 'prop-reject-1',
        modelId: 'model-1',
        proposerId: 'user1',
        proposerOrg: 'Org1MSP',
        description: 'Bad change',
        changeHash: 'hash-2',
        requiredOrgs: ['Org1MSP'],
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/governance/proposals/prop-reject-1/reject',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        orgMspId: 'Org1MSP',
        userId: 'user1',
        reason: 'Does not meet standards',
      },
    });
    expect(res.statusCode).toBe(200);
  });

  it('GET /api/v1/governance/pending returns proposals for org', async () => {
    // Create a fresh pending proposal
    await app.inject({
      method: 'POST',
      url: '/api/v1/governance/proposals',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        proposalId: 'prop-pending-1',
        modelId: 'model-1',
        proposerId: 'user1',
        proposerOrg: 'Org1MSP',
        description: 'Pending change',
        changeHash: 'hash-3',
        requiredOrgs: ['Org1MSP'],
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/governance/pending?org=Org1MSP',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const proposals = JSON.parse(res.payload);
    expect(Array.isArray(proposals)).toBe(true);
    expect(proposals.length).toBeGreaterThan(0);
  });

  it('GET /api/v1/governance/pending excludes resolved', async () => {
    // The previously approved and rejected proposals should be excluded
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/governance/pending?org=Org1MSP',
      headers: { authorization: `Bearer ${token}` },
    });
    const proposals = JSON.parse(res.payload);
    for (const p of proposals) {
      expect(p.status).toBe('PROPOSED');
    }
  });
});
