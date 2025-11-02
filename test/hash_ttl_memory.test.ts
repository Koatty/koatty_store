/*
 * @Description: Test for Hash TTL in MemoryCache
 * @Usage: 
 * @Author: richen
 * @Date: 2024-12-XX
 */
import { MemoryCache } from "../src/store/memory_cache";

describe('Hash TTL in MemoryCache', () => {
  test('should expire hash field after timeout', async () => {
    const cache = new MemoryCache({ database: 0 });
    
    cache.hset('hash', 'field1', 'value1', 1); // 1秒过期
    expect(cache.hget('hash', 'field1')).toBe('value1');
    
    await new Promise(resolve => setTimeout(resolve, 1100));
    expect(cache.hget('hash', 'field1')).toBeNull();
    expect(cache.hexists('hash', 'field1')).toBe(0);
  });
  
  test('should not affect other fields', () => {
    const cache = new MemoryCache({ database: 0 });
    
    cache.hset('hash', 'field1', 'value1', 1);
    cache.hset('hash', 'field2', 'value2'); // 不过期
    
    expect(cache.hget('hash', 'field2')).toBe('value2');
  });

  test('should clean up TTL record on hdel', () => {
    const cache = new MemoryCache({ database: 0 });
    
    cache.hset('hash', 'field1', 'value1', 10);
    expect(cache.hget('hash', 'field1')).toBe('value1');
    
    cache.hdel('hash', 'field1');
    expect(cache.hget('hash', 'field1')).toBeNull();
    expect(cache.hexists('hash', 'field1')).toBe(0);
  });

  test('should handle hash without TTL', () => {
    const cache = new MemoryCache({ database: 0 });
    
    cache.hset('hash', 'field1', 'value1'); // 没有TTL
    expect(cache.hget('hash', 'field1')).toBe('value1');
    expect(cache.hexists('hash', 'field1')).toBe(1);
  });
});

