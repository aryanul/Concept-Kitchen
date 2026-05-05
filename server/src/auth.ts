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
const ACCESS_TTL = process.env.JWT_ACCESS_TTL || '15m';

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
