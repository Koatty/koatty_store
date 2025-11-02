/*
 * @Description: Test for lrange fix
 * @Usage: 
 * @Author: richen
 * @Date: 2024-12-XX
 */
import { MemoryCache } from "../src/store/memory_cache";

describe('lrange fix', () => {
  test('should return complete range', () => {
    const cache = new MemoryCache({ database: 0 });
    cache.rpush('test', 'a');
    cache.rpush('test', 'b');
    cache.rpush('test', 'c');
    cache.rpush('test', 'd');
    
    const result = cache.lrange('test', 0, 2);
    expect(result).toEqual(['a', 'b', 'c']); // 应该是 3 个元素
    
    const result2 = cache.lrange('test', 1, 3);
    expect(result2).toEqual(['b', 'c', 'd']); // 应该是 3 个元素
  });

  test('should handle edge cases', () => {
    const cache = new MemoryCache({ database: 0 });
    cache.rpush('test', '1');
    cache.rpush('test', '2');
    cache.rpush('test', '3');
    
    // 全范围
    const result1 = cache.lrange('test', 0, 2);
    expect(result1).toEqual(['1', '2', '3']);
    
    // 单个元素
    const result2 = cache.lrange('test', 1, 1);
    expect(result2).toEqual(['2']);
    
    // 负索引
    const result3 = cache.lrange('test', -2, -1);
    expect(result3).toEqual(['2', '3']);
  });
});

