import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { route } from '@remix-run/fetch-router'

import { ServiceProvider, defineCatalog, serviceOf } from './service-provider.ts'

describe('ServiceProvider', () => {
  it('provides and retrieves a service factory', () => {
    let routes = route({
      posts: '/posts',
    })

    let provider = new ServiceProvider()
    let factory = () => 'test-service'

    provider.provide(routes.posts, 'myService', factory)

    let retrievedFactory = provider.getFactory(routes.posts, 'myService')
    assert.equal(retrievedFactory, factory)
    assert.equal(retrievedFactory?.(), 'test-service')
  })

  it('returns undefined for non-existent service', () => {
    let routes = route({
      posts: '/posts',
    })

    let provider = new ServiceProvider()

    let retrievedFactory = provider.getFactory(routes.posts, 'nonExistent')
    assert.equal(retrievedFactory, undefined)
  })

  it('provides multiple services for the same route', () => {
    let routes = route({
      posts: '/posts',
    })

    let provider = new ServiceProvider()

    provider.provide(routes.posts, 'service1', () => 'service-1')
    provider.provide(routes.posts, 'service2', () => 'service-2')

    assert.equal(provider.getFactory(routes.posts, 'service1')?.(), 'service-1')
    assert.equal(provider.getFactory(routes.posts, 'service2')?.(), 'service-2')
  })

  it('provides services for different routes', () => {
    let routes = route({
      posts: '/posts',
      users: '/users',
    })

    let provider = new ServiceProvider()

    provider.provide(routes.posts, 'service', () => 'posts-service')
    provider.provide(routes.users, 'service', () => 'users-service')

    assert.equal(provider.getFactory(routes.posts, 'service')?.(), 'posts-service')
    assert.equal(provider.getFactory(routes.users, 'service')?.(), 'users-service')
  })

  it('overwrites a service factory when provided again', () => {
    let routes = route({
      posts: '/posts',
    })

    let provider = new ServiceProvider()

    provider.provide(routes.posts, 'myService', () => 'first')
    provider.provide(routes.posts, 'myService', () => 'second')

    assert.equal(provider.getFactory(routes.posts, 'myService')?.(), 'second')
  })
})

describe('defineCatalog', () => {
  it('creates catalog entries with names', () => {
    let catalog = defineCatalog({
      postService: serviceOf<{ list: () => string[] }>(),
      userService: serviceOf<{ get: () => string }>(),
    })

    assert.equal(catalog.postService.__name, 'postService')
    assert.equal(catalog.userService.__name, 'userService')
  })

  it('works with ServiceProvider.provide()', () => {
    let catalog = defineCatalog({
      myService: serviceOf<string>(),
    })

    let provider = new ServiceProvider(catalog)
    provider.provide(catalog.myService, () => 'hello')

    // The factory is stored under the catalog entry name
    let factory = provider.getFactory({ method: 'ANY', pattern: { source: '' } } as any, 'myService')
    assert.equal(factory?.(), 'hello')
  })
})
