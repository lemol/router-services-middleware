import type { Route, RequestMethod } from '@remix-run/fetch-router'

/**
 * A service factory is a function that creates a service instance.
 * The factory is called lazily when the service is first requested.
 */
export type ServiceFactory<T> = () => T

/**
 * A service definition that captures the type of a service.
 */
export interface ServiceDef<T = unknown> {
  __serviceType?: T
}

/**
 * A catalog entry is a service definition with a name attached.
 * Created by `defineCatalog()`.
 */
export interface CatalogEntry<T = unknown> extends ServiceDef<T> {
  __name: string
}

/**
 * Create a service type that can be used to define services in a type-safe way.
 *
 * @example
 * ```ts
 * const createPost = serviceOf<(args: { title: string, content: string }) => void>()
 * ```
 */
export function serviceOf<T>(): ServiceDef<T> {
  return {}
}

/**
 * A service catalog is a record of service names to service definitions.
 */
export type ServiceCatalog = Record<string, ServiceDef>

/**
 * A defined catalog is a record of service names to catalog entries.
 */
export type DefinedCatalog<C extends ServiceCatalog> = {
  [K in keyof C]: C[K] extends ServiceDef<infer T> ? CatalogEntry<T> & { __name: K } : never
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
export function defineCatalog<C extends ServiceCatalog>(catalog: C): DefinedCatalog<C> {
  let result = {} as DefinedCatalog<C>

  for (let name of Object.keys(catalog)) {
    ;(result as any)[name] = {
      ...catalog[name],
      __name: name,
    }
  }

  return result
}

/**
 * Extract the service type from a service definition.
 */
export type ServiceType<S extends ServiceDef> = S extends ServiceDef<infer T> ? T : never

/**
 * Extract the service types from a service catalog.
 */
export type ServiceTypes<C extends ServiceCatalog> = {
  [K in keyof C]: ServiceType<C[K]>
}

/**
 * A service provider that manages service factories and instances.
 *
 * Services are registered with `provide()` and are instantiated lazily
 * when first requested within a request context.
 */
export class ServiceProvider<Catalog extends ServiceCatalog = ServiceCatalog> {
  #factories = new Map<string, ServiceFactory<unknown>>()
  #catalog?: DefinedCatalog<Catalog>

  /**
   * Create a new service provider.
   *
   * @param catalog Optional service catalog for the complete example pattern
   */
  constructor(catalog?: DefinedCatalog<Catalog>) {
    this.#catalog = catalog
  }

  /**
   * Register a service factory for a specific route (basic usage).
   *
   * @param route The route to register the service for
   * @param serviceName The name of the service
   * @param factory The factory function that creates the service instance
   */
  provide<T>(
    route: Route<RequestMethod | 'ANY', string>,
    serviceName: string,
    factory: ServiceFactory<T>,
  ): void

  /**
   * Register a service factory using a catalog entry (complete example pattern).
   *
   * @param entry A catalog entry from `defineCatalog()`
   * @param factory The factory function that creates the service instance
   */
  provide<T>(entry: CatalogEntry<T>, factory: ServiceFactory<T>): void

  provide<T>(
    routeOrEntry: Route<RequestMethod | 'ANY', string> | CatalogEntry<T>,
    serviceNameOrFactory: string | ServiceFactory<T>,
    factory?: ServiceFactory<T>,
  ): void {
    if (isCatalogEntry(routeOrEntry)) {
      // Catalog entry overload
      let entry = routeOrEntry
      let factoryFn = serviceNameOrFactory as ServiceFactory<T>
      this.#factories.set(entry.__name, factoryFn)
    } else {
      // Route overload
      let route = routeOrEntry
      let serviceName = serviceNameOrFactory as string
      let factoryFn = factory!
      let key = `${route.method}:${route.pattern.source}:${serviceName}`
      this.#factories.set(key, factoryFn)
    }
  }

  /**
   * Get a service factory for a specific route and service name.
   *
   * @param route The route to get the service factory for
   * @param serviceName The name of the service
   * @return The service factory, or undefined if not found
   */
  getFactory<T>(
    route: Route<RequestMethod | 'ANY', string>,
    serviceName: string,
  ): ServiceFactory<T> | undefined {
    // First try route-specific factory
    let routeKey = `${route.method}:${route.pattern.source}:${serviceName}`
    let factory = this.#factories.get(routeKey) as ServiceFactory<T> | undefined

    // Fall back to catalog-based factory (global)
    if (!factory) {
      factory = this.#factories.get(serviceName) as ServiceFactory<T> | undefined
    }

    return factory
  }
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
