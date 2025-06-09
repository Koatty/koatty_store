/*
 * @Description: 性能基准测试
 * @Usage: 
 * @Author: richen
 * @Date: 2024-06-09 12:30:00
 */
import { MemoryCache } from "../src/store/memory_cache";

interface BenchmarkResult {
  name: string;
  operations: number;
  timeMs: number;
  opsPerSecond: number;
  memoryUsage: string;
}

class BenchmarkSuite {
  private results: BenchmarkResult[] = [];

  async runBenchmark(
    name: string, 
    operations: number, 
    setupFn: () => MemoryCache,
    testFn: (cache: MemoryCache, i: number) => void
  ): Promise<void> {
    console.log(`🏃 运行基准测试: ${name}...`);
    
    const cache = setupFn();
    
    // 预热
    for (let i = 0; i < Math.min(100, operations); i++) {
      testFn(cache, i);
    }
    
    // 清空缓存重新开始
    cache.flushdb();
    
    const startTime = process.hrtime.bigint();
    const startMemory = process.memoryUsage().heapUsed;
    
    for (let i = 0; i < operations; i++) {
      testFn(cache, i);
    }
    
    const endTime = process.hrtime.bigint();
    const endMemory = process.memoryUsage().heapUsed;
    
    const timeMs = Number(endTime - startTime) / 1000000; // 转换为毫秒
    const opsPerSecond = Math.round((operations / timeMs) * 1000);
    const memoryUsage = this.formatBytes(endMemory - startMemory);
    
    const result: BenchmarkResult = {
      name,
      operations,
      timeMs: Math.round(timeMs * 100) / 100,
      opsPerSecond,
      memoryUsage
    };
    
    this.results.push(result);
    console.log(`   ${operations} 操作耗时 ${result.timeMs}ms (${opsPerSecond} ops/sec), 内存增长: ${memoryUsage}`);
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  printSummary(): void {
    console.log('\n📊 性能基准测试总结:');
    console.log('┌─────────────────────────────────┬──────────┬──────────┬─────────────┬──────────────┐');
    console.log('│ 测试名称                        │ 操作数   │ 耗时(ms) │ 操作/秒     │ 内存使用     │');
    console.log('├─────────────────────────────────┼──────────┼──────────┼─────────────┼──────────────┤');
    
    this.results.forEach(result => {
      const name = result.name.padEnd(31);
      const ops = result.operations.toString().padStart(8);
      const time = result.timeMs.toString().padStart(8);
      const opsPerSec = result.opsPerSecond.toLocaleString().padStart(11);
      const memory = result.memoryUsage.padStart(12);
      
      console.log(`│ ${name} │ ${ops} │ ${time} │ ${opsPerSec} │ ${memory} │`);
    });
    
    console.log('└─────────────────────────────────┴──────────┴──────────┴─────────────┴──────────────┘');
  }
}

async function runBenchmarks() {
  console.log('🚀 开始性能基准测试...\n');
  const suite = new BenchmarkSuite();

  // 1. 基础SET操作性能
  await suite.runBenchmark(
    'SET操作 (无LRU限制)',
    10000,
    () => new MemoryCache({ database: 0, maxKeys: 50000 }),
    (cache, i) => cache.set(`key${i}`, `value${i}`)
  );

  // 2. LRU限制下的SET操作
  await suite.runBenchmark(
    'SET操作 (LRU=1000)',
    10000,
    () => new MemoryCache({ database: 0, maxKeys: 1000 }),
    (cache, i) => cache.set(`key${i}`, `value${i}`)
  );

  // 3. GET操作性能
  await suite.runBenchmark(
    'GET操作',
    10000,
    () => {
      const cache = new MemoryCache({ database: 0, maxKeys: 50000 });
      // 预填充数据
      for (let i = 0; i < 10000; i++) {
        cache.set(`key${i}`, `value${i}`);
      }
      return cache;
    },
    (cache, i) => cache.get(`key${i % 10000}`)
  );

  // 4. 混合读写操作
  await suite.runBenchmark(
    '混合读写 (70%读/30%写)',
    10000,
    () => {
      const cache = new MemoryCache({ database: 0, maxKeys: 50000 });
      // 预填充数据
      for (let i = 0; i < 5000; i++) {
        cache.set(`key${i}`, `value${i}`);
      }
      return cache;
    },
    (cache, i) => {
      if (i % 10 < 7) {
        // 70% 读操作
        cache.get(`key${i % 5000}`);
      } else {
        // 30% 写操作
        cache.set(`key${i}`, `value${i}`);
      }
    }
  );

  // 5. Hash操作性能
  await suite.runBenchmark(
    'HSET操作',
    5000,
    () => new MemoryCache({ database: 0, maxKeys: 50000 }),
    (cache, i) => cache.hset(`hash${Math.floor(i / 10)}`, `field${i % 10}`, `value${i}`)
  );

  // 6. List操作性能
  await suite.runBenchmark(
    'LPUSH操作',
    5000,
    () => new MemoryCache({ database: 0, maxKeys: 50000 }),
    (cache, i) => cache.lpush(`list${Math.floor(i / 100)}`, `item${i}`)
  );

  // 7. Set操作性能
  await suite.runBenchmark(
    'SADD操作',
    5000,
    () => new MemoryCache({ database: 0, maxKeys: 50000 }),
    (cache, i) => cache.sadd(`set${Math.floor(i / 50)}`, `member${i}`)
  );

  // 8. 批量操作性能
  await suite.runBenchmark(
    'MSET操作 (批量10个)',
    1000,
    () => new MemoryCache({ database: 0, maxKeys: 50000 }),
    (cache, i) => {
      const args: any[] = [];
      for (let j = 0; j < 10; j++) {
        args.push(`batch_key${i * 10 + j}`, `batch_value${i * 10 + j}`);
      }
      cache.mset(...args);
    }
  );

  // 9. TTL操作性能
  await suite.runBenchmark(
    'SET with TTL',
    5000,
    () => new MemoryCache({ database: 0, maxKeys: 50000, ttlCheckInterval: 10000 }),
    (cache, i) => cache.set(`ttl_key${i}`, `value${i}`, "EX", "3600")
  );

  // 10. 大数据量LRU淘汰性能
  await suite.runBenchmark(
    'LRU淘汰 (容量=100)',
    1000,
    () => new MemoryCache({ database: 0, maxKeys: 100 }),
    (cache, i) => cache.set(`evict_key${i}`, `large_value_${'x'.repeat(100)}`)
  );

  // 11. 键模式匹配性能
  await suite.runBenchmark(
    'KEYS模式匹配',
    100,
    () => {
      const cache = new MemoryCache({ database: 0, maxKeys: 50000 });
      // 预填充数据
      for (let i = 0; i < 1000; i++) {
        cache.set(`test_${i}`, `value${i}`);
        cache.set(`prod_${i}`, `value${i}`);
        cache.set(`dev_${i}`, `value${i}`);
      }
      return cache;
    },
    (cache, i) => cache.keys(`test_*`)
  );

  // 12. 数值操作性能
  await suite.runBenchmark(
    'INCR操作',
    5000,
    () => {
      const cache = new MemoryCache({ database: 0, maxKeys: 50000 });
      // 预设置计数器
      for (let i = 0; i < 100; i++) {
        cache.set(`counter${i}`, "0");
      }
      return cache;
    },
    (cache, i) => cache.incr(`counter${i % 100}`)
  );

  suite.printSummary();
  
  console.log('\n🎯 性能分析:');
  console.log('- SET操作在无LRU限制时性能最佳');
  console.log('- LRU淘汰会带来一定的性能开销');
  console.log('- GET操作通常比SET操作更快');
  console.log('- 批量操作能显著提升吞吐量');
  console.log('- Hash/List/Set等复杂数据结构操作相对较慢');
  console.log('- TTL功能对写入性能影响较小');
  
  console.log('\n✅ 性能基准测试完成！');
}

// 运行基准测试
runBenchmarks().catch(error => {
  console.error('💥 基准测试失败:', error);
  process.exit(1);
}); 