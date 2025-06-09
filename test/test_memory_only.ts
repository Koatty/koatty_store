/*
 * @Description: Memory Store LRU测试
 * @Usage: 
 * @Author: richen
 * @Date: 2024-06-09 11:35:00
 */
import { MemoryStore } from "../src/store/memory";
import { MemoryCache } from "../src/store/memory_cache";

async function testMemoryLRU() {
    console.log('🚀 Testing Memory Store with LRU...');
    
    try {
        // 直接测试MemoryCache
        console.log('\n1. Testing MemoryCache directly...');
        const cache = new MemoryCache({
            database: 0,
            maxKeys: 3, // 设置较小的LRU容量以测试淘汰
            ttlCheckInterval: 1000
        });
        
        // 基础设置和获取
        console.log('Setting key1, key2, key3...');
        cache.set("key1", "value1");
        cache.set("key2", "value2");
        cache.set("key3", "value3");
        
        console.log(`key1: ${cache.get("key1")}`);
        console.log(`key2: ${cache.get("key2")}`);
        console.log(`key3: ${cache.get("key3")}`);
        
        // 测试LRU淘汰
        console.log('\n2. Testing LRU eviction...');
        cache.set("key4", "value4"); // 这应该淘汰最久未使用的键
        
        const key1After = cache.get("key1");
        const key4 = cache.get("key4");
        
        console.log(`key1 after eviction: ${key1After}`);
        console.log(`key4: ${key4}`);
        
        // 测试TTL
        console.log('\n3. Testing TTL...');
        cache.set("ttl_key", "ttl_value", "EX", "2"); // 2秒TTL
        console.log(`ttl_key (immediately): ${cache.get("ttl_key")}`);
        
        // 等待TTL过期
        await new Promise(resolve => setTimeout(resolve, 2100));
        console.log(`ttl_key (after 2s): ${cache.get("ttl_key")}`);
        
        // 测试Hash操作
        console.log('\n4. Testing hash operations...');
        cache.hset("hash1", "field1", "value1");
        cache.hset("hash1", "field2", "value2");
        
        const hashVal = cache.hget("hash1", "field1");
        const hashAll = cache.hgetall("hash1");
        
        console.log(`Hash field1: ${hashVal}`);
        console.log(`Hash all:`, hashAll);
        
        // 测试List操作
        console.log('\n5. Testing list operations...');
        cache.lpush("list1", "item1");
        cache.lpush("list1", "item2");
        cache.rpush("list1", "item3");
        
        const listLen = cache.llen("list1");
        const listItem = cache.lindex("list1", 0);
        
        console.log(`List length: ${listLen}`);
        console.log(`List item at index 0: ${listItem}`);
        
        // 测试新增的字符串操作
        console.log('\n6. Testing string operations...');
        cache.set("str", "hello");
        const appendResult = cache.append("str", " world");
        const finalStr = cache.get("str");
        const strLen = cache.strlen("str");
        
        console.log(`After append: ${finalStr} (length: ${strLen})`);
        
        // 测试批量操作
        console.log('\n7. Testing batch operations...');
        cache.mset("batch1", "val1", "batch2", "val2", "batch3", "val3");
        const batchResults = cache.mget("batch1", "batch2", "batch3", "nonexistent");
        console.log(`Batch results:`, batchResults);
        
        // 测试模式匹配
        console.log('\n8. Testing pattern matching...');
        const allKeys = cache.keys();
        const batchKeys = cache.keys("batch*");
        console.log(`All keys: ${allKeys.length} keys`);
        console.log(`Batch keys:`, batchKeys);
        
        // 测试统计信息
        console.log('\n9. Testing stats...');
        const stats = cache.info();
        console.log('Cache stats:', {
            keys: stats.keys,
            memory: Math.round(stats.memory / 1024) + 'KB',
            hits: stats.hits,
            misses: stats.misses,
            hitRate: ((stats.hits / (stats.hits + stats.misses)) * 100).toFixed(2) + '%'
        });
        
        // 测试MemoryStore包装
        console.log('\n10. Testing MemoryStore wrapper...');
        const store = new MemoryStore({
            type: 'memory',
            keyPrefix: "test:",
            maxKeys: 5,
            db: 0,
        });
        
        const client = store.getConnection();
        client.set("store_key", "store_value");
        const storeResult = client.get("store_key");
        console.log(`MemoryStore result: ${storeResult}`);
        
        console.log('\n✅ All Memory LRU tests completed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

// 运行测试
testMemoryLRU().then(() => {
    console.log('\n🎉 Memory tests finished!');
    process.exit(0);
}).catch(error => {
    console.error('💥 Test suite failed:', error);
    process.exit(1);
}); 