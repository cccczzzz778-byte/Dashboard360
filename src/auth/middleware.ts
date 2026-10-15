import type { Request, Response, NextFunction } from 'express';
import { SessionManager } from './session.js';

export function requireAuth(manager: SessionManager) {
  return (req: Request, res: Response, next: NextFunction) => {
    const cookie = req.headers.cookie ?? '';
    const token = /(?:^|;\s*)ssb360=([^;]+)/.exec(cookie)?.[1];
    const session = manager.get(token);
    if (!session) {
      if (req.path.startsWith('/api/')) return res.status(401).json({ code: 'auth_required' });
      return res.redirect('/login');
    }
    (req as any).session = session;
    next();
  };
}
