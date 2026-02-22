import { MockFabricService, AuditRecord } from '../src/services/fabric-service';

describe('MockFabricService', () => {
  let service: MockFabricService;

  beforeEach(() => {
    service = new MockFabricService();
  });

  it('submitTransaction stores and returns txId', async () => {
    const record: AuditRecord = {
      docType: 'audit',
      modelId: 'model-1',
      elementUniqueId: 'elem-1',
      changeType: 'ADD',
      elementHash: 'hash-1',
      userId: 'user1',
      orgMspId: 'Org1MSP',
      timestamp: '2025-01-15T10:00:00Z',
    };
    const txId = await service.submitAuditRecord(record);
    expect(txId).toBeDefined();
    expect(typeof txId).toBe('string');
  });

  it('evaluateTransaction retrieves stored records', async () => {
    await service.submitAuditRecord({
      docType: 'audit',
      modelId: 'model-1',
      elementUniqueId: 'elem-1',
      changeType: 'ADD',
      elementHash: 'hash-1',
      userId: 'user1',
      orgMspId: 'Org1MSP',
      timestamp: '2025-01-15T10:00:00Z',
    });

    const records = await service.queryAuditTrail('model-1');
    expect(records.length).toBe(1);
    expect(records[0].modelId).toBe('model-1');
  });

  it('queryIPByElement returns null for missing element', async () => {
    const result = await service.queryIPByElement('nonexistent');
    expect(result).toBeNull();
  });

  it('serializes and deserializes records correctly', async () => {
    const record: AuditRecord = {
      docType: 'audit',
      modelId: 'model-serialize',
      elementUniqueId: 'elem-ser',
      changeType: 'MODIFY',
      elementHash: 'hash-ser',
      previousHash: 'hash-prev',
      userId: 'user1',
      orgMspId: 'Org1MSP',
      timestamp: '2025-01-15T10:00:00Z',
      parameterChanges: [{ name: 'Height', oldValue: '3000', newValue: '3500' }],
    };
    await service.submitAuditRecord(record);
    const results = await service.queryAuditTrail('model-serialize');
    expect(results[0].changeType).toBe('MODIFY');
    expect(results[0].parameterChanges![0].name).toBe('Height');
  });
});
