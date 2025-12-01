import type { Middleware } from 'fetch-router-extra';
import type { Route, RequestMethod } from '@remix-run/fetch-router';
import type { CatalogEntry } from './service-provider.ts';
/**
 * Resolve a service instance from a catalog entry.
 *
 * Services are initialized lazily when first accessed, and the same instance
 * is returned for the duration of the request.
 *
 * @param catalogEntry A catalog entry from `defineCatalog()`
 * @return The service instance
 *
 * @example
 * ```ts
 * let postRepository = resolveService(ServiceCatalog.postRepository)
 * ```
 */
export declare function resolveService<T>(catalogEntry: CatalogEntry<T>): T;
/**
 * Resolve a service instance from a route and service name.
 *
 * @param route The route the service is registered for
 * @param serviceName The name of the service
 * @return The service instance
 */
export declare function resolveService<T>(route: Route<RequestMethod | 'ANY', string>, serviceName: string): T;
/**
 * Create a middleware that makes a catalog entry service available on the request context.
 *
 * Services are initialized lazily when first accessed, and the same instance
 * is returned for the duration of the request.
 *
 * @param entry A catalog entry from `defineCatalog()`
 * @return A middleware that adds the service to `extra.services`
 *
 * @example
 * ```ts
 * const middleware = withServices(ServiceCatalog.postRepository)
 * // extra.services.postRepository is now available
 * ```
 */
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;
type ExtractServiceMap<E> = E extends CatalogEntry<infer T> & {
    __name: infer N;
} ? N extends string ? {
    [K in N]: T;
} : never : never;
/**
 * Create a middleware that makes services available on the request context.
 *
 * Services are initialized lazily when first accessed, and the same instance
 * is returned for the duration of the request.
 *
 * @param entries Catalog entries from `defineCatalog()`
 * @return A middleware that adds the services to `extra.services`
 *
 * @example
 * ```ts
 * const middleware = withServices(
 *   ServiceCatalog.postRepository,
 *   ServiceCatalog.userRepository
 * )
 * // extra.services.postRepository and extra.services.userRepository are available
 * ```
 */
export declare function withServices<Entries extends (CatalogEntry & {
    __name: string;
})[]>(...entries: Entries): Middleware<{
    services: UnionToIntersection<ExtractServiceMap<Entries[number]>>;
}>;
export {};
//# sourceMappingURL=with-services.d.ts.map