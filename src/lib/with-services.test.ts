import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createRouter, route } from '@remix-run/fetch-router'
import { asyncContext } from '@remix-run/async-context-middleware'

import { ServiceProvider, serviceOf, defineCatalog } from './service-provider.ts'
import { withServiceProvider, getServiceProvider } from './with-service-provider.ts'
import { withServices, resolveService } from './with-services.ts'

describe('withServiceProvider', () => {
  it('stores the service provider in context', async () => {
    let routes = route({
      home: '/',
    })

    let serviceProvider = new ServiceProvider()
    let router = createRouter({
      middleware: [asyncContext(), withServiceProvider(serviceProvider)],
    })

    router.map(routes.home, () => {
      let provider = getServiceProvider()
      assert.equal(provider, serviceProvider)
      return new Response('Home')
    })

    let response = await router.fetch('https://remix.run/')
    assert.equal(response.status, 200)
  })

  it('throws when service provider is not installed', async () => {
    let routes = route({
      home: '/',
    })

    let router = createRouter({
      middleware: [asyncContext()],
    })

    router.map(routes.home, () => {
      assert.throws(
        () => getServiceProvider(),
        /No service provider found/,
      )
      return new Response('Home')
    })

    await router.fetch('https://remix.run/')
  })
})

describe('withServices', () => {
  it('makes services available on extra.services', async () => {
    let routes = route({
      posts: { method: 'POST', pattern: '/posts' },
    })

    let catalog = defineCatalog({
      createPost: serviceOf<(title: string) => string>(),
    })

    let serviceProvider = new ServiceProvider(catalog)
    serviceProvider.provide(catalog.createPost, () => {
      return (title: string) => `Created: ${title}`
    })

    let router = createRouter({
      middleware: [asyncContext(), withServiceProvider(serviceProvider)],
    })

    let capturedServices: any = null

    router.post(routes.posts, {
      middleware: [
        withServices(catalog.createPost),
      ],
      handler(context: any) {
        capturedServices = context.extra.services
        return new Response('OK')
      },
    })

    await router.fetch('https://remix.run/posts', { method: 'POST' })

    assert.ok(capturedServices)
    assert.equal(typeof capturedServices.createPost, 'function')
    assert.equal(capturedServices.createPost('Hello'), 'Created: Hello')
  })

  it('lazily initializes services', async () => {
    let routes = route({
      posts: { method: 'POST', pattern: '/posts' },
    })

    let catalog = defineCatalog({
      myService: serviceOf<{ value: string }>(),
    })

    let initCount = 0
    let serviceProvider = new ServiceProvider(catalog)
    serviceProvider.provide(catalog.myService, () => {
      initCount++
      return { value: 'test' }
    })

    let router = createRouter({
      middleware: [asyncContext(), withServiceProvider(serviceProvider)],
    })

    router.post(routes.posts, {
      middleware: [
        withServices(catalog.myService),
      ],
      handler(context: any) {
        // Service should not be initialized yet
        assert.equal(initCount, 0)

        // Access the service
        let service = context.extra.services.myService
        assert.equal(initCount, 1)
        assert.equal(service.value, 'test')

        // Access again - should not reinitialize
        let service2 = context.extra.services.myService
        assert.equal(initCount, 1)
        assert.equal(service2, service)

        return new Response('OK')
      },
    })

    await router.fetch('https://remix.run/posts', { method: 'POST' })
  })

  it('throws when service factory is not registered', async () => {
    let routes = route({
      posts: { method: 'POST', pattern: '/posts' },
    })

    let catalog = defineCatalog({
      missingService: serviceOf<string>(),
    })

    let serviceProvider = new ServiceProvider(catalog)
    // Note: not registering the service

    let router = createRouter({
      middleware: [asyncContext(), withServiceProvider(serviceProvider)],
    })

    router.post(routes.posts, {
      middleware: [
        withServices(catalog.missingService),
      ],
      handler(context: any) {
        assert.throws(
          () => context.extra.services.missingService,
          /No factory registered for service "missingService"/,
        )
        return new Response('OK')
      },
    })

    await router.fetch('https://remix.run/posts', { method: 'POST' })
  })

  it('provides multiple services', async () => {
    let routes = route({
      posts: { method: 'POST', pattern: '/posts' },
    })

    let catalog = defineCatalog({
      serviceA: serviceOf<string>(),
      serviceB: serviceOf<string>(),
    })

    let serviceProvider = new ServiceProvider(catalog)
    serviceProvider.provide(catalog.serviceA, () => 'A')
    serviceProvider.provide(catalog.serviceB, () => 'B')

    let router = createRouter({
      middleware: [asyncContext(), withServiceProvider(serviceProvider)],
    })

    router.post(routes.posts, {
      middleware: [
        withServices(catalog.serviceA, catalog.serviceB),
      ],
      handler(context: any) {
        assert.equal(context.extra.services.serviceA, 'A')
        assert.equal(context.extra.services.serviceB, 'B')
        return new Response('OK')
      },
    })

    await router.fetch('https://remix.run/posts', { method: 'POST' })
  })

  it('isolates services between requests', async () => {
    let routes = route({
      posts: { method: 'POST', pattern: '/posts' },
    })

    let catalog = defineCatalog({
      counter: serviceOf<{ id: number }>(),
    })

    let requestCount = 0
    let serviceProvider = new ServiceProvider(catalog)
    serviceProvider.provide(catalog.counter, () => {
      requestCount++
      return { id: requestCount }
    })

    let router = createRouter({
      middleware: [asyncContext(), withServiceProvider(serviceProvider)],
    })

    let capturedIds: number[] = []

    router.post(routes.posts, {
      middleware: [
        withServices(catalog.counter),
      ],
      handler(context: any) {
        capturedIds.push(context.extra.services.counter.id)
        return new Response('OK')
      },
    })

    await router.fetch('https://remix.run/posts', { method: 'POST' })
    await router.fetch('https://remix.run/posts', { method: 'POST' })
    await router.fetch('https://remix.run/posts', { method: 'POST' })

    // Each request should get a new service instance
    assert.deepEqual(capturedIds, [1, 2, 3])
  })

  it('works with catalog entries', async () => {
    let catalog = defineCatalog({
      postService: serviceOf<{ listPosts: () => string[] }>(),
      userService: serviceOf<{ getUser: () => string }>(),
    })

    let serviceProvider = new ServiceProvider(catalog)
    serviceProvider.provide(catalog.postService, () => ({
      listPosts: () => ['Post 1', 'Post 2'],
    }))
    serviceProvider.provide(catalog.userService, () => ({
      getUser: () => 'John',
    }))

    let router = createRouter({
      middleware: [asyncContext(), withServiceProvider(serviceProvider)],
    })

    let capturedServices: any = null

    router.get('/test', {
      middleware: [withServices(catalog.postService, catalog.userService)],
      handler(context: any) {
        capturedServices = context.extra.services
        return new Response('OK')
      },
    })

    await router.fetch('https://remix.run/test')

    assert.ok(capturedServices)
    assert.deepEqual(capturedServices.postService.listPosts(), ['Post 1', 'Post 2'])
    assert.equal(capturedServices.userService.getUser(), 'John')
  })
})

