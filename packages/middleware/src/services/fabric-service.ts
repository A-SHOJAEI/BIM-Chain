export interface AuditRecord {
  docType: string;
  modelId: string;
  elementUniqueId: string;
  changeType: 'ADD' | 'MODIFY' | 'DELETE';
  elementHash: string;
  previousHash?: string;
  userId: string;
  orgMspId: string;
  timestamp: string;
  txId?: string;
  worksharingAction?: string;
  parameterChanges?: { name: string; oldValue: string; newValue: string }[];
}

export interface IPRecord {
  docType: string;
  elementUniqueId: string;
  creatorUserId: string;
  creatorOrgMspId: string;
  creationTimestamp: string;
  familyName?: string;
  categoryName?: string;
  contributions: Contribution[];
  licenseType?: string;
  restrictions?: string[];
}

export interface Contribution {
  userId: string;
  orgMspId: string;
  timestamp: string;
  changeHash: string;
  description?: string;
}

export interface GovernanceProposal {
  docType: string;
  proposalId: string;
  modelId: string;
  elementId?: string;
  proposerId: string;
  proposerOrg: string;
  description: string;
  changeHash: string;
  status: 'PROPOSED' | 'APPROVED' | 'REJECTED';
  requiredOrgs: string[];
  approvals: Approval[];
  rejections: Approval[];
  createdAt: string;
  resolvedAt?: string;
}

export interface Approval {
  orgMspId: string;
  userId: string;
  timestamp: string;
  comment?: string;
}

export interface IFabricService {
  submitAuditRecord(record: AuditRecord): Promise<string>;
  queryAuditTrail(modelId: string): Promise<AuditRecord[]>;
  queryAuditByElement(elementId: string): Promise<AuditRecord[]>;
  queryAuditByTimeRange(modelId: string, start: string, end: string): Promise<AuditRecord[]>;
  registerIPElement(record: IPRecord): Promise<string>;
  queryIPByElement(elementId: string): Promise<IPRecord | null>;
  queryIPByOrg(orgId: string): Promise<IPRecord[]>;
  addIPContribution(elementId: string, contribution: Contribution): Promise<string>;
  createProposal(proposal: GovernanceProposal): Promise<string>;
  approveProposal(proposalId: string, approval: Approval): Promise<string>;
  rejectProposal(proposalId: string, rejection: Approval): Promise<string>;
  queryPendingProposals(orgId: string): Promise<GovernanceProposal[]>;
}

export class FabricServiceImpl implements IFabricService {
  private contract: any;
  private gateway: any;
  private client: any;

  constructor(
    private peerEndpoint: string,
    private tlsCertPath: string,
    private mspId: string,
    private certPath: string,
    private keyPath: string,
    private channelName: string,
    private chaincodeName: string,
    private peerHostAlias: string,
  ) {}

  async connect(): Promise<void> {
    const grpc = await import('@grpc/grpc-js');
    const { connect, signers } = await import('@hyperledger/fabric-gateway');
    const fs = await import('fs');
    const crypto = await import('crypto');
    const path = await import('path');

    const tlsCert = fs.readFileSync(path.resolve(this.tlsCertPath));
    const tlsCredentials = grpc.credentials.createSsl(tlsCert);
    this.client = new grpc.Client(this.peerEndpoint, tlsCredentials, {
      'grpc.ssl_target_name_override': this.peerHostAlias,
    });

    const certPem = fs.readFileSync(path.resolve(this.certPath));
    const keyPem = fs.readFileSync(path.resolve(this.keyPath));
    const privateKey = crypto.createPrivateKey(keyPem);

    this.gateway = connect({
      client: this.client,
      identity: { mspId: this.mspId, credentials: certPem },
      signer: signers.newPrivateKeySigner(privateKey),
      evaluateOptions: () => ({ deadline: Date.now() + 5000 }),
      endorseOptions: () => ({ deadline: Date.now() + 15000 }),
      submitOptions: () => ({ deadline: Date.now() + 5000 }),
      commitStatusOptions: () => ({ deadline: Date.now() + 60000 }),
    });

    const network = this.gateway.getNetwork(this.channelName);
    this.contract = network.getContract(this.chaincodeName);
  }

  disconnect(): void {
    if (this.gateway) this.gateway.close();
    if (this.client) this.client.close();
  }

  private async submitTx(fn: string, ...args: string[]): Promise<string> {
    const result = await this.contract.submitTransaction(fn, ...args);
    return new TextDecoder().decode(result) || 'ok';
  }

  private async evaluateTx(fn: string, ...args: string[]): Promise<string> {
    const result = await this.contract.evaluateTransaction(fn, ...args);
    return new TextDecoder().decode(result);
  }

  async submitAuditRecord(record: AuditRecord): Promise<string> {
    return this.submitTx('AuditContract:RecordChange', JSON.stringify(record));
  }

  async queryAuditTrail(modelId: string): Promise<AuditRecord[]> {
    const result = await this.evaluateTx('AuditContract:QueryByModel', modelId);
    return result ? JSON.parse(result) : [];
  }

  async queryAuditByElement(elementId: string): Promise<AuditRecord[]> {
    const result = await this.evaluateTx('AuditContract:QueryByElement', elementId);
    return result ? JSON.parse(result) : [];
  }

  async queryAuditByTimeRange(modelId: string, start: string, end: string): Promise<AuditRecord[]> {
    const result = await this.evaluateTx('AuditContract:QueryByTimeRange', modelId, start, end);
    return result ? JSON.parse(result) : [];
  }

