import { pino } from 'pino';
import { config } from '../config.js';

export const logger = pino({
  level: config.env === 'test' ? 'silent' : config.logLevel,
  ...(config.env === 'development' ? { transport: { target: 'pino-pretty' } } : {}),
});
