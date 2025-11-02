/*
 * @Description: Test for simplified MemoryStore connection
 * @Usage: 
 * @Author: richen
 * @Date: 2024-12-XX
 */
import { MemoryStore } from "../src/store/memory";
import { MemoryCache } from "../src/store/memory_cache";

describe('MemoryStore simplified connection', () => {
  test('should return MemoryCache instance directly', () => {
    const store = new MemoryStore({ type: 'memory' });
    const conn = store.getConnection();
    
    expect(conn).toBeInstanceOf(MemoryCache);
    expect(conn).toBe(store.getConnection()); // 应该返回同一个实例
  });
  
  test('should close properly', async () => {
    const store = new MemoryStore({ type: 'memory' });
    await store.close();
    // 应该能够正常关闭
  });

  test('should work normally', () => {
    const store = new MemoryStore({ type: 'memory', keyPrefix: 'test:' });
    const conn = store.getConnection();
    
    conn.set('key', 'value');
    expect(conn.get('key')).toBe('value');
  });
});

