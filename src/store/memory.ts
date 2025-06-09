import { CacheStoreInterface } from "./interface";
import { MemoryCache, messages } from "./memory_cache";
// const MemoryCache = require('@outofsync/memory-cache');

export interface MemoryStoreOpt {
  type: string;
  keyPrefix?: string;
  db?: number;
  timeout?: number; // seconds
  maxKeys?: number; // LRU最大键数量
  maxMemory?: number; // 最大内存使用（字节）
  evictionPolicy?: 'lru' | 'lfu' | 'random'; // 淘汰策略
  ttlCheckInterval?: number; // TTL检查间隔（毫秒）
}
/*
 * @Description:
 * @Usage:
 * @Author: richen
 * @Date: 2021-06-29 19:07:57
 * @LastEditTime: 2023-02-18 23:52:47
 */
export class MemoryStore implements CacheStoreInterface {
  client: any;
  pool: any;
  options: MemoryStoreOpt;

  /**
   * Creates an instance of MemoryStore.
   * @param {MemoryStoreOpt} options
   * @memberof MemoryStore
   */
  constructor(options: MemoryStoreOpt) {
    this.options = {
      maxKeys: 1000,
      evictionPolicy: 'lru',
      ttlCheckInterval: 60000, // 1分钟
      ...options
    };
    this.client = null;
  }

  /**
   * getConnection
   *
   * @returns {*}  
   * @memberof MemoryStore
   */
  getConnection(): MemoryCache {
    if (!this.pool) {
      this.pool = new MemoryCache({
        database: this.options.db || 0,
        maxKeys: this.options.maxKeys,
        maxMemory: this.options.maxMemory,
        evictionPolicy: this.options.evictionPolicy,
        ttlCheckInterval: this.options.ttlCheckInterval
      });
    }
    if (!this.client) {
      this.client = this.pool.createClient();
      this.client.status = "ready";
    }

    return this.client;
  }

  /**
   * close
   *
   * @returns {*}  {Promise<void>}
   * @memberof MemoryStore
   */
  async close(): Promise<void> {
    if (this.client) {
      this.client.end();
      this.client = null;
    }
  }
  /**
   * release
   *
   * @param {*} _conn
   * @returns {*}  {Promise<void>}
   * @memberof MemoryStore
   */
  async release(_conn: any): Promise<void> {
    return;
  }

  /**
   * defineCommand
   *
   * @param {string} _name
   * @param {*} _scripts
   * @memberof MemoryStore
   */
  async defineCommand(_name: string, _scripts: any) {
    throw new Error(messages.unsupported);
  }

  /**
   * get and compare value
   *
   * @param {string} name
   * @param {(string | number)} value
   * @returns {*}  {Promise<any>}
   * @memberof MemoryStore
   */
  async getCompare(name: string, value: string | number): Promise<any> {
    const client = this.getConnection();
    const val = client.get(`${this.options.keyPrefix}${name}`);
    if (!val) {
      return 0;
    } else if (val == value) {
      return client.del(`${this.options.keyPrefix}${name}`);
    } else {
      return -1;
    }
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): any {
    if (this.client) {
      return this.client.info();
    }
    return {
      keys: 0,
      memory: 0,
      hits: 0,
      misses: 0
    };
  }
}
