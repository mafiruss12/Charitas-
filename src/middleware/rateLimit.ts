import type { NextFunction, Request, Response } from 'express';

interface Bucket {
  count: number;
  resetAt: number;
}

export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  keyPrefix: string;
  message?: string;
}) {
  const store = new Map<string, Bucket>();

  return (req: Request, res: Response, next: NextFunction) => {
    const ip =
      (typeof req.headers['x-forwarded-for'] === 'string' &&
        req.headers['x-forwarded-for'].split(',')[0].trim()) ||
      req.ip ||
      'unknown';
    const key = `${options.keyPrefix}:${ip}`;
    const now = Date.now();

    let bucket = store.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + options.windowMs };
      store.set(key, bucket);
    }

    bucket.count += 1;
    const remaining = Math.max(0, options.max - bucket.count);
    res.setHeader('X-RateLimit-Limit', String(options.max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));

    if (bucket.count > options.max) {
      return res.status(429).json({
        error:
          options.message ||
          'Trop de requêtes effectuées depuis cette adresse. Veuillez patienter avant de réessayer.',
      });
    }

    // Periodic lazy eviction
    if (store.size > 5000) {
      for (const [k, b] of store.entries()) {
        if (b.resetAt <= now) store.delete(k);
      }
    }

    return next();
  };
}
