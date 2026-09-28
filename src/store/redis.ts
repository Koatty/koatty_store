/*
 * @Author: richen
 * @Date: 2020-11-30 15:56:08
 * @LastEditors: Please set LastEditors
 * @LastEditTime: 2023-02-19 00:02:09
 * @License: BSD (3-Clause)
 * @Copyright (c) - <richenlin(at)gmail.com>
 */
import * as helper from "koatty_lib";
import { DefaultLogger as logger } from "koatty_logger";
import { Redis, Cluster, RedisOptions, ClusterOptions } from "ioredis";


/**
 * @description: 
 * @return {*}
 */
export interface RedisStoreOpt extends RedisOptions, ClusterOptions {
  type: string;
  timeout?: number;
  /** @deprecated Ordinary commands are multiplexed; native leases use duplicate(). */
  poolSize?: number;
  clusters?: Array<{ host: string; port: number }>;
}
/**
 *
 *
 * @export
 * @class RedisStore
 */
export class RedisStore {
  options: RedisStoreOpt;
  public client: Redis | Cluster;
  private connecting?: Promise<Redis | Cluster>;
  private isolated = new Set<Redis | Cluster>();
  private closed = false;

  /**
   * Creates an instance of RedisStore.
   * @param {RedisStoreOpt} options
   * @memberof RedisStore
   */
  constructor(options: RedisStoreOpt) {
    this.options = this.parseOpt(options);

  }

  // parseOpt
  private parseOpt(options: RedisStoreOpt) {
    const opt: RedisStoreOpt = {
      ...options,
      type: options.type,
      host: options.host || '127.0.0.1',
      port: options.port || 6379,
      username: options.username || "",
      password: options.password || "",
      db: options.db || 0,
      timeout: options.timeout,
      keyPrefix: options.keyPrefix || '',
      poolSize: options.poolSize || 10,
      connectTimeout: options.connectTimeout || 500,
    };

    if (helper.isArray(options.host)) {
      const hosts: Array<{ host: string; port: number }> = [];
      for (let i = 0; i < options.host.length; i++) {
        const h = options.host[i];
        if (!helper.isEmpty(options.host[i])) {
          let p: number;
          if (helper.isArray(options.port)) {
            p = options.port[i];
          } else {
            p = options.port || 6379;
          }
          hosts.push({
            host: h,
            port: helper.toNumber(p),
          })
        }
      }
      // sentinel
      if (!helper.isEmpty(options.name)) {
        opt.host = "";
        opt.port = null;
        opt.sentinels = [...hosts];
        opt.sentinelUsername = options.username;
        opt.sentinelPassword = options.password;
      } else {
        // cluster
        opt.host = "";
        opt.port = null;
        opt.clusters = [...hosts];
      }
    }
    return opt;
  }

  /**
   * create connection by native with improved error handling
   *
   * @param {number} [connNum=0]
   * @returns {*}  {Promise<Redis | Cluster>}
   * @memberof RedisStore
   */
  private async connect(): Promise<Redis | Cluster> {
    if (this.closed) throw new Error('Redis store is closed');
    if (this.client?.status === 'ready') return this.client;
    if (!this.connecting) {
      this.connecting = (async () => {
        if (!this.client) {
          const options = { ...this.options, keyPrefix: '', lazyConnect: true, enableOfflineQueue: false };
          this.client = this.options.clusters?.length
            ? new Cluster([...this.options.clusters], { lazyConnect: true, redisOptions: options })
            : new Redis(options);
          this.client.on('error', error => logger.Error(`Redis connection error: ${error.message}`));
        }
        if (this.client.status === 'wait' || this.client.status === 'end') await this.client.connect();
        if (this.client.status !== 'ready') await this.waitReady(this.client);
        if (this.closed) { this.client.disconnect(); throw new Error('Redis store is closed'); }
        return this.client;
      })().finally(() => { this.connecting = undefined; });
    }
    return this.connecting;
  }

  private waitReady(client: Redis | Cluster): Promise<void> {
    if (client.status === 'ready') return Promise.resolve();
    return new Promise((resolve, reject) => {
      const cleanup = () => { clearTimeout(timer); client.removeListener('ready', ready); client.removeListener('error', fail); client.removeListener('end', ended); };
      const ready = () => { cleanup(); resolve(); };
      const fail = (error: Error) => { cleanup(); reject(error); };
      const ended = () => fail(new Error('Redis connection ended before ready'));
      const timer = setTimeout(() => fail(new Error('Redis connection timeout')), this.options.connectTimeout || 500);
      client.once('ready', ready); client.once('error', fail); client.once('end', ended);
    });
  }

  /** Ordinary cache operations multiplex one connection. */
  getSharedConnection(): Promise<Redis | Cluster> { return this.connect(); }

  /** Native callers (WATCH, blocking commands, transactions) own an isolated lease. */
  async getConnection(): Promise<Redis | Cluster> {
    const shared = await this.connect();
    const connection = shared.duplicate();
    this.isolated.add(connection);
    connection.on('error', error => logger.Error(`Redis isolated connection error: ${error.message}`));
    try {
      if (connection.status === 'wait') await connection.connect();
      await this.waitReady(connection);
      if (this.closed) throw new Error('Redis store is closed');
      return connection;
    } catch (error) { await this.release(connection); throw error; }
  }

  async withConnection<T>(work: (connection: Redis | Cluster) => Promise<T>): Promise<T> {
    const connection = await this.getConnection();
    try { return await work(connection); } finally { await this.release(connection); }
  }

  async beginTransaction(watchKeys: string[] = []) {
    const connection = await this.getConnection();
    try {
      if (watchKeys.length) await connection.watch(...watchKeys);
      const commands = connection.multi();
      let closed = false;
      const finish = async (commit: boolean) => {
        if (closed) throw new Error('Transaction is already closed');
        closed = true;
        try { return commit ? await commands.exec() : undefined; }
        finally { await this.release(connection); }
      };
      return { connection, commands, commit: () => finish(true), rollback: () => finish(false) };
    } catch (error) { await this.release(connection); throw error; }
  }

  async close(): Promise<void> {
    this.closed = true;
    for (const connection of this.isolated) connection.disconnect();
    this.isolated.clear();
    this.client?.disconnect();
  }

  async release(connection: Redis | Cluster): Promise<void> {
    if (this.isolated.delete(connection)) connection.disconnect();
  }

  /**
   * defineCommand
   *
   * @param {string} name
   * @param {{ numberOfKeys?: number; lua?: string; }} scripts
   * @returns {*}  
   * @memberof RedisStore
   */
  async defineCommand(name: string, scripts: { numberOfKeys?: number; lua?: string; }) {
    const conn: any = await this.getSharedConnection();
    if (!conn[name]) {
      conn.defineCommand(name, scripts);
    }

    return conn;
  }

  /**
   * get and compare value
   *
   * @param {string} name
   * @param {(string | number)} value
   * @returns {*}  {Promise<any>}
   * @memberof RedisStore
   */
  async getCompare(name: string, value: string | number): Promise<any> {
    let conn: any;
    try {
      conn = await this.defineCommand("getCompare", {
        numberOfKeys: 1,
        lua: `
                    local remote_value = redis.call("get",KEYS[1])
                    
                    if (not remote_value) then
                        return 0
                    elseif (remote_value == ARGV[1]) then
                        return redis.call("del",KEYS[1])
                    else
                        return -1
                    end
            `});
      return conn.getCompare(name, value);
    } catch (error) {
      throw error;
    } finally {
      this.release(conn);
    }
  }
}
