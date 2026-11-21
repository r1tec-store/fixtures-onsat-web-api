import { existsSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { config } from './config.js';
import { v1Router } from './routes/v1.js';
import type { DataStore } from './services/store.js';
import { apiKeyAuth, apiNotFound, apiRateLimit, errorHandler } from './middleware/index.js';
import { openApiSpec } from './openapi.js';
import { logger } from './utils/logger.js';

export function createApp(store: DataStore) {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(compression());
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/health' } }));

  const api = cors({ origin: config.corsOrigins.length ? config.corsOrigins : '*', methods: ['GET', 'OPTIONS'] });

  app.get('/health', (_req, res) => {
    const s = store.status();
    res.json({ status: store.hasData() ? 'ok' : 'starting', uptime_s: Math.round(process.uptime()), schedule_synced_at: s.schedule_synced_at, catalog_synced_at: s.catalog_synced_at });
  });

  const spec = openApiSpec(config.publicBaseUrl);
  app.get('/openapi.json', api, (_req, res) => res.json(spec));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec, { customSiteTitle: 'Fixtures ONSAT API' }));

  app.use('/api/v1', api, apiRateLimit, apiKeyAuth, v1Router(store));
  app.use('/api', apiNotFound);

  const dist = path.resolve(config.frontendDist);
  if (config.serveFrontend && existsSync(path.join(dist, 'index.html'))) {
    app.use(express.static(dist, { maxAge: '1h', index: false }));
    app.get(/^(?!\/(api|docs|openapi\.json|health)).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
