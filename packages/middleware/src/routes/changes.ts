import { FastifyInstance } from 'fastify';
import { IFabricService } from '../services/fabric-service';
import { changeRecordSchema } from '../middleware/validation';

export default async function changesRoutes(
  app: FastifyInstance,
  opts: { fabricService: IFabricService }
) {
  const { fabricService } = opts;

  app.post('/api/v1/changes', {
    preHandler: [(app as any).authenticate],
    schema: {
      body: {
        oneOf: [
          changeRecordSchema,
          { type: 'array' as const, items: changeRecordSchema },
        ],
      },
    },
  }, async (request, reply) => {
    const body = request.body as any;
    const records = Array.isArray(body) ? body : [body];
    const txIds: string[] = [];

    for (const record of records) {
      const txId = await fabricService.submitAuditRecord({
        docType: 'audit',
        modelId: record.modelId,
        elementUniqueId: record.elementUniqueId,
        changeType: record.changeType,
        elementHash: record.elementHash,
        previousHash: record.previousHash,
        userId: record.userId,
        orgMspId: record.orgMspId || record.orgId,
        timestamp: record.timestamp || new Date().toISOString(),
        parameterChanges: record.parameterChanges,
      });
      txIds.push(txId);
    }

    return reply.status(201).send({ txIds });
  });

  app.get('/api/v1/audit-trail/:modelId', {
    preHandler: [(app as any).authenticate],
  }, async (request) => {
    const { modelId } = request.params as { modelId: string };
    const query = request.query as { startTime?: string; endTime?: string };

    if (query.startTime && query.endTime) {
      return fabricService.queryAuditByTimeRange(modelId, query.startTime, query.endTime);
    }

    return fabricService.queryAuditTrail(modelId);
  });

  // Debug endpoint: list all unique model IDs (mock mode only)
  app.get('/api/v1/debug/models', async () => {
    if ('getAllModelIds' in fabricService) {
      return (fabricService as any).getAllModelIds();
    }
    return { error: 'Only available in mock mode' };
  });

  // Debug endpoint: get all audit records (mock mode only)
  app.get('/api/v1/debug/records', async () => {
    if ('getAllAuditRecords' in fabricService) {
      return (fabricService as any).getAllAuditRecords();
    }
    return { error: 'Only available in mock mode' };
  });
}
