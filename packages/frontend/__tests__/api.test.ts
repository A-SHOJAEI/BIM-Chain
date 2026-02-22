import { getAuditTrail, getIPAttribution, getPendingProposals, approveProposal, rejectProposal } from '../lib/api';

global.fetch = jest.fn();

const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Helper: mock a successful login followed by the real response
function mockLoginThen(response: Partial<Response>) {
  // First call = login
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ token: 'test-jwt-token', username: 'admin', orgId: 'Org1MSP' }),
  } as Response);
  // Second call = actual API call
  mockFetch.mockResolvedValueOnce(response as Response);
}

beforeEach(() => {
  mockFetch.mockClear();
  // Reset the cached token between tests by re-importing won't work,
  // so we ensure each test triggers a fresh login by clearing all mocks
});

// We need to reset the module between tests to clear the cached token
beforeEach(() => {
  jest.resetModules();
});

describe('API client', () => {
  // Re-import for each test to reset cached token
  let api: typeof import('../lib/api');

  beforeEach(async () => {
    jest.resetModules();
    mockFetch.mockClear();
    api = await import('../lib/api');
  });

  it('getAuditTrail calls login then correct endpoint', async () => {
    mockLoginThen({
      ok: true,
      json: async () => [{ modelId: 'model-1' }],
    });
    const result = await api.getAuditTrail('model-1');
    expect(mockFetch).toHaveBeenCalledTimes(2);
    // Second call is the audit trail request
    expect(mockFetch).toHaveBeenNthCalledWith(2,
      'http://localhost:3001/api/v1/audit-trail/model-1',  // encodeURIComponent('model-1') === 'model-1'
      expect.objectContaining({
        headers: expect.objectContaining({ 'Authorization': 'Bearer test-jwt-token' }),
      })
    );
    expect(result).toEqual([{ modelId: 'model-1' }]);
  });

  it('getAuditTrail throws on error', async () => {
    mockLoginThen({ ok: false });
    await expect(api.getAuditTrail('model-1')).rejects.toThrow('Failed to fetch audit trail');
  });

  it('getIPAttribution calls correct endpoint', async () => {
    mockLoginThen({
      ok: true,
      json: async () => ({ elementUniqueId: 'elem-1' }),
    });
    const result = await api.getIPAttribution('elem-1');
    expect(mockFetch).toHaveBeenNthCalledWith(2,
      'http://localhost:3001/api/v1/ip-attribution/elem-1',  // encodeURIComponent('elem-1') === 'elem-1'
      expect.objectContaining({
        headers: expect.objectContaining({ 'Authorization': 'Bearer test-jwt-token' }),
      })
    );
    expect(result).toEqual({ elementUniqueId: 'elem-1' });
  });

  it('getPendingProposals calls correct endpoint', async () => {
    mockLoginThen({
      ok: true,
      json: async () => [],
    });
    const result = await api.getPendingProposals('Org1');
    expect(mockFetch).toHaveBeenNthCalledWith(2,
      'http://localhost:3001/api/v1/governance/pending?org=Org1',
      expect.objectContaining({
        headers: expect.objectContaining({ 'Authorization': 'Bearer test-jwt-token' }),
      })
    );
    expect(result).toEqual([]);
  });

  it('approveProposal sends POST request with auth', async () => {
    mockLoginThen({ ok: true });
    await api.approveProposal('prop-1', 'looks good');
    expect(mockFetch).toHaveBeenNthCalledWith(2,
      'http://localhost:3001/api/v1/governance/proposals/prop-1/approve',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Authorization': 'Bearer test-jwt-token' }),
      })
    );
  });

  it('rejectProposal sends POST request with auth', async () => {
    mockLoginThen({ ok: true });
    await api.rejectProposal('prop-1', 'not ready');
    expect(mockFetch).toHaveBeenNthCalledWith(2,
      'http://localhost:3001/api/v1/governance/proposals/prop-1/reject',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Authorization': 'Bearer test-jwt-token' }),
      })
    );
  });
});
