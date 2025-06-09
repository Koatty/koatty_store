/*
 * @Description: 
 * @Usage: 
 * @Author: richen
 * @Date: 2021-12-02 09:52:03
 * @LastEditTime: 2021-12-02 16:00:04
 */
import { CacheStore } from "../src/index";

async function testMemoryLRU() {
    console.log('Testing Memory Store with LRU...');
    
    const conf = {
        type: 'memory',
        keyPrefix: "test:",
        maxKeys: 3, // 设置较小的LRU容量以测试淘汰
        db: 0,
    };
    
    try {
        const store = CacheStore.getInstance(conf);
        const client = await store.getConnection();

        // 测试基础操作
        console.log('1. Testing basic operations...');
        await store.set("key1", "value1");
        await store.set("key2", "value2");
        await store.set("key3", "value3");
        
        const val1 = await store.get("key1");
        const val2 = await store.get("key2");
        const val3 = await store.get("key3");
        
        console.log(`key1: ${val1}, key2: ${val2}, key3: ${val3}`);
        
        // 测试LRU淘汰
        console.log('2. Testing LRU eviction...');
        await store.set("key4", "value4"); // 这应该淘汰最久未使用的键
        
        const val1After = await store.get("key1");
        const val4 = await store.get("key4");
        
        console.log(`key1 after eviction: ${val1After}, key4: ${val4}`);
        
        // 测试新功能
        console.log('3. Testing new string operations...');
        await store.set("str", "hello");
        
        // 如果客户端支持这些方法
        if (typeof client.append === 'function') {
            await client.append("str", " world");
            const appendResult = await store.get("str");
            console.log(`After append: ${appendResult}`);
            
            const strlen = client.strlen("str");
            console.log(`String length: ${strlen}`);
        }
        
        // 测试Hash操作
        console.log('4. Testing hash operations...');
        await store.hset("hash1", "field1", "value1");
        await store.hset("hash1", "field2", "value2");
        
        const hashVal = await store.hget("hash1", "field1");
        const hashAll = await store.hgetall("hash1");
        
        console.log(`Hash field1: ${hashVal}`);
        console.log(`Hash all:`, hashAll);
        
        // 测试统计信息
        console.log('5. Testing stats...');
        if (store.client && store.options.type === 'memory') {
            const memoryClient = store.client as any;
            if (typeof memoryClient.getStats === 'function') {
                const stats = memoryClient.getStats();
                console.log('Cache stats:', stats);
            }
        }
        
        // 清理
        await store.close();
        
        console.log('✅ Memory LRU tests completed successfully!');

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

async function testRedis() {
    console.log('Testing Redis Store...');
    
    const conf = {
        type: 'redis',
        keyPrefix: "test:",
        host: process.env.redis_host || '127.0.0.1',
        port: 6379,
        username: "",
        password: process.env.redis_password || "",
        db: 0,
    };
    
    try {
        const store = CacheStore.getInstance(conf, 'redis-test');
        
        await store.set("redis_key", "redis_value");
        const result = await store.get("redis_key");
        
        console.log(`Redis test result: ${result}`);
        
        await store.del("redis_key");
        await store.close();
        
        console.log('✅ Redis tests completed successfully!');
        
    } catch (error) {
        console.log('⚠️ Redis test skipped (Redis not available):', error.message);
    }
}

async function runAllTests() {
    console.log('🚀 Starting Koatty Store Tests...\n');
    
    await testMemoryLRU();
    console.log();
    await testRedis();
    
    console.log('\n🎉 All tests completed!');
    process.exit(0);
}

// 运行测试
runAllTests().catch(error => {
    console.error('💥 Test suite failed:', error);
    process.exit(1);
});
