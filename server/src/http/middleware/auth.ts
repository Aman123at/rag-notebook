import { getAuth } from '@clerk/express';
import { type NextFunction, type Request, type RequestHandler, type Response } from 'express';

import { AppError } from '@/errors/AppError.js';
import { type AuthContext } from '@/http/defineRoute.js';
import { findUserByClerkId } from '@/repository/users.repo.js';
import { provisionOrGetUser } from '@/services/users.service.js';

export function requireAuth(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    if ((req as unknown as { ctxAuth?: AuthContext }).ctxAuth) {
      next();
      return;
    }
    void (async () => {
      try {
        const claim = getAuth(req);
        const clerkUserId = claim.userId;
        if (!clerkUserId) {
          throw new AppError('UNAUTHENTICATED', 'Authentication is required for this route.', {
            exposeDetails: false,
          });
        }

        let user = await findUserByClerkId(clerkUserId);
        if (!user) {
          const { clerkClient } = await import('@clerk/express');
          const remote = await clerkClient.users.getUser(clerkUserId);
          const primary =
            remote.emailAddresses.find((e) => e.id === remote.primaryEmailAddressId) ??
            remote.emailAddresses[0];
          const email = primary?.emailAddress ?? null;
          if (!email) {
            throw new AppError(
              'UNAUTHENTICATED',
              'Authenticated user has no email; cannot provision.',
              { exposeDetails: false },
            );
          }
          const displayName =
            [remote.firstName, remote.lastName].filter((s): s is string => !!s).join(' ') ||
            remote.username ||
            null;
          user = await provisionOrGetUser({
            clerkUserId,
            email,
            displayName,
            signUpType: remote.externalAccounts[0]?.provider ?? null,
          });
        }

        if (user.isBlocked) {
          throw new AppError('USER_BLOCKED', 'User is blocked.', { exposeDetails: false });
        }

        const auth: AuthContext = {
          userId: user.id,
          clerkUserId: user.clerkUserId,
          planTier: user.planTier,
          isBlocked: user.isBlocked,
        };
        (req as unknown as { ctxAuth: AuthContext }).ctxAuth = auth;
        next();
      } catch (err) {
        next(err);
      }
    })();
  };
}
