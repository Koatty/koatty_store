/*
 * @Description: Test for Hash TTL in CacheStore
 * @Usage: 
 * @Author: richen
 * @Date: 2024-12-XX
 */
import { CacheStore } from "../src/index";

describe('Hash TTL in CacheStore', () => {
  let store: CacheStore;

  beforeEach(() => {
    store = new CacheStore({ type: 'memory', keyPrefix: '' });
  });

  afterEach(async () => {
    await store.close();
  });

  test('should work with MemoryStore', async () => {
    await store.hset('hash', 'field1', 'value1', 1);
    expect(await store.hget('hash', 'field1')).toBe('value1');
    
    await new Promise(resolve => setTimeout(resolve, 1100));
    expect(await store.hget('hash', 'field1')).toBeNull();
  });

  test('should support hexists with TTL', async () => {
    await store.hset('hash', 'field1', 'value1', 1);
    expect(await store.hexists('hash', 'field1')).toBe(1);
    
    await new Promise(resolve => setTimeout(resolve, 1100));
    expect(await store.hexists('hash', 'field1')).toBe(0);
  });

  test('should clean up properly with hdel', async () => {
    await store.hset('hash', 'field1', 'value1', 10);
    expect(await store.hget('hash', 'field1')).toBe('value1');
    
    await store.hdel('hash', 'field1');
    expect(await store.hget('hash', 'field1')).toBeNull();
    expect(await store.hexists('hash', 'field1')).toBe(0);
  });

  test('should work without TTL', async () => {
    await store.hset('hash', 'field1', 'value1');
    expect(await store.hget('hash', 'field1')).toBe('value1');
    expect(await store.hexists('hash', 'field1')).toBe(1);
  });
});

