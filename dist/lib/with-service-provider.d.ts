import type { Middleware } from 'fetch-router-extra';
import type { ServiceProvider } from './service-provider.ts';
/**
 * Top level middleware that makes the injection of services possible.
 * This middleware must be added to the router.
 *
 * Uses the async context middleware to store the service provider
 * in a scoped async context for the duration of the request.
 *
 * @param serviceProvider A service provider instance
 * @return A middleware function
 */
export declare function withServiceProvider(serviceProvider: ServiceProvider): Middleware;
/**
 * Get the service provider from the current request context.
 *
 * @return The service provider
 * @throws Error if the service provider middleware is not installed
 */
export declare function getServiceProvider(): ServiceProvider;
//# sourceMappingURL=with-service-provider.d.ts.map