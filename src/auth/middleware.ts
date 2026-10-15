import type { Request, Response, NextFunction } from 'express';
import type { SessionRole } from './session.js';

export type SessionBackend = {
  get(token: string | undefined): unknown | Promise<unknown>;
  verifyCsrf(token: string | undefined, candidate: string | undefined): boolean | Promise<boolean>;
};

export function sessionCookieName() {
  return process.env.NODE_ENV === 'production' ? '__Host-ssb360' : 'ssb360';
}

export function readSessionToken(cookieHeader = '') {
  const names = [sessionCookieName(), 'ssb360'];
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const token = new RegExp(`(?:^|;\\s*)${escaped}=([^;]+)`).exec(cookieHeader)?.[1];
    if (token) return token;
  }
  return undefined;
}

export function requireAuth(manager: SessionBackend) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = readSessionToken(req.headers.cookie ?? '');
    const session = await manager.get(token) as any;
    if (!session) {
      if (req.path.startsWith('/api/')) return res.status(401).json({ code: 'auth_required' });
      return res.redirect('/login');
    }
    (req as any).session = session;
    (req as any).sessionToken = token;
    next();
  };
}

export function requireRole(role: SessionRole) {
  return (req: Request, res: Response, next: NextFunction) => {
    const session = (req as any).session;
    const compatibleAdmin = role === 'admin' && session?.role === 'super_admin';
    if (!session || (session.role !== role && !compatibleAdmin)) return res.status(403).json({ code: 'forbidden' });
    next();
  };
}

export function requireCsrf(manager: SessionBackend) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = (req as any).sessionToken as string | undefined;
    const csrf = req.get('x-csrf-token') ?? undefined;
    if (!(await manager.verifyCsrf(token, csrf))) return res.status(403).json({ code: 'csrf_invalid' });
    next();
  };
}
