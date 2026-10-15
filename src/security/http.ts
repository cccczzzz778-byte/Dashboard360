import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

function dynamicResponse(path: string) {
  return path === '/' || path === '/login' || path === '/situation-center' || path.startsWith('/api/');
}

function approvedSituationMapOrigins() {
  const raw = String(process.env.SITUATION_MAP_STYLE_ALLOWED_HOSTS ?? '');
  const origins: string[] = [];
  for (const item of raw.split(',')) {
    const host = item.trim().toLowerCase();
    if (!host || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*$/.test(host)) continue;
    origins.push(`https://${host}`);
  }
  return Array.from(new Set(origins));
}

export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  const mapOrigins = approvedSituationMapOrigins();
  const connectSrc = "connect-src 'self' https://tile.openstreetmap.org https://*.tile.openstreetmap.org" + (mapOrigins.length ? ` ${mapOrigins.join(' ')}` : '');
  res.setHeader(
    'Content-Security-Policy',
    `default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data: https://tile.openstreetmap.org https://*.tile.openstreetmap.org; ${connectSrc}; worker-src 'self'; font-src 'self' data:; frame-src 'none'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'`
  );
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  if (dynamicResponse(req.path)) {
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('Pragma', 'no-cache');
  }
  next();
}

export function sameOriginGuard(req: Request, res: Response, next: NextFunction) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  const fetchSite = req.get('sec-fetch-site');
  if (fetchSite === 'cross-site') return res.status(403).json({ code: 'cross_site_blocked' });

  const origin = req.get('origin');
  if (!origin) return next();
  const proto = (req.get('x-forwarded-proto') || req.protocol || 'https').split(',')[0].trim();
  const host = (req.get('x-forwarded-host') || req.get('host') || '').split(',')[0].trim();
  if (!host) return res.status(403).json({ code: 'origin_invalid' });

  try {
    const supplied = new URL(origin);
    const expected = new URL(`${proto}://${host}`);
    if (supplied.origin !== expected.origin) return res.status(403).json({ code: 'origin_invalid' });
  } catch {
    return res.status(403).json({ code: 'origin_invalid' });
  }
  next();
}

export function requestFingerprint(req: Request) {
  const raw = req.ip || req.socket.remoteAddress || 'unknown';
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);
}
