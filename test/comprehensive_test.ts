/*
 * @Description: 全面的功能测试套件
 * @Usage: 
 * @Author: richen
 * @Date: 2024-06-09 12:00:00
 */
import { MemoryStore } from "../src/store/memory";
import { MemoryCache } from "../src/store/memory_cache";
import { CacheStore } from "../src/index";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

class TestSuite {
  public results: TestResult[] = [];

  async runTest(name: string, testFn: () => Promise<void> | void): Promise<void> {
    try {
      await testFn();
      this.results.push({ name, passed: true });
      console.log(`✅ ${name}`);
    } catch (error) {
      this.results.push({ name, passed: false, error: error.message });
      console.log(`❌ ${name}: ${error.message}`);
    }
  }

  printSummary(): void {
    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    console.log(`\n📊 测试总结: ${passed}/${total} 通过`);
    
    if (passed < total) {
      console.log('\n失败的测试:');
      this.results.filter(r => !r.passed).forEach(r => {
        console.log(`  - ${r.name}: ${r.error}`);
      });
    }
  }
}

async function runComprehensiveTests() {
  console.log('🚀 开始全面功能测试...\n');
  const suite = new TestSuite();

  // 1. LRU缓存基础功能测试
  await suite.runTest('LRU基础功能', async () => {
    const cache = new MemoryCache({ database: 0, maxKeys: 3 });
    
    cache.set("a", "1");
    cache.set("b", "2");
    cache.set("c", "3");
    
    // 访问a，使其成为最近使用
    cache.get("a");
    
    // 添加新键，应该淘汰b（最久未使用）
    cache.set("d", "4");
    
    if (cache.get("b") !== null) throw new Error("LRU淘汰失败");
    if (cache.get("a") !== "1") throw new Error("LRU保留失败");
    if (cache.get("d") !== "4") throw new Error("新键添加失败");
  });

  // 2. TTL过期测试
  await suite.runTest('TTL过期功能', async () => {
    const cache = new MemoryCache({ database: 0, ttlCheckInterval: 100 });
    
    cache.set("temp", "value", "EX", "1");
    if (cache.get("temp") !== "value") throw new Error("TTL设置失败");
    
    await new Promise(resolve => setTimeout(resolve, 1100));
    if (cache.get("temp") !== null) throw new Error("TTL过期失败");
  });

  // 3. 字符串操作测试
  await suite.runTest('字符串操作', () => {
    const cache = new MemoryCache({ database: 0 });
    
    cache.set("str", "hello");
    
    // 测试append
    const newLen = cache.append("str", " world");
    if (newLen !== 11) throw new Error("append返回长度错误");
    if (cache.get("str") !== "hello world") throw new Error("append结果错误");
    
    // 测试strlen
    const len = cache.strlen("str");
    if (len !== 11) throw new Error("strlen错误");
    
    // 测试getrange
    const substr = cache.getrange("str", 0, 4);
    if (substr !== "hello") throw new Error("getrange错误");
    
    // 测试setrange
    cache.setrange("str", 6, "WORLD");
    if (cache.get("str") !== "hello WORLD") throw new Error("setrange错误");
  });

  // 4. 批量操作测试
  await suite.runTest('批量操作', () => {
    const cache = new MemoryCache({ database: 0 });
    
    // 测试mset
    cache.mset("k1", "v1", "k2", "v2", "k3", "v3");
    
    // 测试mget
    const values = cache.mget("k1", "k2", "k3", "k4");
    if (JSON.stringify(values) !== JSON.stringify(["v1", "v2", "v3", null])) {
      throw new Error("批量操作结果错误");
    }
  });

  // 5. Hash操作测试
  await suite.runTest('Hash操作', () => {
    const cache = new MemoryCache({ database: 0 });
    
    cache.hset("hash", "field1", "value1");
    cache.hset("hash", "field2", "value2");
    
    if (cache.hget("hash", "field1") !== "value1") throw new Error("hget错误");
    if (cache.hlen("hash") !== 2) throw new Error("hlen错误");
    if (!cache.hexists("hash", "field1")) throw new Error("hexists错误");
    
    const all = cache.hgetall("hash");
    if (all.field1 !== "value1" || all.field2 !== "value2") {
      throw new Error("hgetall错误");
    }
    
    cache.hdel("hash", "field1");
    if (cache.hexists("hash", "field1")) throw new Error("hdel错误");
  });

  // 6. List操作测试
  await suite.runTest('List操作', () => {
    const cache = new MemoryCache({ database: 0 });
    
    cache.lpush("list", "item1");
    cache.lpush("list", "item2");
    cache.rpush("list", "item3");
    
    if (cache.llen("list") !== 3) throw new Error("llen错误");
    if (cache.lindex("list", 0) !== "item2") throw new Error("lindex错误");
    
    const range = cache.lrange("list", 0, -1);
    if (JSON.stringify(range) !== JSON.stringify(["item2", "item1", "item3"])) {
      throw new Error("lrange错误");
    }
    
    const popped = cache.lpop("list");
    if (popped !== "item2") throw new Error("lpop错误");
    if (cache.llen("list") !== 2) throw new Error("lpop后长度错误");
  });

  // 7. Set操作测试
  await suite.runTest('Set操作', () => {
    const cache = new MemoryCache({ database: 0 });
    
    cache.sadd("set", "member1", "member2", "member3");
    
    if (cache.scard("set") !== 3) throw new Error("scard错误");
    if (!cache.sismember("set", "member1")) throw new Error("sismember错误");
    
    const members = cache.smembers("set");
    if (members.length !== 3) throw new Error("smembers错误");
    
    cache.srem("set", "member1");
    if (cache.scard("set") !== 2) throw new Error("srem错误");
  });

  // 8. Sorted Set操作测试
  await suite.runTest('Sorted Set操作', () => {
    const cache = new MemoryCache({ database: 0 });
    
    cache.zadd("zset", 1, "one");
    cache.zadd("zset", 3, "three");
    cache.zadd("zset", 2, "two");
    
    if (cache.zcard("zset") !== 3) throw new Error("zcard错误");
    if (cache.zscore("zset", "two") !== 2) throw new Error("zscore错误");
    
    const range = cache.zrange("zset", 0, -1);
    if (JSON.stringify(range) !== JSON.stringify(["one", "two", "three"])) {
      throw new Error("zrange排序错误");
    }
    
    cache.zrem("zset", "two");
    if (cache.zcard("zset") !== 2) throw new Error("zrem错误");
  });

  // 9. 键管理操作测试
  await suite.runTest('键管理操作', () => {
    const cache = new MemoryCache({ database: 0 });
    
    cache.set("test1", "value1");
    cache.set("test2", "value2");
    cache.set("other", "value3");
    
    // 测试keys模式匹配
    const testKeys = cache.keys("test*");
    if (testKeys.length !== 2) throw new Error("keys模式匹配错误");
    
    // 测试rename
    cache.rename("test1", "renamed");
    if (cache.get("test1") !== null) throw new Error("rename原键未删除");
    if (cache.get("renamed") !== "value1") throw new Error("rename新键错误");
    
    // 测试type
    cache.hset("hash_key", "field", "value");
    if (cache.type("renamed") !== "string") throw new Error("type检测错误");
    if (cache.type("hash_key") !== "hash") throw new Error("hash type检测错误");
    
    // 测试exists
    if (cache.exists("renamed", "test2", "nonexistent") !== 2) {
      throw new Error("exists计数错误");
    }
  });

  // 10. 数据库操作测试
  await suite.runTest('数据库操作', () => {
    const cache = new MemoryCache({ database: 0 });
    
    cache.set("key1", "value1");
    cache.set("key2", "value2");
    
    if (cache.dbsize() !== 2) throw new Error("dbsize错误");
    
    cache.flushdb();
    if (cache.dbsize() !== 0) throw new Error("flushdb错误");
  });

  // 11. 数值操作测试
  await suite.runTest('数值操作', () => {
    const cache = new MemoryCache({ database: 0 });
    
    cache.set("counter", "10");
    
    if (cache.incr("counter") !== 11) throw new Error("incr错误");
    if (cache.incrby("counter", 5) !== 16) throw new Error("incrby错误");
    if (cache.decr("counter") !== 15) throw new Error("decr错误");
    if (cache.decrby("counter", 3) !== 12) throw new Error("decrby错误");
    
    // 测试hash字段数值操作
    cache.hset("hash", "num", "100");
    if (cache.hincrby("hash", "num", 50) !== 150) throw new Error("hincrby错误");
  });

  // 12. MemoryStore包装器测试
  await suite.runTest('MemoryStore包装器', () => {
    const store = new MemoryStore({
      type: 'memory',
      keyPrefix: "prefix:",
      maxKeys: 100,
      db: 1,
    });
    
    const client = store.getConnection();
    client.set("test", "value");
    
    if (client.get("test") !== "value") throw new Error("MemoryStore基础操作错误");
    
    const stats = store.getStats();
    if (typeof stats.keys !== 'number') throw new Error("统计信息错误");
  });

  // 13. CacheStore工厂测试
  await suite.runTest('CacheStore工厂', () => {
    const store = CacheStore.getInstance({
      type: 'memory',
      keyPrefix: "factory:",
      maxKeys: 50,
      db: 2,
    });
    
    if (!store) throw new Error("CacheStore工厂创建失败");
    
    // 测试单例模式
    const store2 = CacheStore.getInstance({
      type: 'memory',
      keyPrefix: "factory:",
      maxKeys: 50,
      db: 2,
    });
    
    if (store !== store2) throw new Error("单例模式失败");
  });

  // 14. 错误处理测试
  await suite.runTest('错误处理', () => {
    const cache = new MemoryCache({ database: 0 });
    
    cache.set("string_key", "value");
    
    try {
      cache.hget("string_key", "field");
      throw new Error("应该抛出类型错误");
    } catch (error) {
      if (!error.message.includes("WRONGTYPE")) {
        throw new Error("错误类型不正确");
      }
    }
    
    try {
      cache.incr("string_key");
      throw new Error("应该抛出数值错误");
    } catch (error) {
      if (!error.message.includes("not an integer")) {
        throw new Error("数值错误类型不正确");
      }
    }
  });

  // 15. 内存使用和性能测试
  await suite.runTest('内存使用和性能', () => {
    const cache = new MemoryCache({ database: 0, maxKeys: 1000 });
    
    // 批量插入数据
    const start = Date.now();
    for (let i = 0; i < 1000; i++) {
      cache.set(`key${i}`, `value${i}`);
    }
    const insertTime = Date.now() - start;
    
    if (insertTime > 1000) throw new Error("插入性能过慢");
    
    // 测试内存统计
    const stats = cache.info();
    if (stats.keys !== 1000) throw new Error("键计数错误");
    if (stats.memory <= 0) throw new Error("内存统计错误");
    
    // 批量读取测试
    const readStart = Date.now();
    for (let i = 0; i < 1000; i++) {
      const value = cache.get(`key${i}`);
      if (value !== `value${i}`) throw new Error("批量读取错误");
    }
    const readTime = Date.now() - readStart;
    
    if (readTime > 500) throw new Error("读取性能过慢");
  });

  suite.printSummary();
  
  const passed = suite.results.filter(r => r.passed).length;
  const total = suite.results.length;
  
  if (passed === total) {
    console.log('\n🎉 所有测试通过！新功能运行正常。');
    return true;
  } else {
    console.log('\n⚠️ 部分测试失败，需要修复。');
    return false;
  }
}

// 运行测试
runComprehensiveTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('💥 测试套件执行失败:', error);
  process.exit(1);
}); 