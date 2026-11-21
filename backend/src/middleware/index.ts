import type { ErrorRequestHandler, RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { config } from '../config.js';
import { ApiError } from '../utils/query.js';
import { logger } from '../utils/logger.js';

const errorBody = (status: number, code: string, message: string, details?: unknown) => ({
  success: false,
  error: { status, code, message, ...(details !== undefined ? { details } : {}) },
});

/** Optional API-key gate: only active when API_KEYS is configured. */
export const apiKeyAuth: RequestHandler = (req, res, next) => {
  if (config.apiKeys.length === 0) return next();
  const key = req.get('x-api-key') ?? (typeof req.query.api_key === 'string' ? req.query.api_key : undefined);
  if (key && config.apiKeys.includes(key)) return next();
  res.status(401).json(errorBody(401, 'UNAUTHORIZED', 'Missing or invalid API key (send X-API-Key header)'));
};

export const apiRateLimit = rateLimit({
  windowMs: 60_000,
  limit: config.rateLimitPerMin,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json(errorBody(429, 'RATE_LIMITED', `Too many requests; limit is ${config.rateLimitPerMin}/minute`));
  },
});

export const apiNotFound: RequestHandler = (req, res) => {
  res.status(404).json(errorBody(404, 'NOT_FOUND', `No route for ${req.method} ${req.originalUrl}`));
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ApiError) {
    res.status(err.status).json(errorBody(err.status, err.code, err.message, err.details));
    return;
  }
  logger.error({ err, url: req.originalUrl }, 'unhandled error');
  res.status(500).json(errorBody(500, 'INTERNAL_ERROR', 'Unexpected server error'));
};
