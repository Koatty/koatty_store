/*
 * @Description: 
 * @Usage: 
 * @Author: richen
 * @Date: 2021-12-02 15:26:55
 * @LastEditTime: 2024-11-07 14:27:25
 */
import { MemoryStore, MemoryStoreOpt } from "./store/memory";
import { RedisStore, RedisStoreOpt } from "./store/redis";
import { CacheStoreInterface } from "./store/interface";

export type StoreOptions = MemoryStoreOpt | RedisStoreOpt;

const defaultOptions = {
  type: 'memory', // memory | redis
  host: '',
  port: 0,
  keyPrefix: 'Koatty',
  timeout: 600,
  poolSize: 10,
  connectTimeout: 500,
  db: 0
};
/**
 *
 *
 * @export
 * @class Store
 */
export class CacheStore implements CacheStoreInterface {
  client: MemoryStore | RedisStore;
  options: StoreOptions;
  private static instances: Map<string, CacheStore> = new Map();

  /**
   * Creates an instance of CacheStore.
   * @param {StoreOptions} options
   * @memberof CacheStore
   */
  constructor(options?: StoreOptions) {
    this.options = options ? { ...defaultOptions, ...options } : defaultOptions;
    this.client = null;
    switch (this.options.type) {
      case "redis":
        this.client = new RedisStore(this.options);
        break;
      case "memory":
      default:
        this.client = new MemoryStore(this.options);
        break;
    }
  }

  /**
   * 获取单例实例，支持多配置实例管理
   * @static
   * @param {StoreOptions} [options]
   * @param {string} [instanceKey='default'] 实例键名，用于区分不同配置的实例
   * @returns {CacheStore}
   */
  static getInstance(options?: StoreOptions, instanceKey = 'default'): CacheStore {
    // 生成配置哈希作为实例键的一部分
    const configHash = options ? this.generateConfigHash(options) : 'default';
    const fullKey = `${instanceKey}_${configHash}`;
    
    if (this.instances.has(fullKey)) {
      return this.instances.get(fullKey)!;
    }
    
    const instance = new CacheStore(options);
    this.instances.set(fullKey, instance);
    return instance;
  }

