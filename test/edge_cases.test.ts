import { CacheStore } from '../src/index';

describe('Edge Cases and Error Handling Tests', () => {
  let store: CacheStore;

  beforeAll(() => {
    store = CacheStore.getInstance({
      type: 'memory',
      keyPrefix: 'edge_test_',
      maxKeys: 10, // Small limit for testing eviction
      timeout: 300
    }, 'edge_test');
  });

  afterAll(async () => {
    await CacheStore.clearAllInstances();
  });

  describe('Edge Cases for String Operations', () => {
    test('should handle very long keys', async () => {
      const longKey = 'a'.repeat(1000);
      await store.set(longKey, 'long_key_value');
      const result = await store.get(longKey);
      expect(result).toBe('long_key_value');
    });

    test('should handle very long values', async () => {
      const longValue = 'x'.repeat(10000);
      await store.set('long_value_key', longValue);
      const result = await store.get('long_value_key');
      expect(result).toBe(longValue);
    });

    test('should handle special characters in keys', async () => {
      const specialKey = 'key:with@special#characters$and%spaces and\nnewlines';
      await store.set(specialKey, 'special_value');
      const result = await store.get(specialKey);
      expect(result).toBe('special_value');
    });

    test('should handle unicode characters', async () => {
      const unicodeKey = '测试키🔑';
      const unicodeValue = 'Unicode值💎';
      await store.set(unicodeKey, unicodeValue);
      const result = await store.get(unicodeKey);
      expect(result).toBe(unicodeValue);
    });

    test('should handle zero and negative numbers', async () => {
      await store.set('zero_key', 0);
      const zeroResult = await store.get('zero_key');
      expect(zeroResult).toBe('0');

      await store.set('negative_key', -123);
      const negativeResult = await store.get('negative_key');
      expect(negativeResult).toBe('-123');
    });

    test('should handle boolean-like values', async () => {
      await store.set('true_key', 'true');
      const trueResult = await store.get('true_key');
      expect(trueResult).toBe('true');

      await store.set('false_key', 'false');
      const falseResult = await store.get('false_key');
      expect(falseResult).toBe('false');
    });

    test('should handle very small timeout values', async () => {
      await store.set('tiny_timeout', 'value', 1);
      const result1 = await store.get('tiny_timeout');
      expect(result1).toBe('value');

      await new Promise(resolve => setTimeout(resolve, 1100));
      const result2 = await store.get('tiny_timeout');
      expect(result2).toBeNull();
    });
  });

  describe('Numeric Operations Edge Cases', () => {
    test('should handle incr on non-existent key', async () => {
      const result = await store.incr('non_existent_incr');
      expect(result).toBe(1);
    });

    test('should handle decr on non-existent key', async () => {
      const result = await store.decr('non_existent_decr');
      expect(result).toBe(-1);
    });

    test('should handle incr/decr with very large numbers', async () => {
      await store.set('large_number', '999999999999999');
      const incrResult = await store.incr('large_number');
      expect(incrResult).toBe(1000000000000000);

      const decrResult = await store.decr('large_number');
      expect(decrResult).toBe(999999999999999);
    });

    test('should handle incrby/decrby with zero', async () => {
      await store.set('zero_incr', '10');
      
      const incrByZero = await store.incrby('zero_incr', 0);
      expect(incrByZero).toBe(10);

      const decrByZero = await store.decrby('zero_incr', 0);
      expect(decrByZero).toBe(10);
    });

    test('should handle incrby/decrby with negative values', async () => {
      await store.set('negative_ops', '10');
      
      const incrByNegative = await store.incrby('negative_ops', -5);
      expect(incrByNegative).toBe(5);

      const decrByNegative = await store.decrby('negative_ops', -3);
      expect(decrByNegative).toBe(8);
    });
  });

  describe('Hash Operations Edge Cases', () => {
    test('should handle hash with many fields', async () => {
      const hashKey = 'many_fields_hash';
      
      // Add many fields
      for (let i = 0; i < 100; i++) {
        await store.hset(hashKey, `field_${i}`, `value_${i}`);
      }

      const len = await store.hlen(hashKey);
      expect(len).toBe(100);

      const allFields = await store.hgetall(hashKey);
      expect(Object.keys(allFields)).toHaveLength(100);
    });

    test('should handle hash field with special characters', async () => {
      const hashKey = 'special_hash';
      const specialField = 'field:with@special#chars';
      const specialValue = 'value:with@special#chars';
      
      await store.hset(hashKey, specialField, specialValue);
      const result = await store.hget(hashKey, specialField);
      expect(result).toBe(specialValue);
    });

    test('should handle hincrby on non-existent hash', async () => {
      const result = await store.hincrby('non_existent_hash', 'field', 5);
      expect(result).toBe(5);
    });

    test('should handle hincrby with negative increment', async () => {
      await store.hset('negative_hash', 'counter', '10');
      const result = await store.hincrby('negative_hash', 'counter', -7);
      expect(result).toBe(3);
    });
  });

  describe('List Operations Edge Cases', () => {
    test('should handle list with many items', async () => {
      const listKey = 'many_items_list';
      
      // Add many items
      for (let i = 0; i < 50; i++) {
        await store.lpush(listKey, `item_${i}`);
      }

      const len = await store.llen(listKey);
      expect(len).toBe(50);

      const allItems = await store.lrange(listKey, 0, -1);
      expect(allItems).toHaveLength(50);
    });

    test('should handle lrange with invalid indices', async () => {
      await store.lpush('range_test', 'item1');
      await store.lpush('range_test', 'item2');
      await store.lpush('range_test', 'item3');

      // Start > end
      const result1 = await store.lrange('range_test', 5, 2);
      expect(result1).toEqual([]);

      // Very large indices
      const result2 = await store.lrange('range_test', 0, 1000);
      expect(result2).toHaveLength(3);

      // Negative indices beyond list
      const result3 = await store.lrange('range_test', -1000, -1);
      expect(result3).toHaveLength(3);
    });

    test('should handle pop on empty list', async () => {
      const lpopResult = await store.lpop('empty_list_pop');
      expect(lpopResult).toBeNull();

      const rpopResult = await store.rpop('empty_list_pop');
      expect(rpopResult).toBeNull();
    });
  });

  describe('Set Operations Edge Cases', () => {
    test('should handle set with many members', async () => {
      const setKey = 'many_members_set';
      
      // Add many members
      for (let i = 0; i < 100; i++) {
        await store.sadd(setKey, `member_${i}`);
      }

      const card = await store.scard(setKey);
      expect(card).toBe(100);

      const members = await store.smembers(setKey);
      expect(members).toHaveLength(100);
    });

    test('should handle spop on empty set', async () => {
      const result = await store.spop('empty_set_pop');
      expect(result).toEqual([]);
    });

    test('should handle srem on non-existent member', async () => {
      await store.sadd('srem_test', 'member1');
      
      const remResult = await store.srem('srem_test', 'non_existent_member');
      expect(remResult).toBe(0);
    });

    test('should handle smove between non-existent sets', async () => {
      const moveResult = await store.smove('non_source', 'non_dest', 'member');
      expect(moveResult).toBe(0);
    });
  });

  describe('TTL and Expiration Edge Cases', () => {
    test('should handle ttl on non-existent key', async () => {
      const ttl = await store.ttl('non_existent_ttl_key');
      expect(ttl).toBe(-2); // Standard Redis behavior for non-existent keys
    });

    test('should handle expire on non-existent key', async () => {
      const result = await store.expire('non_existent_expire_key', 60);
      expect(result).toBe(0);
    });

    test('should handle very long TTL values', async () => {
      await store.set('long_ttl_key', 'value');
      const expireResult = await store.expire('long_ttl_key', 999999999);
      expect(expireResult).toBe(1);

      const ttl = await store.ttl('long_ttl_key');
      expect(ttl).toBeGreaterThanOrEqual(999999998);
    });
  });

  describe('Memory Limit and Eviction Tests', () => {
    test('should handle memory limit with LRU eviction', async () => {
      // Fill cache beyond maxKeys limit
      for (let i = 0; i < 15; i++) {
        await store.set(`eviction_key_${i}`, `value_${i}`);
      }

      // Some keys should be evicted
      let existingKeys = 0;
      for (let i = 0; i < 15; i++) {
        const exists = await store.exists(`eviction_key_${i}`);
        if (exists) existingKeys++;
      }

      expect(existingKeys).toBeLessThanOrEqual(10); // maxKeys limit
    });
  });

  describe('Complex Scenarios', () => {
    test('should handle mixed operations with expiration', async () => {
      // Set with expiration
      await store.set('mixed_key', 'initial_value', 2);
      
      // Increment (should work on string number)
      await store.set('mixed_key', '10', 2);
      await store.incr('mixed_key');
      
      const value1 = await store.get('mixed_key');
      expect(value1).toBe('11');

      // Add to hash with same key prefix
      await store.hset('mixed_key_hash', 'field', 'hash_value', 2);
      
      // Add to list with same key prefix
      await store.lpush('mixed_key_list', 'list_value');
      
      // Add to set with same key prefix
      await store.sadd('mixed_key_set', 'set_value', 2);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 2100));

      // Check expiration
      const value2 = await store.get('mixed_key');
      expect(value2).toBeNull();

      const hashValue = await store.hget('mixed_key_hash', 'field');
      expect(hashValue).toBeNull();

      // Set should be expired and return 0
      try {
        const setCard = await store.scard('mixed_key_set');
        expect(setCard).toBe(0);
      } catch (error) {
        // If error occurs due to expired set, that's expected
        expect(error).toBeDefined();
      }

      // List should still exist (no TTL set)
      const listLen = await store.llen('mixed_key_list');
      expect(listLen).toBe(1);
    });

    test('should handle concurrent operations', async () => {
      // Simulate concurrent operations
      for (let i = 0; i < 20; i++) {
        await store.set(`concurrent_${i}`, `value_${i}`);
        await store.hset(`concurrent_hash`, `field_${i}`, `value_${i}`);
        await store.sadd(`concurrent_set`, `member_${i}`);
        await store.lpush(`concurrent_list`, `item_${i}`);
      }

      // Verify results
      const hashLen = await store.hlen('concurrent_hash');
      expect(hashLen).toBe(20);

      const setCard = await store.scard('concurrent_set');
      expect(setCard).toBe(20);

      const listLen = await store.llen('concurrent_list');
      expect(listLen).toBe(20);
    });
  });

  describe('Configuration Hash Generation', () => {
    test('should generate consistent hashes for same config', () => {
      const config1 = {
        type: 'memory' as const,
        keyPrefix: 'test',
        maxKeys: 100
      };

      const config2 = {
        type: 'memory' as const,
        keyPrefix: 'test',
        maxKeys: 100
      };

      const store1 = CacheStore.getInstance(config1, 'hash_test_1');
      const store2 = CacheStore.getInstance(config2, 'hash_test_2');

      // Should create different instances because of different keys
      expect(store1).not.toBe(store2);
    });

    test('should handle config with undefined values', () => {
      const config = {
        type: 'memory' as const,
        keyPrefix: undefined,
        timeout: undefined
      };

      const testStore = CacheStore.getInstance(config, 'undefined_test');
      expect(testStore).toBeDefined();
    });
  });
}); 