describe('resolveService', () => {
  it('resolves a catalog entry service', async () => {
    let catalog = defineCatalog({
      myService: serviceOf<{ getValue: () => string }>(),
    })

    let serviceProvider = new ServiceProvider(catalog)
    serviceProvider.provide(catalog.myService, () => ({
      getValue: () => 'Hello from service',
    }))

    let router = createRouter({
      middleware: [asyncContext(), withServiceProvider(serviceProvider)],
    })

    let resolvedValue: string | null = null

    router.get('/test', {
      handler() {
        let service = resolveService(catalog.myService)
        resolvedValue = service.getValue()
        return new Response('OK')
      },
    })

    await router.fetch('https://remix.run/test')

    assert.equal(resolvedValue, 'Hello from service')
  })

  it('resolves a route-based service', async () => {
    let routes = route({
      posts: '/posts',
    })

    let serviceProvider = new ServiceProvider()
    serviceProvider.provide(routes.posts, 'myService', () => ({
      getData: () => 'Route-based data',
    }))

    let router = createRouter({
      middleware: [asyncContext(), withServiceProvider(serviceProvider)],
    })

    let resolvedValue: string | null = null

    router.get(routes.posts, {
      handler() {
        let service = resolveService<{ getData: () => string }>(routes.posts, 'myService')
        resolvedValue = service.getData()
        return new Response('OK')
      },
    })

    await router.fetch('https://remix.run/posts')

    assert.equal(resolvedValue, 'Route-based data')
  })

  it('returns the same instance for multiple calls', async () => {
    let catalog = defineCatalog({
      counter: serviceOf<{ id: number }>(),
    })

    let instanceCount = 0
    let serviceProvider = new ServiceProvider(catalog)
    serviceProvider.provide(catalog.counter, () => {
      instanceCount++
      return { id: instanceCount }
    })

    let router = createRouter({
      middleware: [asyncContext(), withServiceProvider(serviceProvider)],
    })

    let ids: number[] = []

    router.get('/test', {
      handler() {
        ids.push(resolveService(catalog.counter).id)
        ids.push(resolveService(catalog.counter).id)
        ids.push(resolveService(catalog.counter).id)
        return new Response('OK')
      },
    })

    await router.fetch('https://remix.run/test')

    // All three calls should return the same instance
    assert.deepEqual(ids, [1, 1, 1])
    assert.equal(instanceCount, 1)
  })
})
