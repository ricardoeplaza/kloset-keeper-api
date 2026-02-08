import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { RequestContext } from '../context/request-context';

/**
 * Interceptor responsible for binding the authenticated user context 
 * to the AsyncLocalStorage through RequestContext.
 */
@Injectable()
export class ContextInterceptor implements NestInterceptor {

    /**
     * Intercepts the request to extract user data and initialize the local storage.
     * @param context Provides details about the current request execution.
     * @param next Provides access to the next handler in the chain.
     */
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        // Switch context to HTTP to access the underlying request object
        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (user) {
            /**
             * If the user is present (authenticated), we wrap the execution 
             * of the next handlers within the RequestContext.storage.run method.
             */
            return new Observable((subscriber) => {
                // Initialize the context with data from the request (e.g., JWT payload)
                RequestContext.set({ userId: user.sub, isAdmin: user.isAdmin }, () => {
                    /**
                     * By calling handle().subscribe(subscriber) inside the callback,
                     * we ensure the entire asynchronous flow stays within the context.
                     */
                    next.handle().subscribe(subscriber);
                });
            });
        }

        // If no user is found (e.g., public routes), proceed without context initialization
        return next.handle();
    }
}