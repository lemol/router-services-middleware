import { getContext } from '@remix-run/async-context-middleware'
import { createStorageKey } from '@remix-run/fetch-router'
import type { NextFunction, RequestContext } from '@remix-run/fetch-router'
import type { Middleware } from 'fetch-router-extra'

import type { ServiceProvider } from './service-provider.ts'

const SERVICE_PROVIDER_KEY = createStorageKey<ServiceProvider>()

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
export function withServiceProvider(serviceProvider: ServiceProvider): Middleware {
  return (context: RequestContext, next: NextFunction) => {
    context.storage.set(SERVICE_PROVIDER_KEY, serviceProvider)
    return next()
  }
}

/**
 * Get the service provider from the current request context.
 *
 * @return The service provider
 * @throws Error if the service provider middleware is not installed
 */
export function getServiceProvider(): ServiceProvider {
  let context = getContext()

  if (!context.storage.has(SERVICE_PROVIDER_KEY)) {
    throw new Error(
      'No service provider found. Make sure the withServiceProvider middleware is installed.',
    )
  }

  return context.storage.get(SERVICE_PROVIDER_KEY)
}