  /**
   * 生成配置哈希
   * @private
   * @static
   * @param {StoreOptions} options
   * @returns {string}
   */
  private static generateConfigHash(options: StoreOptions): string {
    const configStr = JSON.stringify({
      type: options.type,
      host: (options as any).host,
      port: (options as any).port,
      db: options.db,
      keyPrefix: options.keyPrefix
    });
    // 简单哈希函数
    let hash = 0;
    for (let i = 0; i < configStr.length; i++) {
      const char = configStr.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 清理指定实例
   * @static
   * @param {string} [instanceKey='default']
   */
  static async clearInstance(instanceKey = 'default'): Promise<void> {
    const keysToRemove = Array.from(this.instances.keys()).filter(key => 
      key.startsWith(`${instanceKey}_`)
    );
    
    for (const key of keysToRemove) {
      const instance = this.instances.get(key);
      if (instance) {
        await instance.close();
        this.instances.delete(key);
      }
    }
  }

  /**
   * 清理所有实例
   * @static
   */
  static async clearAllInstances(): Promise<void> {
    const promises = Array.from(this.instances.values()).map(instance => instance.close());
    await Promise.all(promises);
    this.instances.clear();
  }

  getConnection() {
    return this.client.getConnection();
  }
  close(): Promise<void> {
    return this.client.close();
  }
  release(conn: any): Promise<void> {
    return this.client.release(conn);
  }

  /**
   * 获取底层实现客户端，用于访问特定实现的功能
   * 例如：Redis的defineCommand, getCompare等
   * @returns {MemoryStore | RedisStore}
   */
  getRawClient(): MemoryStore | RedisStore {
    return this.client;
  }

  /**
   * handler for native client
   *
   * @param {string} name
   * @param {any[]} data
   * @returns {*}  
   * @memberof RedisStore
   */
  protected async wrap(name: string, data: any[]) {
    let conn: any;
    try {
      conn = await this.getConnection();
      const res = await conn[name](...data);
      return res;
    } catch (err) {
      throw err;
    } finally {
      this.release(conn);
    }
  }

  /**
   * 字符串获取
   * @param name
   */
  get(name: string): Promise<string | null> {
    return this.wrap('get', [`${this.options.keyPrefix || ""}${name}`]);
  }

  /**
   * 字符串写入
   * @param name
   * @param value
   * @param timeout
   * @returns {Promise}
   */
  set(name: string, value: string | number, timeout?: number): Promise<string> {
    if (typeof timeout !== 'number') {
      timeout = this.options.timeout;
    }
    return this.wrap('set', [`${this.options.keyPrefix || ""}${name}`, value, 'ex', timeout]);
  }

  /**
   * 以秒为单位，返回给定 key 的剩余生存时间
   * @param name
   * @returns {*}
   */
  ttl(name: string): Promise<number> {
    return this.wrap('ttl', [`${this.options.keyPrefix || ""}${name}`]);
  }

  /**
   * 设置key超时属性
   * @param name
   * @param timeout
   */
  expire(name: string, timeout: number): Promise<number> {
    return this.wrap('expire', [`${this.options.keyPrefix || ""}${name}`, timeout]);
  }

  /**
   *
   *
   * @param {*} name
   * @returns
   */
  del(name: string): Promise<number> {
    return this.wrap('del', [`${this.options.keyPrefix || ""}${name}`]);
  }

  /**
   * 判断key是否存在
   * @param name
   */
  exists(name: string): Promise<number> {
    return this.wrap('exists', [`${this.options.keyPrefix || ""}${name}`]);
  }

  /**
   * 自增
   * @param name
   */
  incr(name: string): Promise<number> {
    return this.wrap('incr', [`${this.options.keyPrefix || ""}${name}`]);
  }

  /**
   * 自减
   * @param name
   * @returns {*}
   */
  decr(name: string): Promise<number> {
    return this.wrap('decr', [`${this.options.keyPrefix || ""}${name}`]);
  }

  /**
   * 将 key 所储存的值增加增量 
   * @param name
   * @param incr
   * @returns {*}
   */
  incrby(name: string, increment: number): Promise<number> {
    return this.wrap('incrby', [`${this.options.keyPrefix || ""}${name}`, increment]);
  }

  /**
   * 将 key 所储存的值减去减量 
   * 
   * @param {any} name 
   * @param {any} decr 
   */
  decrby(name: string, decrement: number): Promise<number> {
    return this.wrap('decrby', [`${this.options.keyPrefix || ""}${name}`, decrement]);
  }

  /**
   * 哈希写入
   * @param name
   * @param key
   * @param value
   * @param timeout
   */
  async hset(name: string, key: string, value: string | number, timeout?: number): Promise<number> {
    const result = await this.wrap('hset', [`${this.options.keyPrefix || ""}${name}`, key, value]);
    if (typeof timeout === 'number') {
      await this.set(`${name}:${key}_ex`, 1, timeout);
    } else {
      // 如果没有指定timeout，设置一个永久标记，避免hget时误删
      await this.set(`${name}:${key}_ex`, 1);
    }
    return result;
  }

  /**
   * 哈希获取
   * @param name
   * @param key
   * @returns {*}
   */
  hget(name: string, key: string): Promise<string | null> {
    const setP = [this.get(`${name}:${key}_ex`)];
    setP.push(this.wrap('hget', [`${this.options.keyPrefix || ""}${name}`, key]));
    return Promise.all(setP).then(dataArr => {
      if (dataArr[0] === null) {
        this.hdel(name, key);
        return null;
      }
      return dataArr[1] || null;
    });
  }

  /**
   * 查看哈希表 hashKey 中，给定域 key 是否存在
   * @param name
   * @param key
   * @returns {*}
   */
  hexists(name: string, key: string): Promise<number> {
    const setP = [this.get(`${name}:${key}_ex`)];
    setP.push(this.wrap('hexists', [`${this.options.keyPrefix || ""}${name}`, key]));
    return Promise.all(setP).then(dataArr => {
      if (dataArr[0] === null) {
        this.hdel(name, key);
        return 0;
      }
      return Number(dataArr[1]) || 0;
    });
  }

  /**
   * 哈希删除
   * @param name
   * @param key
   * @returns {*}
   */
  async hdel(name: string, key: string): Promise<number> {
    await this.del(`${name}:${key}_ex`);
    const result = await this.wrap('hdel', [`${this.options.keyPrefix || ""}${name}`, key]);
    return result;
  }

  /**
   * 返回哈希表 key 中域的数量
   * @param name
   * @returns {*}
   */
  hlen(name: string): Promise<number> {
    return this.wrap('hlen', [`${this.options.keyPrefix || ""}${name}`]);
  }

  /**
   * 给哈希表指定key，增加increment
   * @param name
   * @param key
   * @param increment
   * @returns {*}
   */
  hincrby(name: string, key: string, increment: number): Promise<number> {
    return this.wrap('hincrby', [`${this.options.keyPrefix || ""}${name}`, key, increment]);
  }

  /**
   * 返回哈希表所有key-value
   * @param name
   * @returns {*}
   */
  hgetall(name: string): Promise<any> {
    return this.wrap('hgetall', [`${this.options.keyPrefix || ""}${name}`]);
  }

  /**
   * 返回哈希表所有key
   * @param name
   * @returns {*}
   */
  hkeys(name: string): Promise<string[]> {
    return this.wrap('hkeys', [`${this.options.keyPrefix || ""}${name}`]);
  }

  /**
   * 返回哈希表所有value
   * @param name
   * @returns {*}
   */
  hvals(name: string): Promise<any[]> {
    return this.wrap('hvals', [`${this.options.keyPrefix || ""}${name}`]);
  }

  /**
   * 判断列表长度，若不存在则表示为空
   * @param name
   * @returns {*}
   */
  llen(name: string): Promise<number> {
    return this.wrap('llen', [`${this.options.keyPrefix || ""}${name}`]);
  }

  /**
   * 将值插入列表表尾
   * @param name
   * @param value
   * @returns {*}
   */
  rpush(name: string, value: string | number): Promise<number> {
    return this.wrap('rpush', [`${this.options.keyPrefix || ""}${name}`, value]);
  }

  /**
   *
   *
   * @param {string} name
   * @param {(string | number)} value
   * @returns {*}  
   * @memberof RedisStore
   */
  lpush(name: string, value: string | number): Promise<number> {
    return this.wrap('lpush', [`${this.options.keyPrefix || ""}${name}`, value]);
  }

  /**
   * 将列表表头取出，并去除
   * @param name
   * @returns {*}
   */
  lpop(name: string): Promise<string | null> {
    return this.wrap('lpop', [`${this.options.keyPrefix || ""}${name}`]);
  }

  /**
   *
   *
   * @param {string} name
   * @returns {*}  
   * @memberof RedisStore
   */
  rpop(name: string): Promise<string | null> {
    return this.wrap('rpop', [`${this.options.keyPrefix || ""}${name}`]);
  }

  /**
   * 返回列表 key 中指定区间内的元素，区间以偏移量 start 和 stop 指定
   * @param name
   * @param start
   * @param stop
   * @returns {*}
   */
  lrange(name: string, start: number, stop: number): Promise<any[]> {
    return this.wrap('lrange', [`${this.options.keyPrefix || ""}${name}`, start, stop]);
  }

  /**
   * 集合新增
   * @param name
   * @param value
   * @param timeout
   * @returns {*}
   */
  async sadd(name: string, value: string | number, timeout?: number): Promise<number> {
    const result = await this.wrap('sadd', [`${this.options.keyPrefix || ""}${name}`, value]);
    if (typeof timeout === 'number') {
      await this.wrap('expire', [`${this.options.keyPrefix || ""}${name}`, timeout]);
    }
    return result;
  }

  /**
   * 返回集合的基数(集合中元素的数量)
   * @param name
   * @returns {*}
   */
  scard(name: string): Promise<number> {
    return this.wrap('scard', [`${this.options.keyPrefix || ""}${name}`]);
  }

  /**
   * 判断 member 元素是否集合的成员
   * @param name
   * @param key
   * @returns {*}
   */
  sismember(name: string, key: string): Promise<number> {
    return this.wrap('sismember', [`${this.options.keyPrefix || ""}${name}`, key]);
  }

  /**
   * 返回集合中的所有成员
   * @param name
   * @returns {*}
   */
  smembers(name: string): Promise<any[]> {
    return this.wrap('smembers', [`${this.options.keyPrefix || ""}${name}`]);
  }

  /**
   * 移除并返回集合中的一个随机元素
   * @param name
   * @returns {*}
   */
  spop(name: string): Promise<any> {
    return this.wrap('spop', [`${this.options.keyPrefix || ""}${name}`]);
  }

  /**
   * 移除集合 key 中的一个 member 元素
   * @param name
   * @param key
   * @returns {*}
   */
  srem(name: string, key: string): Promise<number> {
    return this.wrap('srem', [`${this.options.keyPrefix || ""}${name}`, key]);
  }

  /**
   * 将 member 元素从 source 集合移动到 destination 集合
   * @param source
   * @param destination
   * @param member
   * @returns {*}
   */
  smove(source: string, destination: string, member: string): Promise<number> {
    return this.wrap('smove', [`${this.options.keyPrefix || ""}${source}`, `${this.options.keyPrefix || ""}${destination}`, member]);
  }

}