import type { AuthClaims } from './domain.js';

declare global {
  namespace Express {
    interface Request {
      auth?: AuthClaims;
    }
  }
}

export {};
