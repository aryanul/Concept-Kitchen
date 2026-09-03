import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

export type Role = 'HR_ADMIN' | 'MANAGER' | 'EMPLOYEE' | 'FINANCE';

export type AuthedUser = {
  id: string;
  role: Role;
  employeeId: string | null;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthedUser;
    }
  }
}

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;

/**
 * The session is an *inactivity* window, not a hard clock. The token lives for
 * SESSION_IDLE_MINUTES and the client slides it forward via POST /auth/refresh
 * while the user is interacting, so an active user is never signed out and an
 * idle one is signed out on the dot.
 */
export const SESSION_IDLE_MINUTES = Math.max(
  5,
  Number(process.env.SESSION_IDLE_MINUTES) || 30
);
// Deliberately NOT read from JWT_ACCESS_TTL any more: that knob was a fixed
// 15m wall clock, which signed people out mid-typing. SESSION_IDLE_MINUTES is
// now the single source of truth for how long a session survives.
const ACCESS_TTL = `${SESSION_IDLE_MINUTES}m`;

if (!ACCESS_SECRET) {
  throw new Error('JWT_ACCESS_SECRET is not set; refusing to start.');
}

export function signAccessToken(user: AuthedUser): string {
  return jwt.sign(
    { sub: user.id, role: user.role, employeeId: user.employeeId },
    ACCESS_SECRET as string,
    { expiresIn: ACCESS_TTL as jwt.SignOptions['expiresIn'] }
  );
}

/**
 * Decode the bearer token without rejecting the request.
 *
 * The permission guard runs before any route, so `authRequired` has not
 * populated `req.user` yet. It needs to know who is calling, but a missing or
 * bad token is not its problem to answer — the route's own `authRequired`
 * returns 401 for that, which keeps "not signed in" and "not allowed" distinct.
 */
export function readUserFromToken(req: Request): AuthedUser | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(header.slice('Bearer '.length).trim(), ACCESS_SECRET as string) as jwt.JwtPayload;
    return {
      id: payload.sub as string,
      role: payload.role as Role,
      employeeId: (payload.employeeId as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

export function authRequired(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing bearer token' } });
    return;
  }
  const token = header.slice('Bearer '.length).trim();
  try {
    const payload = jwt.verify(token, ACCESS_SECRET as string) as jwt.JwtPayload;
    req.user = {
      id: payload.sub as string,
      role: payload.role as Role,
      employeeId: (payload.employeeId as string | null) ?? null,
    };
    next();
  } catch {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } });
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Auth required' } });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient role' } });
      return;
    }
    next();
  };
}
