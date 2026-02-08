import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        // It depends on auth.guard, which retrieves the role from jtw and injects it into the request.
        const user = request.user;

        if (!user || !user.isAdmin) {
            throw new ForbiddenException('Admin privileges required');
        }

        return true;
    }
}