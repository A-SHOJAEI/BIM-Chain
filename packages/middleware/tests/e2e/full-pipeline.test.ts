/**
 * E2E test for the full BIM-Chain pipeline.
 * Tests the complete flow through the middleware API with MockFabricService.
 */
import { buildApp } from '../../src/app';
import { MockFabricService } from '../../src/services/fabric-service';

describe('Full Pipeline E2E', () => {
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

  it('full element creation pipeline: POST change -> query audit -> verify IP', async () => {
    // 1. Submit a new element change
    const changeRes = await app.inject({
      method: 'POST',
      url: '/api/v1/changes',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        modelId: 'e2e-model-1',
        elementUniqueId: 'e2e-elem-1',
        changeType: 'ADD',
        elementHash: 'hash-e2e-1',
        userId: 'architect1',
        orgId: 'ArchitectOrg',
        timestamp: '2025-06-01T10:00:00Z',
      },
    });
    expect(changeRes.statusCode).toBe(201);
    const { txIds } = JSON.parse(changeRes.payload);
    expect(txIds).toHaveLength(1);

    // 2. Query audit trail for the model
    const auditRes = await app.inject({
      method: 'GET',
      url: '/api/v1/audit-trail/e2e-model-1',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(auditRes.statusCode).toBe(200);
    const auditRecords = JSON.parse(auditRes.payload);
    expect(auditRecords.length).toBeGreaterThanOrEqual(1);
    const found = auditRecords.find((r: any) => r.elementUniqueId === 'e2e-elem-1');
    expect(found).toBeDefined();
    expect(found.changeType).toBe('ADD');

    // 3. Register IP for the element and verify
    const ipRegRes = await app.inject({
      method: 'POST',
      url: '/api/v1/ip-attribution/register',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        elementUniqueId: 'e2e-elem-1',
        creatorUserId: 'architect1',
        creatorOrgMspId: 'ArchitectOrg',
        familyName: 'Custom Wall',
        creationTimestamp: '2025-06-01T10:00:00Z',
      },
    });
    expect(ipRegRes.statusCode).toBe(201);

    const ipQueryRes = await app.inject({
      method: 'GET',
      url: '/api/v1/ip-attribution/e2e-elem-1',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(ipQueryRes.statusCode).toBe(200);
    const ipRecord = JSON.parse(ipQueryRes.payload);
    expect(ipRecord.creatorUserId).toBe('architect1');
    expect(ipRecord.creatorOrgMspId).toBe('ArchitectOrg');
  });

  it('element modification pipeline: POST modify -> query history -> verify contribution', async () => {
    // 1. Submit initial element
    await app.inject({
      method: 'POST',
      url: '/api/v1/changes',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        modelId: 'e2e-model-2',
        elementUniqueId: 'e2e-elem-2',
        changeType: 'ADD',
        elementHash: 'hash-e2e-2a',
        userId: 'architect1',
        orgId: 'ArchitectOrg',
        timestamp: '2025-06-01T10:00:00Z',
      },
    });

    // Register IP
    await app.inject({
      method: 'POST',
      url: '/api/v1/ip-attribution/register',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        elementUniqueId: 'e2e-elem-2',
        creatorUserId: 'architect1',
        creatorOrgMspId: 'ArchitectOrg',
        creationTimestamp: '2025-06-01T10:00:00Z',
      },
    });

    // 2. Submit a modification
    const modRes = await app.inject({
      method: 'POST',
      url: '/api/v1/changes',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        modelId: 'e2e-model-2',
        elementUniqueId: 'e2e-elem-2',
        changeType: 'MODIFY',
        elementHash: 'hash-e2e-2b',
        previousHash: 'hash-e2e-2a',
        userId: 'engineer1',
        orgId: 'EngineerOrg',
        timestamp: '2025-06-02T14:00:00Z',
      },
    });
    expect(modRes.statusCode).toBe(201);

    // 3. Query audit history and verify both records exist
    const auditRes = await app.inject({
      method: 'GET',
      url: '/api/v1/audit-trail/e2e-model-2',
      headers: { authorization: `Bearer ${token}` },
    });
    const records = JSON.parse(auditRes.payload);
    expect(records.length).toBeGreaterThanOrEqual(2);
    const addRecord = records.find((r: any) => r.changeType === 'ADD' && r.elementUniqueId === 'e2e-elem-2');
    const modRecord = records.find((r: any) => r.changeType === 'MODIFY' && r.elementUniqueId === 'e2e-elem-2');
    expect(addRecord).toBeDefined();
    expect(modRecord).toBeDefined();

    // 4. Add contribution and verify
    const contribRes = await app.inject({
      method: 'POST',
      url: '/api/v1/ip-attribution/contribute',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        elementId: 'e2e-elem-2',
        userId: 'engineer1',
        orgMspId: 'EngineerOrg',
        changeHash: 'hash-e2e-2b',
        description: 'Structural modification',
      },
    });
    expect(contribRes.statusCode).toBe(201);

    const ipRes = await app.inject({
      method: 'GET',
      url: '/api/v1/ip-attribution/e2e-elem-2',
      headers: { authorization: `Bearer ${token}` },
    });
    const ipRecord = JSON.parse(ipRes.payload);
    expect(ipRecord.contributions.length).toBeGreaterThanOrEqual(1);
    const contrib = ipRecord.contributions.find((c: any) => c.userId === 'engineer1');
    expect(contrib).toBeDefined();
    expect(contrib.orgMspId).toBe('EngineerOrg');
  });

  it('governance approval flow: propose -> approve org1 -> approve org2 -> verify approved', async () => {
    // 1. Create proposal requiring two orgs
    const propRes = await app.inject({
      method: 'POST',
      url: '/api/v1/governance/proposals',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        proposalId: 'e2e-prop-1',
        modelId: 'e2e-model-1',
        proposerId: 'architect1',
        proposerOrg: 'ArchitectOrg',
        description: 'Add new wing to building',
        changeHash: 'prop-hash-1',
        requiredOrgs: ['ArchitectOrg', 'EngineerOrg'],
      },
    });
    expect(propRes.statusCode).toBe(201);

    // 2. Verify proposal appears in pending for both orgs
    const pendingRes1 = await app.inject({
      method: 'GET',
      url: '/api/v1/governance/pending?org=ArchitectOrg',
      headers: { authorization: `Bearer ${token}` },
    });
    const pending1 = JSON.parse(pendingRes1.payload);
    expect(pending1.some((p: any) => p.proposalId === 'e2e-prop-1')).toBe(true);

    // 3. Approve from Org1
    const approve1Res = await app.inject({
      method: 'POST',
      url: '/api/v1/governance/proposals/e2e-prop-1/approve',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        orgMspId: 'ArchitectOrg',
        userId: 'architect1',
        comment: 'Approved by architecture team',
      },
    });
    expect(approve1Res.statusCode).toBe(200);

    // 4. Approve from Org2
    const approve2Res = await app.inject({
      method: 'POST',
      url: '/api/v1/governance/proposals/e2e-prop-1/approve',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        orgMspId: 'EngineerOrg',
        userId: 'engineer1',
        comment: 'Approved by engineering team',
      },
    });
    expect(approve2Res.statusCode).toBe(200);

    // 5. Verify proposal no longer in pending (it's been approved)
    const pendingRes2 = await app.inject({
      method: 'GET',
      url: '/api/v1/governance/pending?org=ArchitectOrg',
      headers: { authorization: `Bearer ${token}` },
    });
    const pending2 = JSON.parse(pendingRes2.payload);
    expect(pending2.some((p: any) => p.proposalId === 'e2e-prop-1')).toBe(false);
  });

  it('concurrent submissions: parallel POSTs -> all recorded -> no conflicts', async () => {
    // Submit 5 changes concurrently
    const submissions = Array.from({ length: 5 }, (_, i) =>
      app.inject({
        method: 'POST',
        url: '/api/v1/changes',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          modelId: 'e2e-concurrent-model',
          elementUniqueId: `concurrent-elem-${i}`,
          changeType: 'ADD',
          elementHash: `concurrent-hash-${i}`,
          userId: 'user1',
          orgId: 'ArchitectOrg',
          timestamp: `2025-06-01T10:0${i}:00Z`,
        },
      })
    );

    const results = await Promise.all(submissions);

    // All should succeed
    for (const res of results) {
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.txIds).toHaveLength(1);
    }

    // Query and verify all were recorded
    const auditRes = await app.inject({
      method: 'GET',
      url: '/api/v1/audit-trail/e2e-concurrent-model',
      headers: { authorization: `Bearer ${token}` },
    });
    const records = JSON.parse(auditRes.payload);
    expect(records.length).toBeGreaterThanOrEqual(5);

    // Verify each element is present
    for (let i = 0; i < 5; i++) {
      const found = records.find((r: any) => r.elementUniqueId === `concurrent-elem-${i}`);
      expect(found).toBeDefined();
    }
  });

  it('model version chain: sync v1 -> sync v2 -> verify hash linkage', async () => {
    // 1. Submit version 1 of a model
    const v1Res = await app.inject({
      method: 'POST',
      url: '/api/v1/changes',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        modelId: 'e2e-version-model',
        elementUniqueId: 'version-elem-1',
        changeType: 'ADD',
        elementHash: 'version-hash-v1',
        userId: 'architect1',
        orgId: 'ArchitectOrg',
        timestamp: '2025-06-01T10:00:00Z',
      },
    });
    expect(v1Res.statusCode).toBe(201);

    // 2. Submit version 2 with previousHash referencing v1
    const v2Res = await app.inject({
      method: 'POST',
      url: '/api/v1/changes',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        modelId: 'e2e-version-model',
        elementUniqueId: 'version-elem-1',
        changeType: 'MODIFY',
        elementHash: 'version-hash-v2',
        previousHash: 'version-hash-v1',
        userId: 'architect1',
        orgId: 'ArchitectOrg',
        timestamp: '2025-06-02T10:00:00Z',
      },
    });
    expect(v2Res.statusCode).toBe(201);

    // 3. Query audit and verify hash linkage
    const auditRes = await app.inject({
      method: 'GET',
      url: '/api/v1/audit-trail/e2e-version-model',
      headers: { authorization: `Bearer ${token}` },
    });
    const records = JSON.parse(auditRes.payload);
    expect(records.length).toBeGreaterThanOrEqual(2);

    // Find v1 and v2 records
    const v1Record = records.find((r: any) => r.elementHash === 'version-hash-v1');
    const v2Record = records.find((r: any) => r.elementHash === 'version-hash-v2');
    expect(v1Record).toBeDefined();
    expect(v2Record).toBeDefined();

    // Verify hash chain: v2's previousHash should match v1's elementHash
    expect(v2Record.previousHash).toBe(v1Record.elementHash);
    expect(v2Record.previousHash).toBe('version-hash-v1');
  });
});
