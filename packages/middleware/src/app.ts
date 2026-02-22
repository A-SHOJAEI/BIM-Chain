import Fastify from 'fastify';
import fjwt from '@fastify/jwt';
import fcors from '@fastify/cors';
import { config } from './config';
import { IFabricService, FabricServiceImpl, MockFabricService } from './services/fabric-service';
import authRoutes from './routes/auth';
import changesRoutes from './routes/changes';
import ipRoutes from './routes/ip';
import governanceRoutes from './routes/governance';

export function buildApp(fabricService?: IFabricService) {
  const app = Fastify({ logger: false });
  const service = fabricService || new MockFabricService();

  app.register(fcors, { origin: true });
  app.register(fjwt, { secret: config.jwtSecret });

  // Auth decorator
  app.decorate('authenticate', async (request: any, reply: any) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  app.get('/health', async () => {
    return { status: 'ok', service: 'bim-chain-middleware', version: '0.1.0' };
  });

  app.register(authRoutes);
  app.register(changesRoutes, { fabricService: service });
  app.register(ipRoutes, { fabricService: service });
  app.register(governanceRoutes, { fabricService: service });

  return app;
}

async function createFabricService(): Promise<IFabricService> {
  if (!config.fabricConnectionProfile) {
    console.log('[INFO] No FABRIC_CONNECTION_PROFILE set, using MockFabricService');
    return new MockFabricService();
  }

  const service = new FabricServiceImpl(
    process.env.FABRIC_PEER_ENDPOINT || 'localhost:7051',
    process.env.FABRIC_TLS_CERT_PATH || '',
    process.env.FABRIC_MSP_ID || 'ArchitectOrgMSP',
    process.env.FABRIC_CERT_PATH || '',
    process.env.FABRIC_KEY_PATH || '',
    config.fabricChannelName,
    config.fabricChaincodeName,
    process.env.FABRIC_PEER_HOST_ALIAS || 'peer0.architect.bimchain.com',
  );

  await service.connect();
  console.log('[INFO] Connected to Fabric network');
  return service;
}

// Only start if run directly (not imported for testing)
if (require.main === module) {
  createFabricService().then((fabricService) => {
    const app = buildApp(fabricService);
    app.listen({ port: config.port, host: config.host }, (err) => {
      if (err) {
        console.error('[ERROR] Fastify listen failed:', err);
        process.exit(1);
      }
      console.log(`[INFO] BIM-Chain middleware listening on ${config.host}:${config.port}`);
    });
  }).catch((err) => {
    console.error('[ERROR] Failed to connect to Fabric:', err.message);
    console.log('[INFO] Starting with MockFabricService...');
    const app = buildApp();
    app.listen({ port: config.port, host: config.host }, (err2) => {
      if (err2) { console.error(err2); process.exit(1); }
      console.log(`[INFO] BIM-Chain middleware (mock mode) listening on ${config.host}:${config.port}`);
    });
  });
}
