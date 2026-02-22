const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

let cachedToken: string | null = null;

/**
 * Get a JWT token for API access. Caches the token for reuse.
 * Auto-logs in with default dev credentials.
 */
async function getAuthToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'adminpw' }),
  });
  if (!res.ok) throw new Error('Auto-login failed');
  const data = await res.json();
  cachedToken = data.token;
  return data.token;
}

function authHeaders(token: string): Record<string, string> {
  return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export interface AuditRecord {
  docType: string;
  modelId: string;
  elementUniqueId: string;
  changeType: 'ADD' | 'MODIFY' | 'DELETE';
  elementHash: string;
  userId: string;
  orgMspId: string;
  timestamp: string;
  txId?: string;
}

export interface IPRecord {
  elementUniqueId: string;
  creatorUserId: string;
  creatorOrgMspId: string;
  creationTimestamp: string;
  familyName?: string;
  contributions: { userId: string; orgMspId: string; timestamp: string }[];
}

export interface GovernanceProposal {
  proposalId: string;
  modelId: string;
  description: string;
  status: 'PROPOSED' | 'APPROVED' | 'REJECTED';
  requiredOrgs: string[];
  approvals: { orgMspId: string; userId: string }[];
  rejections: { orgMspId: string; userId: string }[];
}

export async function getAuditTrail(modelId: string): Promise<AuditRecord[]> {
  const token = await getAuthToken();
  const res = await fetch(`${API_BASE}/api/v1/audit-trail/${encodeURIComponent(modelId)}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to fetch audit trail');
  return res.json();
}

export async function getIPAttribution(elementId: string): Promise<IPRecord> {
  const token = await getAuthToken();
  const res = await fetch(`${API_BASE}/api/v1/ip-attribution/${encodeURIComponent(elementId)}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to fetch IP attribution');
  return res.json();
}

export async function getPendingProposals(orgId: string): Promise<GovernanceProposal[]> {
  const token = await getAuthToken();
  const res = await fetch(`${API_BASE}/api/v1/governance/pending?org=${orgId}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to fetch proposals');
  return res.json();
}

export async function approveProposal(proposalId: string, comment: string): Promise<void> {
  const token = await getAuthToken();
  const res = await fetch(`${API_BASE}/api/v1/governance/proposals/${proposalId}/approve`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ comment }),
  });
  if (!res.ok) throw new Error('Failed to approve proposal');
}

export async function rejectProposal(proposalId: string, reason: string): Promise<void> {
  const token = await getAuthToken();
  const res = await fetch(`${API_BASE}/api/v1/governance/proposals/${proposalId}/reject`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw new Error('Failed to reject proposal');
}
