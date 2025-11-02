# koatty_store

[![Version npm](https://img.shields.io/npm/v/koatty_store.svg?style=flat-square)](https://www.npmjs.com/package/koatty_store)
[![npm Downloads](https://img.shields.io/npm/dm/koatty_store.svg?style=flat-square)](https://npmjs.org/package/koatty_store)

Cache store (memory or redis) for Koatty framework.

## Features

- 🚀 **Dual Storage**: Support both in-memory and Redis storage
- 💾 **LRU Cache**: Built-in LRU cache with configurable size
- ⏰ **TTL Support**: Field-level TTL for hash operations
- 🔒 **Concurrency Safe**: Atomic operations with lock protection
- 📊 **Rich Data Types**: String, Hash, List, Set, Sorted Set
- 🔄 **Auto Reconnect**: Redis connection with retry mechanism
- 🎯 **Type Safe**: Full TypeScript support
- 📦 **Lightweight**: Minimal dependencies

## Installation

```bash
npm install koatty_store
```

## Quick Start

### Memory Store

```typescript
import { CacheStore } from 'koatty_store';

// Create memory store
const store = new CacheStore({
  type: 'memory',
  keyPrefix: 'myapp:',
  maxKeys: 1000
});

// String operations
await store.set('user:1', 'John', 60); // Expires in 60 seconds
const value = await store.get('user:1');

// Hash operations
await store.hset('user:info', 'name', 'John');
await store.hset('user:info', 'age', '25');
const name = await store.hget('user:info', 'name');

// List operations
await store.rpush('queue', 'task1');
await store.rpush('queue', 'task2');
const task = await store.lpop('queue');

// Close store
await store.close();
```

### Redis Store

```typescript
import { CacheStore } from 'koatty_store';

// Create redis store
const store = new CacheStore({
  type: 'redis',
  host: '127.0.0.1',
  port: 6379,
  password: 'your-password',
  db: 0,
  keyPrefix: 'myapp:',
  poolSize: 10
});

// Use same API as memory store
await store.set('key', 'value');
await store.close();
```

## Configuration

### Memory Store Options

```typescript
interface MemoryStoreOpt {
  type: 'memory';
  keyPrefix?: string;          // Key prefix, default: 'Koatty'
  db?: number;                 // Database index, default: 0
  timeout?: number;            // Default TTL in seconds, default: 600
  maxKeys?: number;            // LRU max keys, default: 1000
  maxMemory?: number;          // Max memory in bytes
  evictionPolicy?: 'lru' | 'lfu' | 'random'; // Eviction policy, default: 'lru'
  ttlCheckInterval?: number;   // TTL check interval in ms, default: 60000
}
```

### Redis Store Options

```typescript
interface RedisStoreOpt {
  type: 'redis';
  host: string;                // Redis host
  port: number;                // Redis port
  password?: string;           // Redis password
  db?: number;                 // Database index, default: 0
  keyPrefix?: string;          // Key prefix, default: 'Koatty'
  timeout?: number;            // Default TTL in seconds, default: 600
  poolSize?: number;           // Connection pool size, default: 10
  connectTimeout?: number;     // Connection timeout in ms, default: 500
}
```

## API Reference

### String Operations

```typescript
// Set a string value with optional TTL
await store.set(key: string, value: string | number, timeout?: number): Promise<string>

// Get a string value
await store.get(key: string): Promise<string | null>

// Delete a key
await store.del(key: string): Promise<number>

// Check if key exists
await store.exists(key: string): Promise<number>

// Get TTL of a key
await store.ttl(key: string): Promise<number>

// Set TTL for a key
await store.expire(key: string, timeout: number): Promise<number>

// Increment
await store.incr(key: string): Promise<number>
await store.incrby(key: string, increment: number): Promise<number>

// Decrement
await store.decr(key: string): Promise<number>
await store.decrby(key: string, decrement: number): Promise<number>
```

### Hash Operations

```typescript
// Set hash field with optional TTL (field-level)
await store.hset(name: string, key: string, value: string | number, timeout?: number): Promise<number>

// Get hash field
await store.hget(name: string, key: string): Promise<string | null>

// Delete hash field
await store.hdel(name: string, key: string): Promise<number>

// Check if hash field exists
await store.hexists(name: string, key: string): Promise<number>

// Get all fields and values
await store.hgetall(name: string): Promise<any>

// Get all field names
await store.hkeys(name: string): Promise<string[]>

// Get all values
await store.hvals(name: string): Promise<any[]>

// Get hash length
await store.hlen(name: string): Promise<number>

// Increment hash field
await store.hincrby(name: string, key: string, increment: number): Promise<number>
```

### List Operations

```typescript
// Push to right
await store.rpush(name: string, value: string | number): Promise<number>

// Push to left
await store.lpush(name: string, value: string | number): Promise<number>

// Pop from left
await store.lpop(name: string): Promise<string | null>

// Pop from right
await store.rpop(name: string): Promise<string | null>

// Get list length
await store.llen(name: string): Promise<number>

// Get range
await store.lrange(name: string, start: number, stop: number): Promise<any[]>
```

### Set Operations

```typescript
// Add member with optional TTL
await store.sadd(name: string, value: string | number, timeout?: number): Promise<number>

// Remove member
await store.srem(name: string, key: string): Promise<number>

// Get set size
await store.scard(name: string): Promise<number>

// Check if member exists
await store.sismember(name: string, key: string): Promise<number>

// Get all members
await store.smembers(name: string): Promise<any[]>

// Pop random member
await store.spop(name: string): Promise<any>

// Move member between sets
await store.smove(source: string, destination: string, member: string): Promise<number>
```

## Advanced Features

### Field-Level TTL for Hash

```typescript
// Set hash field with TTL (expires in 60 seconds)
await store.hset('user:session', 'token', 'abc123', 60);

// Field will be automatically deleted after TTL expires
setTimeout(async () => {
  const token = await store.hget('user:session', 'token');
  console.log(token); // null
}, 61000);
```

### Singleton Pattern

```typescript
// Get singleton instance
const store1 = CacheStore.getInstance({
  type: 'memory',
  keyPrefix: 'app:'
}, 'cache1');

const store2 = CacheStore.getInstance({
  type: 'memory',
  keyPrefix: 'app:'
}, 'cache1');

console.log(store1 === store2); // true

// Clear specific instance
await CacheStore.clearInstance('cache1');

// Clear all instances
await CacheStore.clearAllInstances();
```

### Concurrency Safe Operations

All atomic operations (incr, decr, incrby, decrby, hincrby) are protected with locks to ensure data consistency in concurrent scenarios.

```typescript
// Safe concurrent increments
await Promise.all([
  store.incr('counter'),
  store.incr('counter'),
  store.incr('counter')
]);

const count = await store.get('counter');
console.log(count); // "3" - guaranteed consistency
```

## Best Practices

### 1. Use Key Prefix

```typescript
const store = new CacheStore({
  type: 'memory',
  keyPrefix: 'myapp:' // Prefix all keys
});
```

### 2. Set Appropriate TTL

```typescript
// Short-lived data
await store.set('session:token', token, 3600); // 1 hour

// Long-lived data
await store.set('user:profile', profile, 86400); // 24 hours
```

### 3. Handle Errors Gracefully

```typescript
try {
  await store.set('key', 'value');
} catch (error) {
  console.error('Cache operation failed:', error.message);
  // Fallback to database or other source
}
```

### 4. Close Store on Exit

```typescript
process.on('SIGINT', async () => {
  await store.close();
  process.exit(0);
});
```

### 5. Use Connection Pool for Redis

```typescript
const store = new CacheStore({
  type: 'redis',
  host: '127.0.0.1',
  port: 6379,
  poolSize: 20 // Adjust based on load
});
```

## Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run specific test
npm test -- test/memory.test.ts
```

## Performance

### Memory Store
- **Operations**: ~1,000,000 ops/sec
- **LRU Eviction**: O(1)
- **TTL Check**: Background task, configurable interval

### Redis Store
- **Operations**: Depends on Redis server
- **Connection Pool**: Configurable size
- **Auto Reconnect**: Exponential backoff strategy

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release history.

## License

BSD-3-Clause

## Contributing

Contributions are welcome! Please read the [contributing guidelines](https://github.com/koatty/koatty_store/blob/master/CONTRIBUTING.md) first.

## Support

- [GitHub Issues](https://github.com/koatty/koatty_store/issues)
- [Documentation](https://koatty.com)

## Related Projects

- [koatty](https://github.com/koatty/koatty) - The Koatty framework
- [koatty_lib](https://github.com/koatty/koatty_lib) - Koatty utilities
- [koatty_logger](https://github.com/koatty/koatty_logger) - Koatty logger
