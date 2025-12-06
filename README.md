# router-services-middleware

Type-safe dependency injection middleware for `@remix-run/fetch-router`.

## Features

- **Type-safe service access**: Define and access services with full TypeScript type safety in your route handlers.
- **Lazy initialization**: Services are created only when first accessed, improving performance.
- **Request-scoped instances**: Each request gets its own service instances, ensuring isolation.

## Installation

```sh
npm install @remix-run/router-services-middleware @remix-run/fetch-router-extra @remix-run/async-context-middleware
```

## How It Works

The service provider middleware uses [@remix-run/async-context-middleware](../async-context-middleware/README.md) to store services in a request-scoped async context.

Services are initialized lazily when first accessed, and the same instance is reused for the duration of the request.

## Usage

Use `withServices()` to declare the services your route handler needs. Services become available on `context.extra.services` with full type safety.

### Basic Usage

```ts
import { createRouter, route } from '@remix-run/fetch-router'
import { defineRouter, use } from '@remix-run/fetch-router-extra'
import { asyncContext } from '@remix-run/async-context-middleware'
import { withServices, serviceOf, ServiceProvider, withServiceProvider } from '@remix-run/router-services-middleware'

let routes = route({
  posts: { method: 'POST', pattern: '/posts' },
})

let serviceProvider = new ServiceProvider()
let router = createRouter({
  middleware: [asyncContext(), withServiceProvider(serviceProvider)],
})

// Define the route handler with services
router.post(routes.posts, defineRouter({
  middleware: use(
    withServices(routes.posts, {
      createPost: serviceOf<(args: { title: string; content: string }) => void>(),
    })
  ),
  handler: ({ extra }) => {
    // extra.services is fully typed
    extra.services.createPost({ title: 'Hello', content: 'World' })
    return new Response('OK', { status: 200 })
  },
}))

// Register the service implementation
serviceProvider.provide(routes.posts, 'createPost', () => {
  return ({ title, content }: { title: string; content: string }) => {
    console.log(`Creating post: ${title} - ${content}`)
  }
})
```

### Complete Example

For larger applications, you can define a service catalog to centralize your service definitions:

```ts
// services.ts
import { defineCatalog, serviceOf, ServiceProvider } from '@remix-run/router-services-middleware'

export let ServiceCatalog = defineCatalog({
  postRepository: serviceOf<PostRepository>(),
  userRepository: serviceOf<UserRepository>(),
  notificationService: serviceOf<NotificationService>(),
})

export let serviceProvider = new ServiceProvider(ServiceCatalog)
```

```ts
// routes/posts.ts
import { defineRouter, use } from '@remix-run/fetch-router-extra'
import { withServices } from '@remix-run/router-services-middleware'
import { ServiceCatalog } from '../services'

export let postsRouter = defineRouter(routes.posts, {
  middleware: use(
    withServices(ServiceCatalog.postRepository)
  ),
  handlers: {
    index: ({ extra }) => {
      let posts = extra.services.postRepository.listPosts()
      return new Response(JSON.stringify(posts))
    },
  },
})
```

```ts
// router.ts
import { createRouter } from '@remix-run/fetch-router'
import { asyncContext } from '@remix-run/async-context-middleware'
import { withServiceProvider } from '@remix-run/router-services-middleware'
import { serviceProvider } from './services'
import { postsRouter } from './routes/posts'

export let router = createRouter({
  middleware: [asyncContext(), withServiceProvider(serviceProvider)],
})

router.map(routes.posts, postsRouter)
```

```ts
// server.ts
import { router } from './router'
import { serviceProvider, ServiceCatalog } from './services'
import { MemoryPostRepository, MemoryUserRepository, ConsoleNotificationService } from './implementation'

// Register service implementations
serviceProvider.provide(ServiceCatalog.postRepository, () => new MemoryPostRepository())
serviceProvider.provide(ServiceCatalog.userRepository, () => new MemoryUserRepository())
serviceProvider.provide(ServiceCatalog.notificationService, () => new ConsoleNotificationService())

// Start the server
router.fetch(request)
```

## API Reference

### `defineCatalog(catalog)`

Creates a service catalog from service definitions. Used with `ServiceProvider` for the complete example pattern.

- `catalog`: An object mapping service names to service definitions created with `serviceOf<T>()`.

```ts
let ServiceCatalog = defineCatalog({
  postRepository: serviceOf<PostRepository>(),
  userRepository: serviceOf<UserRepository>(),
})
```

### `ServiceProvider`

A class that manages service factories and provides instances.

```ts
// Basic usage
let serviceProvider = new ServiceProvider()

// With a service catalog
let serviceProvider = new ServiceProvider(ServiceCatalog)
```

### `serviceProvider.provide(route, serviceName, factory)`

Registers a service factory for a specific route (basic usage).

- `route`: The route to register the service for.
- `serviceName`: The name of the service (must match the key in `withServices`).
- `factory`: A function that returns the service instance.

### `serviceProvider.provide(catalogEntry, factory)`

Registers a service factory using a catalog entry (complete example pattern).

- `catalogEntry`: A service definition from the catalog (e.g., `ServiceCatalog.postRepository`).
- `factory`: A function that returns the service instance.

### `withServiceProvider(serviceProvider)`

Top-level middleware that enables service injection. Must be added to the router's middleware chain.

- `serviceProvider`: A `ServiceProvider` instance.

### `withServices(route, catalog)`

Route-level middleware that declares required services (basic usage).

- `route`: The route this middleware is applied to.
- `catalog`: An object mapping service names to service definitions created with `serviceOf<T>()`.

### `withServices(catalogEntry)`

Route-level middleware that declares a required service using a catalog entry (complete example pattern).

- `catalogEntry`: A service definition from the catalog (e.g., `ServiceCatalog.postRepository`).

Services become available on `context.extra.services` with full type safety.

### `serviceOf<T>()`

Creates a service definition with the specified type. Used to declare services in a type-safe way.

- `T`: The TypeScript type of the service.

```ts
serviceOf<(args: { title: string }) => void>()
serviceOf<UserRepository>()
```

### `resolveService(catalogEntry)`

Resolves a service instance from a catalog entry. Useful when you need to access a service outside of `withServices` (e.g., in a utility function or another middleware).

- `catalogEntry`: A service definition from the catalog.

```ts
let postRepository = resolveService(ServiceCatalog.postRepository)
```

### `resolveService(route, serviceName)`

Resolves a service instance from a route and service name.

- `route`: The route the service is registered for.
- `serviceName`: The name of the service.

```ts
let createPost = resolveService(routes.posts, 'createPost')
```

## Related Packages

- [`@remix-run/fetch-router`](../fetch-router) - Router for the web Fetch API
- [`@remix-run/fetch-router-extra`](../fetch-router-extra) - Extra utilities for `@remix-run/fetch-router`
- [`@remix-run/async-context-middleware`](../async-context-middleware) - Async context middleware for request-scoped storage

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
