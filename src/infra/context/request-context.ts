import { Logger, UnauthorizedException } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

/**
 * Interface representing the structure of the user data 
 * stored in the asynchronous local storage.
 */
export interface UserContext {
    userId: string;
    isAdmin: boolean;
}

export class RequestContext {
    private static readonly logger = new Logger(RequestContext.name);
    private static storage = new AsyncLocalStorage<UserContext>();

    /**
     * Initializes the storage for the current asynchronous execution context.
     * @param context The user data to store.
     * @param next The callback function (usually the next middleware/handler).
     */
    static set(context: UserContext, next: () => void) {
        this.logger.debug('Executing context set', context);
        this.storage.run(context, next);
    }

    /**
     * Retrieves the current user context if available.
     * @returns UserContext or undefined if called outside of a request flow.
     */
    static get(): UserContext | undefined {
        return this.storage.getStore();
    }

    /**
     * Shorthand getter for the userId.
     */
    static get userId(): string | undefined {
        return this.get()?.userId;
    }

    /**
     * Returns the userId or throws an exception if the context is missing.
     * Useful for protected logic that requires an authenticated user.
     * @throws UnauthorizedException
     */
    static getRequiredUserId(): string {
        const id = this.userId;
        if (!id) {
            // Ensure security by preventing unauthorized access to the logic
            throw new UnauthorizedException('User context is missing or invalid');
        }
        return id;
    }
}