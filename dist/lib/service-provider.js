/**
 * Create a service type that can be used to define services in a type-safe way.
 *
 * @example
 * ```ts
 * const createPost = serviceOf<(args: { title: string, content: string }) => void>()
 * ```
 */
export function serviceOf() {
    return {};
}
/**
 * Create a service catalog from service definitions.
 * Each entry in the catalog will have its name attached for use with
 * `withServices()` and `serviceProvider.provide()`.
 *
 * @param catalog An object mapping service names to service definitions
 * @return A catalog with named entries
 *
 * @example
 * ```ts
 * let ServiceCatalog = defineCatalog({
 *   postRepository: serviceOf<PostRepository>(),
 *   userRepository: serviceOf<UserRepository>(),
 * })
 * ```
 */
export function defineCatalog(catalog) {
    let result = {};
    for (let name of Object.keys(catalog)) {
        ;
        result[name] = {
            ...catalog[name],
            __name: name,
        };
    }
    return result;
}
/**
 * A service provider that manages service factories and instances.
 *
 * Services are registered with `provide()` and are instantiated lazily
 * when first requested within a request context.
 */
export class ServiceProvider {
    #factories = new Map();
    #catalog;
    /**
     * Create a new service provider.
     *
     * @param catalog Optional service catalog for the complete example pattern
     */
    constructor(catalog) {
        this.#catalog = catalog;
    }
    provide(routeOrEntry, serviceNameOrFactory, factory) {
        if (isCatalogEntry(routeOrEntry)) {
            // Catalog entry overload
            let entry = routeOrEntry;
            let factoryFn = serviceNameOrFactory;
            this.#factories.set(entry.__name, factoryFn);
        }
        else {
            // Route overload
            let route = routeOrEntry;
            let serviceName = serviceNameOrFactory;
            let factoryFn = factory;
            let key = `${route.method}:${route.pattern.source}:${serviceName}`;
            this.#factories.set(key, factoryFn);
        }
    }
    /**
     * Get a service factory for a specific route and service name.
     *
     * @param route The route to get the service factory for
     * @param serviceName The name of the service
     * @return The service factory, or undefined if not found
     */
    getFactory(route, serviceName) {
        // First try route-specific factory
        let routeKey = `${route.method}:${route.pattern.source}:${serviceName}`;
        let factory = this.#factories.get(routeKey);
        // Fall back to catalog-based factory (global)
        if (!factory) {
            factory = this.#factories.get(serviceName);
        }
        return factory;
    }
}
/**
 * Check if a value is a catalog entry.
 */
function isCatalogEntry(value) {
    return (typeof value === 'object' &&
        value !== null &&
        '__name' in value &&
        typeof value.__name === 'string');
}
