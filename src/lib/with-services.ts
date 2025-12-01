import { getContext } from '@remix-run/async-context-middleware'
import { createStorageKey } from '@remix-run/fetch-router'
import type { Middleware } from 'fetch-router-extra'
import type { RequestContext, Route, RequestMethod } from '@remix-run/fetch-router'

import type {
  ServiceCatalog,
  ServiceTypes,
  CatalogEntry,
  ServiceProvider,
} from './service-provider.ts'
import { getServiceProvider } from './with-service-provider.ts'

type ServiceInstances = Map<string, unknown>

const SERVICES_INSTANCE_KEY = createStorageKey<ServiceInstances>()

/**
 * Get the service instances map from the current request context.
 * Creates a new map if one doesn't exist.
 */
function getServiceInstances(): ServiceInstances {
  let context = getContext()

  if (!context.storage.has(SERVICES_INSTANCE_KEY)) {
    let instances = new Map<string, unknown>()
    context.storage.set(SERVICES_INSTANCE_KEY, instances)
    return instances
  }

  return context.storage.get(SERVICES_INSTANCE_KEY)
}

/**
 * Check if a value is a catalog entry.
 */
function isCatalogEntry(value: unknown): value is CatalogEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__name' in value &&
    typeof (value as CatalogEntry).__name === 'string'
  )
}

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
export function resolveService<T>(catalogEntry: CatalogEntry<T>): T

/**
 * Resolve a service instance from a route and service name.
 *
 * @param route The route the service is registered for
 * @param serviceName The name of the service
 * @return The service instance
 */
export function resolveService<T>(route: Route<RequestMethod | 'ANY', string>, serviceName: string): T

export function resolveService<T>(
  catalogEntryOrRoute: CatalogEntry<T> | Route<RequestMethod | 'ANY', string>,
  serviceName?: string,
): T {
  let instances = getServiceInstances()
  let provider = getServiceProvider()
  return resolveServiceInternal(catalogEntryOrRoute, instances, provider, serviceName)
}

function resolveServiceInternal<T>(
  catalogEntryOrRoute: CatalogEntry<T> | Route<RequestMethod | 'ANY', string>,
  instances: ServiceInstances,
  provider: ServiceProvider,
  serviceName?: string,
): T {
  if (isCatalogEntry(catalogEntryOrRoute)) {
    let name = catalogEntryOrRoute.__name
    let key = name

    if (instances.has(key)) {
      return instances.get(key) as T
    }

    let factory = provider.getFactory({ method: 'ANY', pattern: { source: '' } } as any, name)
    if (!factory) {
      throw new Error(
        `No factory registered for service "${name}". ` +
          `Did you forget to call serviceProvider.provide()?`,
      )
    }

    let instance = factory()
    instances.set(key, instance)
    return instance as T
  }

  // Route-based resolution
  let route = catalogEntryOrRoute
  let name = serviceName!
  let key = `${route.method}:${route.pattern.source}:${name}`

  if (instances.has(key)) {
    return instances.get(key) as T
  }

  let factory = provider.getFactory(route, name)
  if (!factory) {
    throw new Error(
      `No factory registered for service "${name}" on route "${route.method} ${route.pattern.source}". ` +
        `Did you forget to call serviceProvider.provide()?`,
    )
  }

  let instance = factory()
  instances.set(key, instance)
  return instance as T
}

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
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void
  ? I
  : never

type ExtractServiceMap<E> = E extends CatalogEntry<infer T> & { __name: infer N }
  ? N extends string
    ? { [K in N]: T }
    : never
  : never

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
export function withServices<Entries extends (CatalogEntry & { __name: string })[]>(
  ...entries: Entries
): Middleware<{ services: UnionToIntersection<ExtractServiceMap<Entries[number]>> }> {
  // Collect all catalog entries
  return (context: RequestContext) => {
    // Capture instances and provider at middleware execution time
    let instances = getServiceInstances()
    let provider = getServiceProvider()

    // Merge with existing services if present
    let existingServices = (context as any).extra?.services ?? {}
    let services = { ...existingServices }

    for (let entry of entries) {
      Object.defineProperty(services, entry.__name, {
        get() {
          return resolveServiceInternal(entry, instances, provider)
        },
        enumerable: true,
        configurable: true,
      })
    }

    ;(context as any).extra ??= {}
    ;(context as any).extra.services = services
  }
}
