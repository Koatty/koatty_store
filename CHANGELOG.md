# Changelog

## 2.0.0

### Patch Changes

- Updated dependencies
  - koatty_logger@2.4.0

## 1.9.4

### Patch Changes

- build
- Updated dependencies
  - koatty_lib@1.4.5
  - koatty_logger@2.3.4

## 1.9.3

### Patch Changes

- build
- Updated dependencies
  - koatty_lib@1.4.4
  - koatty_logger@2.3.3

## 1.9.2

### Patch Changes

- build
- Updated dependencies
  - koatty_lib@1.4.3
  - koatty_logger@2.3.2

## 1.9.1

### Patch Changes

- Updated dependencies
  - koatty_lib@1.4.2
  - koatty_logger@2.3.1

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [1.9.0](https://github.com/koatty/koatty_store/compare/v1.7.0...v1.9.0) (2025-11-02)

### Features

- enhance CacheStoreInterface with extended command support, memory store optimization options ([05c7513](https://github.com/koatty/koatty_store/commit/05c75137e45902570620a86714a260ae1f21aee9))
- enhance MemoryCache eviction event with additional insert event and detailed reason ([d1537f7](https://github.com/koatty/koatty_store/commit/d1537f70f2c8ba3aed676296575fde7f92caf9d4))
- implement comprehensive CacheStore with memory/redis support ([d10f36d](https://github.com/koatty/koatty_store/commit/d10f36d362ebb416755a6e5d10591c8d582d356b))
- implement field-level TTL, concurrency control and cleanup; fix lrange logic and hash TTL issues; improve type safety and error handling ([2f2c547](https://github.com/koatty/koatty_store/commit/2f2c54703ca224d89eb065cc6ed1a3c8f7fe533e))
- implement LRU cache ([a426b4b](https://github.com/koatty/koatty_store/commit/a426b4b93e8a0e7572972e7e823f24c6f9a9e3f0))
- implement multi-instance CacheStore management with configurable keys and cleanup methods ([7fdc773](https://github.com/koatty/koatty_store/commit/7fdc77389f2e37d18659444cac82bdfc5b9cd358))
- improve Redis connection handling with reconnection logic and pool configuration ([79b2836](https://github.com/koatty/koatty_store/commit/79b2836ba3dab7fef7a094d69697e1d7d52d1e90))
- optimize hash operations with field-level TTL in MemoryCache and improve error handling ([676772b](https://github.com/koatty/koatty_store/commit/676772b08fd2cb68d42388feb57d6ca2c3b8c6af))

### Bug Fixes

- ensure hash entries are not prematurely evicted when timeout is not specified ([961db57](https://github.com/koatty/koatty_store/commit/961db5761dd0d1ecf1e15da35ccc1e74d047d6e7))

## [1.8.1](https://github.com/koatty/koatty_store/compare/v1.8.0...v1.8.1) (2024-12-XX)

### Bug Fixes

- **memory_cache**: fix lrange method loop logic error that caused incomplete results ([#issue](https://github.com/koatty/koatty_store/issues/xxx))
- **hash**: fix hash TTL implementation to prevent data inconsistency in concurrent scenarios
- **memory_store**: simplify connection management design to remove unnecessary pool concept

### Features

- **hash**: implement field-level TTL support for hash operations
- **concurrency**: add lock protection for atomic operations (incr, decr, incrby, decrby, hincrby)
- **cleanup**: add comprehensive resource cleanup method to prevent memory leaks
- **error**: improve error handling with detailed context information
- **types**: make interface methods required for better type safety

### Performance Improvements

- **hash**: reduce hash TTL operations from 2 queries to 1 query
- **connection**: remove unnecessary connection pool overhead in MemoryStore

### BREAKING CHANGES

- MemoryStore and RedisStore no longer directly implement CacheStoreInterface (internal change, no API impact)
- All CacheStoreInterface methods are now required (improves type safety)

### Dependencies

- add `async-lock` for concurrency control
- add `@types/async-lock` for TypeScript support

## [1.8.0](https://github.com/koatty/koatty_store/compare/v1.7.0...v1.8.0) (2025-06-09)

### Features

- enhance CacheStoreInterface with extended command support, memory store optimization options ([05c7513](https://github.com/koatty/koatty_store/commit/05c75137e45902570620a86714a260ae1f21aee9))
- enhance MemoryCache eviction event with additional insert event and detailed reason ([d1537f7](https://github.com/koatty/koatty_store/commit/d1537f70f2c8ba3aed676296575fde7f92caf9d4))
- implement comprehensive CacheStore with memory/redis support ([d10f36d](https://github.com/koatty/koatty_store/commit/d10f36d362ebb416755a6e5d10591c8d582d356b))
- implement LRU cache ([a426b4b](https://github.com/koatty/koatty_store/commit/a426b4b93e8a0e7572972e7e823f24c6f9a9e3f0))
- implement multi-instance CacheStore management with configurable keys and cleanup methods ([7fdc773](https://github.com/koatty/koatty_store/commit/7fdc77389f2e37d18659444cac82bdfc5b9cd358))
- improve Redis connection handling with reconnection logic and pool configuration ([79b2836](https://github.com/koatty/koatty_store/commit/79b2836ba3dab7fef7a094d69697e1d7d52d1e90))

### Bug Fixes

- ensure hash entries are not prematurely evicted when timeout is not specified ([961db57](https://github.com/koatty/koatty_store/commit/961db5761dd0d1ecf1e15da35ccc1e74d047d6e7))

## [1.7.0](https://github.com/koatty/koatty_store/compare/v1.6.2...v1.7.0) (2024-11-07)

### [1.6.2](https://github.com/koatty/koatty_store/compare/v1.6.1...v1.6.2) (2023-12-20)

### [1.6.1](https://github.com/koatty/koatty_store/compare/v1.6.0...v1.6.1) (2023-07-28)

### Bug Fixes

- remove words ([604d31d](https://github.com/koatty/koatty_store/commit/604d31df38814a530b32605668542821b608cb7d))

## [1.6.0](https://github.com/koatty/koatty_store/compare/v1.5.8...v1.6.0) (2023-02-18)

### [1.5.8](https://github.com/koatty/koatty_store/compare/v1.5.6...v1.5.8) (2023-01-13)

### [1.5.6](https://github.com/koatty/koatty_store/compare/v1.5.5...v1.5.6) (2022-11-03)

### Bug Fixes

- upgrade deps ([cf54da2](https://github.com/koatty/koatty_store/commit/cf54da2c9e13ba843efa44b4631f3144946ebdff))

### [1.5.5](https://github.com/koatty/koatty_store/compare/v1.5.4...v1.5.5) (2022-05-27)

### [1.5.4](https://github.com/koatty/koatty_store/compare/v1.5.2...v1.5.4) (2021-12-02)

### [1.5.2](https://github.com/koatty/koatty_store/compare/v1.4.10...v1.5.2) (2021-12-02)

### [1.4.10](https://github.com/koatty/koatty_store/compare/v1.4.8...v1.4.10) (2021-11-20)
