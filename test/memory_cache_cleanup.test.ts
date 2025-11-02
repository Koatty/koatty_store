/*
 * @Description: Test for MemoryCache cleanup
 * @Usage: 
 * @Author: richen
 * @Date: 2024-12-XX
 */
import { MemoryCache } from "../src/store/memory_cache";

describe('MemoryCache cleanup', () => {
  test('should cleanup all resources on quit', () => {
    const cache = new MemoryCache({ database: 0 });
    cache.set('key', 'value');
    
    cache.quit();
    
    // 验证定时器已清理
    expect(cache['ttlCheckTimer']).toBeNull();
  });

  test('should cleanup databases on quit', () => {
    const cache = new MemoryCache({ database: 0 });
    cache.set('key', 'value');
    cache.select(1);
    cache.set('key2', 'value2');
    
    expect(cache['databases'].size).toBeGreaterThan(0);
    
    cache.quit();
    
    // 验证数据库已清理
    expect(cache['databases'].size).toBe(0);
  });

  test('should work properly with end method', () => {
    const cache = new MemoryCache({ database: 0 });
    cache.set('key', 'value');
    
    cache.end();
    
    // 验证资源已清理
    expect(cache['ttlCheckTimer']).toBeNull();
  });
});

