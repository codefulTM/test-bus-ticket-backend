import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Optional JWT guard: attaches req.user when a valid JWT is present,
// but does NOT throw if the user is unauthenticated (guest booking).
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    // If there is an error or no user, just return null instead of throwing.
    // This allows endpoints to work for both guests and logged-in users.
    if (err || !user) {
      return null;
    }
    return user;
  }
}
