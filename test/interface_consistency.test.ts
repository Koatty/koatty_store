import { CacheStore } from '../src/index';

describe('Interface Consistency Test', () => {
  afterAll(async () => {
    // 清理所有实例
    await CacheStore.clearAllInstances();
  });

  test('CacheStore should implement CacheStoreInterface correctly', () => {
    const memoryStore = CacheStore.getInstance({
      type: 'memory',
      maxKeys: 100,
      timeout: 60
    });

    const redisStore = CacheStore.getInstance({
      type: 'redis',
      host: '127.0.0.1',
      port: 6379,
      timeout: 60
    });

    // Test that both instances have the same interface methods
    const commonMethods = [
      'getConnection',
      'close', 
      'release',
      'get',
      'set',
      'del',
      'exists',
      'ttl',
      'expire',
      'incr',
      'decr',
      'incrby',
      'decrby',
      'hset',
      'hget',
      'hdel',
      'hexists',
      'hgetall',
      'hkeys',
      'hvals',
      'hlen',
      'hincrby',
      'lpush',
      'rpush',
      'lpop',
      'rpop',
      'llen',
      'lrange',
      'sadd',
      'scard',
      'sismember',
      'smembers',
      'spop',
      'srem',
      'smove'
    ];

    // Verify all common methods exist on both instances
    commonMethods.forEach(method => {
      expect(typeof memoryStore[method]).toBe('function');
      expect(typeof redisStore[method]).toBe('function');
    });

    // Verify that non-common methods are NOT exposed on CacheStore
    expect(memoryStore['defineCommand']).toBeUndefined();
    expect(memoryStore['getCompare']).toBeUndefined();
    expect(redisStore['defineCommand']).toBeUndefined();
    expect(redisStore['getCompare']).toBeUndefined();

    // But can be accessed via getRawClient if needed
    const memoryRawClient = memoryStore.getRawClient();
    const redisRawClient = redisStore.getRawClient();
    
    expect(typeof memoryRawClient['defineCommand']).toBe('function');
    expect(typeof memoryRawClient['getCompare']).toBe('function');
    expect(typeof redisRawClient['defineCommand']).toBe('function');
    expect(typeof redisRawClient['getCompare']).toBe('function');
  });

  test('Type safety check', () => {
    // This test will fail at compile time if there are type mismatches
    const store = CacheStore.getInstance({
      type: 'memory',
      maxKeys: 100
    });

    // These should all return the correct Promise types
    const getResult: Promise<string | null> = store.get('test');
    const setResult: Promise<string> = store.set('test', 'value');
    const delResult: Promise<number> = store.del('test');
    const existsResult: Promise<number> = store.exists('test');
    const ttlResult: Promise<number> = store.ttl('test');
    const expireResult: Promise<number> = store.expire('test', 60);

    // Hash operations
    const hsetResult: Promise<number> = store.hset('hash', 'field', 'value');
    const hgetResult: Promise<string | null> = store.hget('hash', 'field');
    const hdelResult: Promise<number> = store.hdel('hash', 'field');

    // List operations  
    const lpushResult: Promise<number> = store.lpush('list', 'value');
    const llenResult: Promise<number> = store.llen('list');

    // Set operations
    const saddResult: Promise<number> = store.sadd('set', 'member');
    const scardResult: Promise<number> = store.scard('set');

    expect(getResult).toBeInstanceOf(Promise);
    expect(setResult).toBeInstanceOf(Promise);
    expect(delResult).toBeInstanceOf(Promise);
    expect(existsResult).toBeInstanceOf(Promise);
    expect(ttlResult).toBeInstanceOf(Promise);
    expect(expireResult).toBeInstanceOf(Promise);
    expect(hsetResult).toBeInstanceOf(Promise);
    expect(hgetResult).toBeInstanceOf(Promise);
    expect(hdelResult).toBeInstanceOf(Promise);
    expect(lpushResult).toBeInstanceOf(Promise);
    expect(llenResult).toBeInstanceOf(Promise);
    expect(saddResult).toBeInstanceOf(Promise);
    expect(scardResult).toBeInstanceOf(Promise);
  });
}); 