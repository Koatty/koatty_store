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
import genericPool from "generic-pool";

/**
 * @description: 
 * @return {*}
 */
export interface RedisStoreOpt extends RedisOptions, ClusterOptions {
  type: string;
  timeout?: number;
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
  pool: genericPool.Pool<Redis | Cluster>;
  public client: Redis | Cluster;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // 初始重连延迟1秒

  /**
   * Creates an instance of RedisStore.
   * @param {RedisStoreOpt} options
   * @memberof RedisStore
   */
  constructor(options: RedisStoreOpt) {
    this.options = this.parseOpt(options);
    this.pool = null;
  }

  // parseOpt
  private parseOpt(options: RedisStoreOpt) {
    const opt: RedisStoreOpt = {
      type: options.type,
      host: options.host || '127.0.0.1',
      port: options.port || 3306,
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
  private async connect(connNum = 0): Promise<Redis | Cluster> {
    if (this.client && this.client.status === 'ready') {
      return this.client;
    }

    const defer = helper.getDefer();
    let connection: Redis | Cluster;
    
    try {
      if (!helper.isEmpty(this.options.clusters)) {
        connection = new Cluster([...this.options.clusters], { 
          redisOptions: this.options,
          enableOfflineQueue: false,
          retryDelayOnFailover: 100
        });
      } else {
        connection = new Redis({
          ...this.options,
          enableOfflineQueue: false,
          retryDelayOnFailover: 100,
          lazyConnect: true
        } as RedisOptions);
      }
      
      // 去除prefix, 防止重复
      this.options.keyPrefix = "";
      
      connection.on('error', (err) => {
        logger.Error(`Redis connection error: ${err.message}`);
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect(connNum);
        } else {
          defer.reject(new Error(`Redis connection failed after ${this.maxReconnectAttempts} attempts`));
        }
      });
      
      connection.on('end', () => {
        logger.Warn('Redis connection ended');
        if (connNum < 3) {
          this.scheduleReconnect(connNum + 1);
        } else {
          this.close();
          defer.reject(new Error('Redis connection end after 3 attempts'));
        }
      });
      
      connection.on('ready', () => {
        logger.Info('Redis connection ready');
        this.client = connection;
        this.reconnectAttempts = 0; // 重置重连计数
        defer.resolve(connection);
      });

      // 主动连接
      if (connection instanceof Redis) {
        await connection.connect();
      }
      
    } catch (error) {
      logger.Error(`Failed to create Redis connection: ${error.message}`);
      defer.reject(error);
    }

    return defer.promise;
  }

  /**
   * 计划重连，使用指数退避策略
   * @private
   * @param {number} connNum
   */
  private scheduleReconnect(connNum: number): void {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    logger.Info(`Scheduling Redis reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      this.connect(connNum).catch(err => {
        logger.Error(`Reconnect attempt ${this.reconnectAttempts} failed: ${err.message}`);
      });
    }, delay);
  }

  /**
   * get connection from pool with improved configuration
   *
   * @returns {*}  
   * @memberof RedisStore
   */
  getConnection() {
    if (!this.pool || !this.pool.acquire) {
      const factory = {
        create: () => {
          return this.connect();
        },
        destroy: (resource: Redis | Cluster) => {
          if (resource && typeof resource.disconnect === 'function') {
            resource.disconnect();
          }
          return Promise.resolve();
        },
        validate: (resource: Redis | Cluster) => {
          return Promise.resolve(resource && resource.status === 'ready');
        }
      };
      
      this.pool = genericPool.createPool(factory, {
        max: this.options.poolSize || 10, // maximum size of the pool
        min: Math.min(2, this.options.poolSize || 2), // minimum size of the pool
        acquireTimeoutMillis: 30000, // 30秒获取连接超时
        testOnBorrow: true, // 借用时测试连接
        evictionRunIntervalMillis: 30000, // 30秒检查一次空闲连接
        idleTimeoutMillis: 300000, // 5分钟空闲超时
        softIdleTimeoutMillis: 180000 // 3分钟软空闲超时
      });
      
      this.pool.on('factoryCreateError', function (err) {
        logger.Error(`Redis pool create error: ${err.message}`);
      });
      
      this.pool.on('factoryDestroyError', function (err) {
        logger.Error(`Redis pool destroy error: ${err.message}`);
      });
    }

    return this.pool.acquire();
  }

  /**
   * close connection with proper cleanup
   *
   * @returns {*}  
   * @memberof RedisStore
   */
  async close() {
    try {
      if (this.pool) {
        await this.pool.drain();
        await this.pool.clear();
        this.pool = null;
      }
      
      if (this.client) {
        if (typeof this.client.disconnect === 'function') {
          this.client.disconnect();
        }
        this.client = null;
      }
    } catch (error) {
      logger.Error(`Error closing Redis connection: ${error.message}`);
    }
  }

  /**
   *
   *
   * @param {*} conn
   * @returns {*}  
   * @memberof RedisStore
   */
  async release(conn: any) {
    if (this.pool.isBorrowedResource(conn)) {
      return this.pool.release(conn);
    }
    return Promise.resolve();
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
    const conn: any = await this.getConnection();
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
