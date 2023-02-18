import { CacheStoreInterface } from "./interface";
import { MemoryCache, messages } from "./memory_cache";
// const MemoryCache = require('@outofsync/memory-cache');

export interface MemoryStoreOpt {
  type: string;
  keyPrefix?: string;
  db?: number;
  timeout?: number; // seconds
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
    this.options = options;
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
        database: this.options.db
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
    this.client.end()
    this.client = null;
  }
  /**
   * release
   *
   * @param {*} conn
   * @returns {*}  {Promise<void>}
   * @memberof MemoryStore
   */
  async release(conn: any): Promise<void> {
    return;
  }

  /**
   * defineCommand
   *
   * @param {string} name
   * @param {*} scripts
   * @memberof MemoryStore
   */
  async defineCommand(name: string, scripts: any) {
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


}
