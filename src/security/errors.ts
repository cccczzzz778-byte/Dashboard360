import crypto from 'node:crypto';
import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';

export function requestContext(req: Request, res: Response, next: NextFunction) {
  const requestId = crypto.randomUUID();
  (req as any).requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}

export function apiNotFound(req: Request, res: Response) {
  res.status(404).json({ code: 'not_found', requestId: (req as any).requestId });
}

export const safeErrorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const requestId = (req as any).requestId ?? crypto.randomUUID();
  const code = typeof (error as any)?.code === 'string' ? String((error as any).code).slice(0, 80) : 'internal_error';
  console.error(JSON.stringify({
    type: 'request_error',
    requestId,
    method: req.method,
    path: req.path.slice(0, 300),
    code
  }));

  if (res.headersSent) return;
  if (req.path.startsWith('/api/')) {
    res.status(500).json({ code: 'internal_error', requestId });
    return;
  }
  res.status(500).type('html').send(`<!doctype html><html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Xatolik</title></head><body><main><h1>So‘rovni bajarib bo‘lmadi</h1><p>Hodisa ID: ${requestId}</p></main></body></html>`);
};