  async registerIPElement(record: IPRecord): Promise<string> {
    return this.submitTx('IPAssetContract:RegisterElement', JSON.stringify(record));
  }

  async queryIPByElement(elementId: string): Promise<IPRecord | null> {
    try {
      const result = await this.evaluateTx('IPAssetContract:GetContributionSummary', elementId);
      if (!result) return null;
      // GetContributionSummary returns data if the element exists, meaning it's registered
      // Query the element through QueryByCreator or QueryByOrg to get full record
      // For now, return a minimal record indicating it exists
      return { docType: 'ip', elementUniqueId: elementId, contributions: [] } as unknown as IPRecord;
    } catch {
      return null;
    }
  }

  async queryIPByOrg(orgId: string): Promise<IPRecord[]> {
    const result = await this.evaluateTx('IPAssetContract:QueryByOrg', orgId);
    return result ? JSON.parse(result) : [];
  }

  async addIPContribution(elementId: string, contribution: Contribution): Promise<string> {
    return this.submitTx('IPAssetContract:RecordContribution', elementId, JSON.stringify(contribution));
  }

  async createProposal(proposal: GovernanceProposal): Promise<string> {
    return this.submitTx('GovernanceContract:ProposeChange', JSON.stringify(proposal));
  }

  async approveProposal(proposalId: string, approval: Approval): Promise<string> {
    return this.submitTx('GovernanceContract:ApproveChange', proposalId, approval.comment || '');
  }

  async rejectProposal(proposalId: string, rejection: Approval): Promise<string> {
    return this.submitTx('GovernanceContract:RejectChange', proposalId, rejection.comment || '');
  }

  async queryPendingProposals(orgId: string): Promise<GovernanceProposal[]> {
    const result = await this.evaluateTx('GovernanceContract:QueryPending', orgId);
    return result ? JSON.parse(result) : [];
  }
}

export class MockFabricService implements IFabricService {
  private auditRecords: AuditRecord[] = [];
  private ipRecords: Map<string, IPRecord> = new Map();
  private proposals: Map<string, GovernanceProposal> = new Map();

  async submitAuditRecord(record: AuditRecord): Promise<string> {
    const txId = `tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.auditRecords.push({ ...record, txId });
    return txId;
  }

  async queryAuditTrail(modelId: string): Promise<AuditRecord[]> {
    return this.auditRecords.filter(r => r.modelId === modelId);
  }

  async queryAuditByElement(elementId: string): Promise<AuditRecord[]> {
    return this.auditRecords.filter(r => r.elementUniqueId === elementId);
  }

  async queryAuditByTimeRange(modelId: string, start: string, end: string): Promise<AuditRecord[]> {
    return this.auditRecords.filter(
      r => r.modelId === modelId && r.timestamp >= start && r.timestamp <= end
    );
  }

  async registerIPElement(record: IPRecord): Promise<string> {
    if (this.ipRecords.has(record.elementUniqueId)) {
      throw new Error(`Element ${record.elementUniqueId} already registered`);
    }
    this.ipRecords.set(record.elementUniqueId, record);
    return record.elementUniqueId;
  }

  async queryIPByElement(elementId: string): Promise<IPRecord | null> {
    return this.ipRecords.get(elementId) || null;
  }

  async queryIPByOrg(orgId: string): Promise<IPRecord[]> {
    return Array.from(this.ipRecords.values()).filter(r => r.creatorOrgMspId === orgId);
  }

  async addIPContribution(elementId: string, contribution: Contribution): Promise<string> {
    const record = this.ipRecords.get(elementId);
    if (!record) throw new Error(`Element ${elementId} not found`);
    record.contributions.push(contribution);
    return elementId;
  }

  async createProposal(proposal: GovernanceProposal): Promise<string> {
    this.proposals.set(proposal.proposalId, { ...proposal, status: 'PROPOSED' });
    return proposal.proposalId;
  }

  async approveProposal(proposalId: string, approval: Approval): Promise<string> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error(`Proposal ${proposalId} not found`);
    proposal.approvals.push(approval);
    const approvedOrgs = new Set(proposal.approvals.map(a => a.orgMspId));
    if (proposal.requiredOrgs.every(org => approvedOrgs.has(org))) {
      proposal.status = 'APPROVED';
    }
    return proposalId;
  }

  async rejectProposal(proposalId: string, rejection: Approval): Promise<string> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error(`Proposal ${proposalId} not found`);
    proposal.rejections.push(rejection);
    proposal.status = 'REJECTED';
    return proposalId;
  }

  async queryPendingProposals(orgId: string): Promise<GovernanceProposal[]> {
    return Array.from(this.proposals.values()).filter(
      p => p.status === 'PROPOSED' && p.requiredOrgs.includes(orgId)
    );
  }

  /** Debug: return all unique model IDs and record counts. */
  getAllModelIds(): { modelId: string; count: number }[] {
    const counts = new Map<string, number>();
    for (const r of this.auditRecords) {
      counts.set(r.modelId, (counts.get(r.modelId) || 0) + 1);
    }
    return Array.from(counts.entries()).map(([modelId, count]) => ({ modelId, count }));
  }

  /** Debug: return all audit records (no filter). */
  getAllAuditRecords(): AuditRecord[] {
    return this.auditRecords;
  }
}
