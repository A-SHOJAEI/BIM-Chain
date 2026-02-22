import { FastifyInstance } from 'fastify';
import { config } from '../config';

// Development-only user store. In production, replace with Fabric CA enrollment
// or an external identity provider. These defaults are overridden by the
// USERS_JSON environment variable (JSON string of Record<string, {password, orgId}>).
const users: Record<string, { password: string; orgId: string }> = process.env.USERS_JSON
  ? JSON.parse(process.env.USERS_JSON)
  : {
      admin: { password: 'adminpw', orgId: 'Org1MSP' },
      user1: { password: 'user1pw', orgId: 'Org1MSP' },
      user2: { password: 'user2pw', orgId: 'Org2MSP' },
    };

export default async function authRoutes(app: FastifyInstance) {
  app.post('/api/v1/auth/login', async (request, reply) => {
    const { username, password } = request.body as { username: string; password: string };
    const user = users[username];
    if (!user || user.password !== password) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }
    const token = app.jwt.sign(
      { username, orgId: user.orgId },
      { expiresIn: config.jwtExpiry }
    );
    return { token, username, orgId: user.orgId };
  });

  app.post('/api/v1/auth/refresh', {
    preHandler: [(app as any).authenticate],
  }, async (request) => {
    const user = (request as any).user;
    const token = app.jwt.sign(
      { username: user.username, orgId: user.orgId },
      { expiresIn: config.jwtExpiry }
    );
    return { token };
  });
}
