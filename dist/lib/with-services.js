import { getContext } from '@remix-run/async-context-middleware';
import { createStorageKey } from '@remix-run/fetch-router';
import { getServiceProvider } from "./with-service-provider.js";
const SERVICES_INSTANCE_KEY = createStorageKey();
/**
 * Get the service instances map from the current request context.
 * Creates a new map if one doesn't exist.
 */
function getServiceInstances() {
    let context = getContext();
    if (!context.storage.has(SERVICES_INSTANCE_KEY)) {
        let instances = new Map();
        context.storage.set(SERVICES_INSTANCE_KEY, instances);
        return instances;
    }
    return context.storage.get(SERVICES_INSTANCE_KEY);
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
export function resolveService(catalogEntryOrRoute, serviceName) {
    let instances = getServiceInstances();
    let provider = getServiceProvider();
    return resolveServiceInternal(catalogEntryOrRoute, instances, provider, serviceName);
}
function resolveServiceInternal(catalogEntryOrRoute, instances, provider, serviceName) {
    if (isCatalogEntry(catalogEntryOrRoute)) {
        let name = catalogEntryOrRoute.__name;
        let key = name;
        if (instances.has(key)) {
            return instances.get(key);
        }
        let factory = provider.getFactory({ method: 'ANY', pattern: { source: '' } }, name);
        if (!factory) {
            throw new Error(`No factory registered for service "${name}". ` +
                `Did you forget to call serviceProvider.provide()?`);
        }
        let instance = factory();
        instances.set(key, instance);
        return instance;
    }
    // Route-based resolution
    let route = catalogEntryOrRoute;
    let name = serviceName;
    let key = `${route.method}:${route.pattern.source}:${name}`;
    if (instances.has(key)) {
        return instances.get(key);
    }
    let factory = provider.getFactory(route, name);
    if (!factory) {
        throw new Error(`No factory registered for service "${name}" on route "${route.method} ${route.pattern.source}". ` +
            `Did you forget to call serviceProvider.provide()?`);
    }
    let instance = factory();
    instances.set(key, instance);
    return instance;
}
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
export function withServices(...entries) {
    // Collect all catalog entries
    return (context) => {
        // Capture instances and provider at middleware execution time
        let instances = getServiceInstances();
        let provider = getServiceProvider();
        // Merge with existing services if present
        let existingServices = context.extra?.services ?? {};
        let services = { ...existingServices };
        for (let entry of entries) {
            Object.defineProperty(services, entry.__name, {
                get() {
                    return resolveServiceInternal(entry, instances, provider);
                },
                enumerable: true,
                configurable: true,
            });
        }
        ;
        context.extra ??= {};
        context.extra.services = services;
    };
}
