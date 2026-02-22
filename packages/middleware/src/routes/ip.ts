import { FastifyInstance } from 'fastify';
import { IFabricService } from '../services/fabric-service';

export default async function ipRoutes(
  app: FastifyInstance,
  opts: { fabricService: IFabricService }
) {
  const { fabricService } = opts;

  app.get('/api/v1/ip-attribution/:elementId', {
    preHandler: [(app as any).authenticate],
  }, async (request, reply) => {
    const { elementId } = request.params as { elementId: string };
    const record = await fabricService.queryIPByElement(elementId);
    if (!record) {
      return reply.status(404).send({ error: 'Element not found' });
    }
    return record;
  });

  app.get('/api/v1/ip-attribution', {
    preHandler: [(app as any).authenticate],
  }, async (request) => {
    const { org } = request.query as { org?: string };
    if (org) {
      return fabricService.queryIPByOrg(org);
    }
    return [];
  });

  app.post('/api/v1/ip-attribution/register', {
    preHandler: [(app as any).authenticate],
  }, async (request, reply) => {
    const body = request.body as any;
    const id = await fabricService.registerIPElement({
      docType: 'ip',
      elementUniqueId: body.elementUniqueId,
      creatorUserId: body.creatorUserId,
      creatorOrgMspId: body.creatorOrgMspId,
      creationTimestamp: body.creationTimestamp || new Date().toISOString(),
      familyName: body.familyName,
      contributions: [],
    });
    return reply.status(201).send({ elementId: id });
  });

  app.post('/api/v1/ip-attribution/contribute', {
    preHandler: [(app as any).authenticate],
  }, async (request, reply) => {
    const body = request.body as any;
    await fabricService.addIPContribution(body.elementId, {
      userId: body.userId,
      orgMspId: body.orgMspId,
      timestamp: body.timestamp || new Date().toISOString(),
      changeHash: body.changeHash,
      description: body.description,
    });
    return reply.status(201).send({ status: 'ok' });
  });
}
