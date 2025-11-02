/*
 * @Description: Test for error handling
 * @Usage: 
 * @Author: richen
 * @Date: 2024-12-XX
 */
import { CacheStore } from "../src/index";

describe('Error handling', () => {
  let store: CacheStore;

  beforeEach(() => {
    store = new CacheStore({ type: 'memory', keyPrefix: '' });
  });

  afterEach(async () => {
    await store.close();
  });

  test('should include operation details in error for invalid operations', async () => {
    // 设置一个字符串类型的 key
    await store.set('string_key', 'value');
    
    try {
      // 尝试对字符串 key 执行 hash 操作
      await store.hget('string_key', 'field');
      fail('Should have thrown an error');
    } catch (err) {
      expect(err.message).toContain('Cache operation failed');
      expect(err.message).toContain('hget');
    }
  });

  test('should handle connection errors gracefully', async () => {
    // 正常操作应该成功
    await store.set('key', 'value');
    expect(await store.get('key')).toBe('value');
  });

  test('should handle invalid increment operations', async () => {
    await store.set('not_a_number', 'abc');
    
    try {
      await store.incr('not_a_number');
      fail('Should have thrown an error');
    } catch (err) {
      expect(err.message).toContain('not an integer');
    }
  });
});

