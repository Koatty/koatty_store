/*
 * @Description: Test for concurrent operations
 * @Usage: 
 * @Author: richen
 * @Date: 2024-12-XX
 */
import { MemoryCache } from "../src/store/memory_cache";

describe('Concurrent operations', () => {
  test('incr should be atomic', async () => {
    const cache = new MemoryCache({ database: 0 });
    cache.set('counter', '0');
    
    const promises = [];
    for (let i = 0; i < 100; i++) {
      promises.push(cache.incr('counter'));
    }
    
    await Promise.all(promises);
    const result = cache.get('counter');
    expect(result).toBe('100');
  });

  test('decr should be atomic', async () => {
    const cache = new MemoryCache({ database: 0 });
    cache.set('counter', '100');
    
    const promises = [];
    for (let i = 0; i < 50; i++) {
      promises.push(cache.decr('counter'));
    }
    
    await Promise.all(promises);
    const result = cache.get('counter');
    expect(result).toBe('50');
  });

  test('incrby should be atomic', async () => {
    const cache = new MemoryCache({ database: 0 });
    cache.set('counter', '0');
    
    const promises = [];
    for (let i = 0; i < 50; i++) {
      promises.push(cache.incrby('counter', 2));
    }
    
    await Promise.all(promises);
    const result = cache.get('counter');
    expect(result).toBe('100');
  });

  test('decrby should be atomic', async () => {
    const cache = new MemoryCache({ database: 0 });
    cache.set('counter', '100');
    
    const promises = [];
    for (let i = 0; i < 20; i++) {
      promises.push(cache.decrby('counter', 3));
    }
    
    await Promise.all(promises);
    const result = cache.get('counter');
    expect(result).toBe('40');
  });

  test('hincrby should be atomic', async () => {
    const cache = new MemoryCache({ database: 0 });
    cache.hset('hash', 'field', '0');
    
    const promises = [];
    for (let i = 0; i < 100; i++) {
      promises.push(cache.hincrby('hash', 'field', 1));
    }
    
    await Promise.all(promises);
    const result = cache.hget('hash', 'field');
    expect(result).toBe('100');
  });

  test('mixed operations should be safe', async () => {
    const cache = new MemoryCache({ database: 0 });
    cache.set('key1', '0');
    cache.set('key2', '0');
    
    const promises = [];
    for (let i = 0; i < 50; i++) {
      promises.push(cache.incr('key1'));
      promises.push(cache.incr('key2'));
    }
    
    await Promise.all(promises);
    expect(cache.get('key1')).toBe('50');
    expect(cache.get('key2')).toBe('50');
  });
});

