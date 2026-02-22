import { FastifyInstance } from 'fastify';
import { IFabricService } from '../services/fabric-service';

export default async function governanceRoutes(
  app: FastifyInstance,
  opts: { fabricService: IFabricService }
) {
  const { fabricService } = opts;

  app.post('/api/v1/governance/proposals', {
    preHandler: [(app as any).authenticate],
  }, async (request, reply) => {
    const body = request.body as any;
    const id = await fabricService.createProposal({
      docType: 'governance',
      proposalId: body.proposalId,
      modelId: body.modelId,
      proposerId: body.proposerId,
      proposerOrg: body.proposerOrg,
      description: body.description,
      changeHash: body.changeHash,
      status: 'PROPOSED',
      requiredOrgs: body.requiredOrgs,
      approvals: [],
      rejections: [],
      createdAt: new Date().toISOString(),
    });
    return reply.status(201).send({ proposalId: id });
  });

  app.post('/api/v1/governance/proposals/:id/approve', {
    preHandler: [(app as any).authenticate],
  }, async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    await fabricService.approveProposal(id, {
      orgMspId: body.orgMspId,
      userId: body.userId,
      timestamp: new Date().toISOString(),
      comment: body.comment,
    });
    return { status: 'ok', proposalId: id };
  });

  app.post('/api/v1/governance/proposals/:id/reject', {
    preHandler: [(app as any).authenticate],
  }, async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    await fabricService.rejectProposal(id, {
      orgMspId: body.orgMspId,
      userId: body.userId,
      timestamp: new Date().toISOString(),
      comment: body.reason,
    });
    return { status: 'ok', proposalId: id };
  });

  app.get('/api/v1/governance/pending', {
    preHandler: [(app as any).authenticate],
  }, async (request) => {
    const { org } = request.query as { org: string };
    return fabricService.queryPendingProposals(org);
  });
}
