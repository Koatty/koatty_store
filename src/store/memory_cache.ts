/*
 * @Description: 
 * @Usage: 
 * @Author: richen
 * @Date: 2021-12-02 11:03:20
 * @LastEditTime: 2023-12-20 19:04:29
 */
import { flatten, isNil, isUndefined, union } from "lodash";
import * as Helper from "koatty_lib";
import { EventEmitter } from "events";
import { LRUCache } from "lru-cache";

export type CallbackFunction<T = any> = (err: Error | null, result?: T) => void;

/**
 * 缓存项接口
 */
interface _CacheItem {
  value: any;
  type: string;
  timeout?: number;
  lastAccess: number;
}

/**
 *
 *
 * @enum {number}
 */
export enum messages {
  ok = 'OK',
  queued = 'QUEUED',
  pong = 'PONG',
  noint = 'ERR value is not an integer or out of range',
  nofloat = 'ERR value is not an float or out of range',
  nokey = 'ERR no such key',
  nomultiinmulti = 'ERR MULTI calls can not be nested',
  nomultiexec = 'ERR EXEC without MULTI',
  nomultidiscard = 'ERR DISCARD without MULTI',
  busykey = 'ERR target key name is busy',
  syntax = 'ERR syntax error',
  unsupported = 'MemoryCache does not support that operation',
  wrongTypeOp = 'WRONGTYPE Operation against a key holding the wrong kind of value',
  wrongPayload = 'DUMP payload version or checksum are wrong',
  wrongArgCount = 'ERR wrong number of arguments for \'%0\' command',
  bitopnotWrongCount = 'ERR BITOP NOT must be called with a single source key',
  indexOutOfRange = 'ERR index out of range',
  invalidLexRange = 'ERR min or max not valid string range item',
  invalidDBIndex = 'ERR invalid DB index',
  invalidDBIndexNX = 'ERR invalid DB index, \'%0\' does not exist',
  mutuallyExclusiveNXXX = 'ERR XX and NX options at the same time are not compatible'
}

/**
 *
 *
 * @interface MemoryCacheOptions
 */
interface MemoryCacheOptions {
  database: number;
  maxKeys?: number; // 最大键数量，用于LRU
  maxMemory?: number; // 最大内存使用（字节）
  evictionPolicy?: 'lru' | 'lfu' | 'random'; // 淘汰策略
  ttlCheckInterval?: number; // TTL检查间隔（毫秒）
  maxAge?: number; // 默认过期时间（毫秒）
}

export class MemoryCache extends EventEmitter {
  private databases: Map<number, any> = new Map();
  options: MemoryCacheOptions;
  currentDBIndex: number;
  connected: boolean;
  lastSave: number;
  multiMode: boolean;
  private cache: any;
  private responseMessages: any[];
  private ttlCheckTimer: NodeJS.Timeout | null = null;

  /**
   * Creates an instance of MemoryCache.
   * @param {MemoryCacheOptions} options
   * @memberof MemoryCache
   */
  constructor(options: MemoryCacheOptions) {
    super();
    this.options = { 
      database: 0, 
      maxKeys: 1000,
      evictionPolicy: 'lru',
      ttlCheckInterval: 60000, // 1分钟检查一次过期键
      maxAge: 1000 * 60 * 60, // 默认1小时过期
      ...options 
    };
    this.currentDBIndex = options.database || 0;
    this.connected = false;
    this.lastSave = Date.now();
    this.multiMode = false;
    this.responseMessages = [];
    
    // 初始化数据库和缓存
    if (!this.databases.has(this.currentDBIndex)) {
      this.databases.set(this.currentDBIndex, this.createLRUCache());
    }
    this.cache = this.databases.get(this.currentDBIndex)!;
    
    // 启动TTL检查定时器
    this.startTTLCheck();
  }

  /**
   * 创建LRU缓存实例
   */
  private createLRUCache(): any {
    return new LRUCache({
      max: this.options.maxKeys || 1000,
      ttl: this.options.maxAge || 1000 * 60 * 60, // 1小时默认
      updateAgeOnGet: true, // 访问时更新age
      dispose: (key: any, item: any) => {
        // 键被淘汰时的回调
        this.emit('evict', key, item);
      }
    });
  }

  /**
   * 启动TTL检查定时器
   */
  private startTTLCheck(): void {
    if (this.ttlCheckTimer) {
      clearInterval(this.ttlCheckTimer);
    }
    
    this.ttlCheckTimer = setInterval(() => {
      this.cleanExpiredKeys();
    }, this.options.ttlCheckInterval || 60000);
  }

  /**
   * 清理过期键
   */
  private cleanExpiredKeys(): void {
    for (const [_dbIndex, cache] of this.databases) {
      const keysToDelete: string[] = [];
      
      cache.forEach((item: any, key: any) => {
        if (item.timeout && item.timeout <= Date.now()) {
          keysToDelete.push(key);
        }
      });
      
      keysToDelete.forEach(key => {
        cache.delete(key);
        this.emit('expire', key);
      });
    }
  }

  /**
   * 停止TTL检查
   */
  private stopTTLCheck(): void {
    if (this.ttlCheckTimer) {
      clearInterval(this.ttlCheckTimer);
      this.ttlCheckTimer = null;
    }
  }

  /**
   *
   *
   * @returns {*}  
   * @memberof MemoryCache
   */
  createClient() {
    if (!this.databases.has(this.options.database)) {
      this.databases.set(this.options.database, this.createLRUCache());
    }
    this.cache = this.databases.get(this.options.database)!;
    this.connected = true;
    // exit multi mode if we are in it
    this.discard(null, true);
    this.emit('connect');
    this.emit('ready');
    return this;
  }

  /**
   *
   *
   * @returns {*}  
   * @memberof MemoryCache
   */
  quit() {
    this.connected = false;
    this.stopTTLCheck();
    // exit multi mode if we are in it
    this.discard(null, true);
    this.emit('end');
    return this;
  }

  /**
   *
   *
   * @returns {*}  
   * @memberof MemoryCache
   */
  end() {
    return this.quit();
  }

  /**
   * 获取缓存统计信息
   */
  info(): any {
    const stats = {
      databases: this.databases.size,
      currentDB: this.currentDBIndex,
      keys: this.cache ? this.cache.length : 0,
      maxKeys: this.options.maxKeys,
      hits: 0,
      misses: 0,
      memory: this.getMemoryUsage()
    };
    
    // 如果缓存支持统计信息
    if (this.cache && typeof this.cache.dump === 'function') {
      const dump = this.cache.dump();
      stats.keys = dump.length;
    }
    
    return stats;
  }

  /**
   * 估算内存使用量
   */
  private getMemoryUsage(): number {
    let totalSize = 0;
    
    for (const [, cache] of this.databases) {
      cache.forEach((item: any, key: any) => {
        // 粗略估算：key长度 + JSON序列化后的大小
        totalSize += key.length * 2; // Unicode字符占2字节
        totalSize += JSON.stringify(item).length * 2;
      });
    }
    
    return totalSize;
  }

  /**
   *
   *
   * @param {string} message
   * @param {Function} [callback]
   * @returns {*}  
   * @memberof MemoryCache
   */
  echo(message: string, callback?: CallbackFunction) {
    return this._handleCallback(callback, message);
  }

  /**
   *
   *
   * @param {string} message
   * @param {Function} [callback]
   * @returns {*}  
   * @memberof MemoryCache
   */
  ping(message: string, callback?: CallbackFunction) {
    message = message || messages.pong;
    return this._handleCallback(callback, message);
  }

  /**
   *
   *
   * @param {string} password
   * @param {Function} [callback]
   * @returns {*}  
   * @memberof MemoryCache
   */
  auth(password: string, callback?: CallbackFunction) {
    return this._handleCallback(callback, messages.ok);
  }

  /**
   *
   *
   * @param {number} dbIndex
   * @param {Function} [callback]
   * @returns {*}  
   * @memberof MemoryCache
   */
  select(dbIndex: number, callback?: CallbackFunction) {
    if (!Helper.isNumber(dbIndex)) {
      return this._handleCallback(callback, null, messages.invalidDBIndex);
    }
    if (!this.databases.has(dbIndex)) {
      this.databases.set(dbIndex, this.createLRUCache());
    }
    this.multiMode = false;
    this.currentDBIndex = dbIndex;
    this.cache = this.databases.get(dbIndex)!;

    return this._handleCallback(callback, messages.ok);
  }

  // ---------------------------------------
  // Keys
  // ---------------------------------------
  get(key: string, callback?: CallbackFunction) {
    let retVal = null;
    if (this._hasKey(key)) {
      this._testType(key, 'string', true, callback);
      retVal = this._getKey(key);
    }
    return this._handleCallback(callback, retVal);
  }

  /**
   * set(key, value, ttl, pttl, notexist, onlyexist, callback)
   *
   * @param {string} key
   * @param {(string | number)} value
   * @param {...any[]} params
   * @returns {*}  
   * @memberof MemoryCache
   */
  set(key: string, value: string | number, ...params: any[]) {
    const retVal: string | number = null;
    params = flatten(params);
    const callback = this._retrieveCallback(params);
    let ttl, pttl, notexist, onlyexist;
    // parse parameters
    while (params.length > 0) {
      const param = params.shift();
      switch (param.toString().toLowerCase()) {
        case 'nx':
          notexist = true;
          break;
        case 'xx':
          onlyexist = true;
          break;
        case 'ex':
          if (params.length === 0) {
            return this._handleCallback(callback, null, messages.syntax);
          }
          ttl = parseInt(params.shift());
          if (isNaN(ttl)) {
            return this._handleCallback(callback, null, messages.noint);
          }
          break;
        case 'px':
          if (params.length === 0) {
            return this._handleCallback(callback, null, messages.syntax);
          }
          pttl = parseInt(params.shift());
          if (isNaN(pttl)) {
            return this._handleCallback(callback, null, messages.noint);
          }
          break;
        default:
          return this._handleCallback(callback, null, messages.syntax);
      }
    }

    if (!isNil(ttl) && !isNil(pttl)) {
      return this._handleCallback(callback, null, messages.syntax);
    }

    if (notexist && onlyexist) {
      return this._handleCallback(callback, null, messages.syntax);
    }

    pttl = pttl || ttl * 1000 || null;
    if (!isNil(pttl)) {
      pttl = Date.now() + pttl;
    }
    if (this._hasKey(key)) {
      this._testType(key, 'string', true, callback);
      if (notexist) {
        return this._handleCallback(callback, retVal);
      }
    } else if (onlyexist) {
      return this._handleCallback(callback, retVal);
    }
    this.cache.set(key, this._makeKey(value.toString(), 'string', pttl));

    return this._handleCallback(callback, messages.ok);
  }

  /**
   *
   *
   * @param {string} key
   * @param {Function} [callback]
   * @returns {*}  
   * @memberof MemoryCache
   */
  ttl(key: string, callback?: CallbackFunction) {
    let retVal = this.pttl(key);
    if (retVal >= 0 || retVal <= -3) {
      retVal = Math.floor(retVal / 1000);
    }
    return this._handleCallback(callback, retVal);
  }

  /**
   *
   *
   * @param {string} key
   * @param {number} seconds
   * @param {Function} [callback]
   * @returns {*}  
   * @memberof MemoryCache
   */
  expire(key: string, seconds: number, callback?: CallbackFunction) {
    let retVal = 0;
    if (this._hasKey(key)) {
      const pttl = seconds * 1000;
      this.cache.set(key, { ...this.cache.get(key)!, timeout: Date.now() + pttl });
      retVal = 1;
    }
    return this._handleCallback(callback, retVal);
  }

  /**
   *
   *
   * @param {...any[]} keys
   * @returns {*}  
   * @memberof MemoryCache
   */
  del(...keys: any[]) {
    let retVal = 0;
    const callback = this._retrieveCallback(keys);
    // Flatten the array in case an array was passed
    keys = flatten(keys);

    for (let itr = 0; itr < keys.length; itr++) {
      const key = keys[itr];
      if (this._hasKey(key)) {
        this.cache.delete(key);
        retVal++;
      }
    }

    return this._handleCallback(callback, retVal);
  }

  /**
   *
   *
   * @param {...any[]} keys
   * @returns {*}  
   * @memberof MemoryCache
   */
  exists(...keys: any[]) {
    let retVal = 0;
    const callback = this._retrieveCallback(keys);

    for (let itr = 0; itr < keys.length; itr++) {
      const key = keys[itr];
      if (this._hasKey(key)) {
        retVal++;
      }
    }
    return this._handleCallback(callback, retVal);
  }

  /**
   *
   *
   * @param {string} key
   * @param {Function} [callback]
   * @returns {*}  
   * @memberof MemoryCache
   */
  incr(key: string, callback?: CallbackFunction) {
    let retVal = null;
    try {
      retVal = this._addToKey(key, 1);
    } catch (err) {
      return this._handleCallback(callback, null, err);
    }
    return this._handleCallback(callback, retVal);
  }

  /**
   *
   *
   * @param {string} key
   * @param {number} amount
   * @param {Function} [callback]
   * @returns {*}  
   * @memberof MemoryCache
   */
  incrby(key: string, amount: number, callback?: CallbackFunction) {
    let retVal = null;
    try {
      retVal = this._addToKey(key, amount);
    } catch (err) {
      return this._handleCallback(callback, null, err);
    }
    return this._handleCallback(callback, retVal);
  }

  /**
   *
   *
   * @param {string} key
   * @param {Function} [callback]
   * @returns {*}  
   * @memberof MemoryCache
   */
  decr(key: string, callback?: CallbackFunction) {
    let retVal = null;
    try {
      retVal = this._addToKey(key, -1);
    } catch (err) {
      return this._handleCallback(callback, null, err);
    }
    return this._handleCallback(callback, retVal);
  }

  /**
   *
   *
   * @param {string} key
   * @param {number} amount
   * @param {Function} [callback]
   * @returns {*}  
   * @memberof MemoryCache
   */
  decrby(key: string, amount: number, callback?: CallbackFunction) {
    let retVal = null;
    try {
      retVal = this._addToKey(key, 0 - amount);
    } catch (err) {
      return this._handleCallback(callback, null, err);
    }
    return this._handleCallback(callback, retVal);
  }

  // ---------------------------------------
  // ## Hash ##
  // ---------------------------------------
  hset(key: string, field: string, value: string | number, callback?: CallbackFunction) {
    let retVal = 0;
    if (this._hasKey(key)) {
      this._testType(key, 'hash', true, callback);
    } else {
      this.cache.set(key, this._makeKey({}, 'hash'));
    }

    if (!this._hasField(key, field)) {
      retVal = 1;
    }

    this._setField(key, field, value.toString());
    this.persist(key);

    return this._handleCallback(callback, retVal);
  }

  /**
   *
   *
   * @param {string} key
   * @param {string} field
   * @param {Function} [callback]
   * @returns {*}  
   * @memberof MemoryCache
   */
  hget(key: string, field: string, callback?: CallbackFunction) {
    let retVal = null;
    if (this._hasKey(key)) {
      this._testType(key, 'hash', true, callback);
      if (this._hasField(key, field)) {
        retVal = this._getKey(key)[field];
      }
    }
    return this._handleCallback(callback, retVal);
  }

  /**
   *
   *
   * @param {string} key
   * @param {string} field
   * @param {Function} [callback]
   * @returns {*}  
   * @memberof MemoryCache
   */
  hexists(key: string, field: string, callback?: CallbackFunction) {
    let retVal = 0;
    if (this._hasKey(key)) {
      this._testType(key, 'hash', true, callback);
      if (this._hasField(key, field)) {
        retVal = 1;
      }
    }
    return this._handleCallback(callback, retVal);
  }

  /**
   *
   *
   * @param {string} key
   * @param {...any[]} fields
   * @returns {*}  
   * @memberof MemoryCache
   */
  hdel(key: string, ...fields: any[]) {
    let retVal = 0;
    const callback = this._retrieveCallback(fields);
    if (this._hasKey(key)) {
      this._testType(key, 'hash', true, callback);
      for (let itr = 0; itr < fields.length; itr++) {
        const field = fields[itr];
        if (this._hasField(key, field)) {
          delete this.cache.get(key)!.value[field];
          retVal++;
        }
      }
    }
    return this._handleCallback(callback, retVal);
  }

  /**
   *
   *
   * @param {string} key
   * @param {Function} [callback]
   * @returns {*}  
   * @memberof MemoryCache
   */
  hlen(key: string, callback?: CallbackFunction) {
    const retVal = this.hkeys(key).length;
    return this._handleCallback(callback, retVal);
  }

  /**
   *
   *
   * @param {string} key
   * @param {string} field
   * @param {*} value
   * @param {Function} [callback]
   * @returns {*}  
   * @memberof MemoryCache
   */
  hincrby(key: string, field: string, value: any, callback?: CallbackFunction) {
    let retVal;
    try {
      retVal = this._addToField(key, field, value, false);
    } catch (err) {
      return this._handleCallback(callback, null, err);
    }
    return this._handleCallback(callback, retVal);
  }

  /**
   *
   *
   * @param {string} key
   * @param {Function} [callback]
   * @returns {*}  
   * @memberof MemoryCache
   */
  hgetall(key: string, callback?: CallbackFunction) {
    let retVals = {};
    if (this._hasKey(key)) {
      this._testType(key, 'hash', true, callback);
      retVals = this._getKey(key);
    }
    return this._handleCallback(callback, retVals);
  }

  /**
  *
  *
  * @param {string} key
  * @param {Function} [callback]
  * @returns {*}  
  * @memberof MemoryCache
  */
  hkeys(key: string, callback?: CallbackFunction) {
    let retVals: any[] = [];
    if (this._hasKey(key)) {
      this._testType(key, 'hash', true, callback);
      retVals = Object.keys(this._getKey(key));
    }

    return this._handleCallback(callback, retVals);
  }

  /**
   *
   *
   * @param {string} key
   * @param {Function} [callback]
   * @returns {*}  
   * @memberof MemoryCache
   */
  hvals(key: string, callback?: CallbackFunction) {
    let retVals: any[] = [];
    if (this._hasKey(key)) {
      this._testType(key, 'hash', true, callback);
      retVals = Object.values(this._getKey(key));
    }

    return this._handleCallback(callback, retVals);
  }

  // ---------------------------------------
  // Lists (Array / Queue / Stack)
  // ---------------------------------------

  /**
   *
   *
   * @param {string} key
   * @param {Function} [callback]
   * @returns {*}  
   * @memberof MemoryCache
   */
  llen(key: string, callback?: CallbackFunction) {
    let retVal = 0;
    if (this._hasKey(key)) {
      this._testType(key, 'list', true, callback);
      retVal = this._getKey(key).length || 0;
    }

    return this._handleCallback(callback, retVal);
  }

  /**
   *
   *
   * @param {string} key
   * @param {(string | number)} value
   * @param {Function} [callback]
   * @returns {*}  
   * @memberof MemoryCache
   */
  rpush(key: string, value: string | number, callback?: CallbackFunction) {
    let retVal = 0;
    if (this._hasKey(key)) {
      this._testType(key, 'list', true, callback);
    } else {
      this.cache.set(key, this._makeKey([], 'list'));
    }

    this._getKey(key).push(value.toString());
    retVal = this._getKey(key).length;
    this.persist(key);

    return this._handleCallback(callback, retVal);
  }

  /**
   * List：从左侧推入
   * @param key 
   * @param value 
   * @param callback 
   */
  lpush(key: string, value: any, callback?: CallbackFunction) {
    let retVal = 0;
    if (this._hasKey(key)) {
      this._testType(key, 'list', true, callback);
    } else {
      this.cache.set(key, this._makeKey([], 'list'));
    }
    const list = this._getKey(key);
    retVal = list.unshift(value);
    this._setKey(key, list);
    return this._handleCallback(callback, retVal);
  }

  /**
   * List：获取指定索引的元素
   * @param key 
   * @param index 
   * @param callback 
   */
  lindex(key: string, index: number, callback?: CallbackFunction) {
    if (!this._hasKey(key)) {
      return this._handleCallback(callback, null);
    }
    
    this._testType(key, 'list', true, callback);
    const list = this._getKey(key);
    
    if (index < 0) {
      index = list.length + index;
    }
    
    const value = index >= 0 && index < list.length ? list[index] : null;
    return this._handleCallback(callback, value);
  }

  /**
   *
   *
   * @param {string} key
   * @param {Function} [callback]
   * @returns {*}  
   * @memberof MemoryCache
   */
  lpop(key: string, callback?: CallbackFunction) {
    let retVal = null;
    if (this._hasKey(key)) {
      this._testType(key, 'list', true, callback);
      const list = this._getKey(key);
      if (list.length > 0) {
        retVal = list.shift();
        this.persist(key);
      }
    }
    return this._handleCallback(callback, retVal);
  }

  /**
   *
   *
   * @param {string} key
   * @param {Function} [callback]
   * @returns {*}  
   * @memberof MemoryCache
   */
  rpop(key: string, callback?: CallbackFunction) {
    let retVal = null;
    if (this._hasKey(key)) {
      this._testType(key, 'list', true, callback);
      const list = this._getKey(key);
      if (list.length > 0) {
        retVal = list.pop();
        this.persist(key);
      }
    }
    return this._handleCallback(callback, retVal);
  }

  /**
   *
   *
   * @param {string} key
   * @param {number} start
   * @param {number} stop
   * @param {Function} [callback]
   * @returns {*}  
   * @memberof MemoryCache
   */
  lrange(key: string, start: number, stop: number, callback?: CallbackFunction) {
    const retVal = [];
    if (this._hasKey(key)) {
      this._testType(key, 'list', true, callback);
      const list = this._getKey(key);
      const length = list.length;
      if (stop < 0) {
        stop = length + stop;
      }
      if (start < 0) {
        start = length + start;
      }
      if (start < 0) {
        start = 0;
      }
      if (stop >= length) {
        stop = length - 1;
      }
      if (stop >= 0 && stop >= start) {
        const size = stop - start + 1;
        for (let itr = start; itr < size; itr++) {
          retVal.push(list[itr]);
        }
      }
    }
    return this._handleCallback(callback, retVal);
  }

  // ---------------------------------------
  // ## Sets (Unique Lists)##
  // ---------------------------------------

  /**
   *
   *
   * @param {string} key
   * @param {...any[]} members
   * @returns {*}  
   * @memberof MemoryCache
   */
  sadd(key: string, ...members: string[]) {
    let retVal = 0;
    const callback = this._retrieveCallback(members);
    if (this._hasKey(key)) {
      this._testType(key, 'set', true, callback);
    } else {
      this.cache.set(key, this._makeKey([], 'set'));
    }
    const val = this._getKey(key);
    const length = val.length;
    const nval = union(val, members);
    const newlength = nval.length;
    retVal = newlength - length;
    this._setKey(key, nval);

    return this._handleCallback(callback, retVal);
  }

  /**
   *
   *
   * @param {string} key
   * @param {Function} [callback]
   * @returns {*}  
   * @memberof MemoryCache
   */
  scard(key: string, callback?: CallbackFunction) {
    let retVal = 0;
    if (this._hasKey(key)) {
      this._testType(key, 'set', true, callback);
      retVal = this._getKey(key).length;
    }
    return this._handleCallback(callback, retVal);
  }

  /**
   *
   *
   * @param {string} key
   * @param {string} member
   * @param {Function} [callback]
   * @returns {*}  
   * @memberof MemoryCache
   */
  sismember(key: string, member: string, callback?: CallbackFunction) {
    let retVal = 0;
    if (this._hasKey(key)) {
      this._testType(key, 'set', true, callback);
      const val = this._getKey(key);
      if (val.includes(member)) {
        retVal = 1;
      }
    }

    return this._handleCallback(callback, retVal);
  }

  /**
   *
   *
   * @param {string} key
   * @param {Function} [callback]
   * @returns {*}  
   * @memberof MemoryCache
   */
  smembers(key: string, callback?: CallbackFunction) {
    let retVal = [];
    if (this._hasKey(key)) {
      this._testType(key, 'set', true, callback);
      retVal = this._getKey(key);
    }
    return this._handleCallback(callback, retVal);
  }

  /**
   *
   *
   * @param {string} key
   * @param {number} [count]
   * @param {Function} [callback]
   * @returns {*}  
   * @memberof MemoryCache
   */
  spop(key: string, count?: number, callback?: CallbackFunction) {
    let retVal: any[] = [];
    count = count || 1;
    if (typeof count === 'function') {
      callback = count;
      count = 1;
    }
    if (this._hasKey(key)) {
      this._testType(key, 'set', true, callback);
      const val = this._getKey(key);
      const keys = Object.keys(val);
      const keysLength = keys.length;
      if (keysLength) {
        if (count >= keysLength) {
          retVal = keys;
          this.del(key);
        } else {
          for (let itr = 0; itr < count; itr++) {
            const randomNum = Math.floor(Math.random() * keys.length);
            retVal.push(keys[randomNum]);
            this.srem(key, keys[randomNum]);
          }
        }
      }
    }

    return this._handleCallback(callback, retVal);
  }

  /**
   *
   *
   * @param {string} key
   * @param {...any[]} members
   * @returns {*}  
   * @memberof MemoryCache
   */
  srem(key: string, ...members: any[]) {
    let retVal = 0;
    const callback = this._retrieveCallback(members);
    if (this._hasKey(key)) {
      this._testType(key, 'set', true, callback);
      const val = this._getKey(key);
      for (const index in members) {
        if (members.hasOwnProperty(index)) {
          const member = members[index];
          const idx = val.indexOf(member);
          if (idx !== -1) {
            val.splice(idx, 1);
            retVal++;
          }
        }
      }
      this._setKey(key, val);
    }
    return this._handleCallback(callback, retVal);
  }

  /**
   *
   *
   * @param {string} sourcekey
   * @param {string} destkey
   * @param {string} member
   * @param {Function} [callback]
   * @returns {*}  
   * @memberof MemoryCache
   */
  smove(sourcekey: string, destkey: string, member: string, callback?: CallbackFunction) {
    let retVal = 0;
    if (this._hasKey(sourcekey)) {
      this._testType(sourcekey, 'set', true, callback);
      const val = this._getKey(sourcekey);
      const idx = val.indexOf(member);
      if (idx !== -1) {
        this.sadd(destkey, member);
        val.splice(idx, 1);
        retVal = 1;
      }
    }
    return this._handleCallback(callback, retVal);
  }

  // ---------------------------------------
  // ## Transactions (Atomic) ##
  // ---------------------------------------
  // TODO: Transaction Queues watch and unwatch
  // https://redis.io/topics/transactions
  // This can be accomplished by temporarily swapping this.cache to a temporary copy of the current statement
  // holding and then using __.merge on actual this.cache with the temp storage.
  discard(callback?: CallbackFunction, silent?: boolean) {
    // Clear the queue mode, drain the queue, empty the watch list
    if (this.multiMode) {
      this.cache = this.databases.get(this.currentDBIndex)!;
      this.multiMode = false;
      this.responseMessages = [];
    }
    if (!silent) {
      return this._handleCallback(callback, messages.ok);
    }
    return null;
  }

  // ---------------------------------------
  // ## Internal - Key ##
  // ---------------------------------------

  /**
   *
   *
   * @param {string} key
   * @param {Function} [callback]
   * @returns {*}  
   * @memberof MemoryCache
   */
  private pttl(key: string, _callback?: CallbackFunction): number {
    let retVal = -2;
    if (this._hasKey(key)) {
      if (!isNil(this.cache.get(key)?.timeout)) {
        retVal = this.cache.get(key)!.timeout - Date.now();
        // Prevent unexpected errors if the actual ttl just happens to be -2 or -1
        if (retVal < 0 && retVal > -3) {
          retVal = -3;
        }
      } else {
        retVal = -1;
      }
    }
    return retVal;
  }

  /**
   *
   *
   * @private
   * @param {string} key
   * @param {Function} [callback]
   * @returns {*}  
   * @memberof MemoryCache
   */
  private persist(key: string, callback?: CallbackFunction) {
    let retVal = 0;
    if (this._hasKey(key)) {
      if (!isNil(this._key(key).timeout)) {
        this.cache.set(key, { ...this.cache.get(key)!, timeout: null });
        retVal = 1;
      }
    }
    return this._handleCallback(callback, retVal);
  }

  /**
   *
   *
   * @private
   * @param {string} key
   * @returns {*}  {boolean}
   * @memberof MemoryCache
   */
  private _hasKey(key: string) {
    return this.cache.has(key);
  }

  /**
   *
   *
   * @private
   * @param {*} value
   * @param {string} type
   * @param {number} timeout
   * @returns {*}  
   * @memberof MemoryCache
   */
  private _makeKey(value: any, type: string, timeout?: number) {
    return { value: value, type: type, timeout: timeout || null, lastAccess: Date.now() };
  }

  /**
   *
   *
   * @private
   * @param {string} key
   * @returns {*}  
   * @memberof MemoryCache
   */
  private _key(key: string) {
    this.cache.get(key)!.lastAccess = Date.now();
    return this.cache.get(key)!;
  }

  /**
   *
   *
   * @private
   * @param {string} key
   * @param {number} amount
   * @param {Function} [callback]
   * @returns {*}  
   * @memberof MemoryCache
   */
  private _addToKey(key: string, amount: number, callback?: CallbackFunction) {
    let keyValue = 0;
    if (isNaN(amount) || isNil(amount)) {
      return this._handleCallback(callback, null, messages.noint);
    }

    if (this._hasKey(key)) {
      this._testType(key, 'string', true, callback);
      keyValue = parseInt(this._getKey(key));
      if (isNaN(keyValue) || isNil(keyValue)) {
        return this._handleCallback(callback, null, messages.noint);
      }
    } else {
      this.cache.set(key, this._makeKey('0', 'string'));
    }
    const val = keyValue + amount;
    this._setKey(key, val.toString());
    return val;
  }

  /**
   *
   *
   * @private
   * @param {string} key
   * @param {string} type
   * @param {boolean} [throwError]
   * @param {Function} [callback]
   * @returns {*}  
   * @memberof MemoryCache
   */
  private _testType(key: string, type: string, throwError?: boolean, callback?: CallbackFunction) {
    throwError = !!throwError;
    const keyType = this._key(key).type;
    if (keyType !== type) {
      if (throwError) {
        return this._handleCallback(callback, null, messages.wrongTypeOp);
      }
      return false;
    }
    return true;
  }

  /**
   *
   *
   * @private
   * @param {string} key
   * @returns {*}  
   * @memberof MemoryCache
   */
  private _getKey(key: string) {
    const _key = this._key(key) || {};
    if (_key.timeout && _key.timeout <= Date.now()) {
      this.del(key);
      return null;
    }
    return _key.value;
  }

  /**
   *
   *
   * @private
   * @param {string} key
   * @param {(number | string)} value
   * @memberof MemoryCache
   */
  private _setKey(key: string, value: any) {
    this.cache.set(key, { ...this.cache.get(key)!, value: value, lastAccess: Date.now() });
  }

  /**
   *
   *
   * @private
   * @param {string} key
   * @param {string} field
   * @param {number} [amount]
   * @param {boolean} [useFloat]
   * @param {Function} [callback]
   * @returns {*}  
   * @memberof MemoryCache
   */
  private _addToField(key: string, field: string, amount?: number, useFloat?: boolean, callback?: CallbackFunction) {
    useFloat = useFloat || false;
    let fieldValue = useFloat ? 0.0 : 0;
    let value = 0;

    if (isNaN(amount) || isNil(amount)) {
      return this._handleCallback(callback, null, useFloat ? messages.nofloat : messages.noint);
    }

    if (this._hasKey(key)) {
      this._testType(key, 'hash', true, callback);
      if (this._hasField(key, field)) {
        value = this._getField(key, field);
      }
    } else {
      this.cache.set(key, this._makeKey({}, 'hash'));
    }

    fieldValue = useFloat ? parseFloat(`${value}`) : parseInt(`${value}`);
    amount = useFloat ? parseFloat(`${amount}`) : parseInt(`${amount}`);
    if (isNaN(fieldValue) || isNil(fieldValue)) {
      return this._handleCallback(callback, null, useFloat ? messages.nofloat : messages.noint);
    }

    fieldValue += amount;
    this._setField(key, field, fieldValue.toString());
    return fieldValue;
  }

  /**
   *
   *
   * @private
   * @param {string} key
   * @param {string} field
   * @returns {*}  
   * @memberof MemoryCache
   */
  private _getField(key: string, field: string) {
    return this._getKey(key)[field];
  }

  /**
   *
   *
   * @private
   * @param {string} key
   * @param {string} field
   * @returns {*}  {boolean}
   * @memberof MemoryCache
   */
  private _hasField(key: string, field: string) {
    let retVal = false;
    if (key && field) {
      const ky = this._getKey(key);
      if (ky) {
        retVal = ky.hasOwnProperty(field);
      }
    }
    return retVal;
  }

  /**
   *
   *
   * @param {string} key
   * @param {string} field
   * @param {*} value
   * @memberof MemoryCache
   */
  _setField(key: string, field: string, value: any) {
    this._getKey(key)[field] = value;
  }

  /**
   * 
   *
   * @private
   * @param {Function} [callback]
   * @param {(any)} [message]
   * @param {*} [error]
   * @param {boolean} [nolog]
   * @returns {*}  
   * @memberof MemoryCache
   */
  private _handleCallback(callback?: CallbackFunction<any>, message?: any, error?: any, nolog?: boolean) {
    let err = error;
    let msg = message;
    nolog = isNil(nolog) ? true : nolog;
    if (nolog) {
      err = this._logReturn(error);
      msg = this._logReturn(message);
    }
    if (typeof callback === 'function') {
      callback(err, msg);
      return;
    }
    if (err) {
      throw new Error(err);
    }
    return msg;
  }

  private _logReturn(message: string | number) {
    if (!isUndefined(message)) {
      if (this.multiMode) {
        if (!isNil(this.responseMessages)) {
          this.responseMessages.push(message);
          if (message === messages.ok) {
            message = messages.queued;
          }
        }
      }
      return message;
    }
    return;
  }

  /**
   *
   *
   * @private
   * @param {any[]} [params]
   * @returns {*}  
   * @memberof MemoryCache
   */
  private _retrieveCallback(params?: any[]) {
    if (Array.isArray(params) && params.length > 0 && typeof params[params.length - 1] === 'function') {
      return params.pop();
    }
    return;
  }

  /**
   * 字符串追加操作
   * @param key 
   * @param value 
   * @param callback 
   */
  append(key: string, value: string, callback?: CallbackFunction) {
    let retVal = 0;
    if (this._hasKey(key)) {
      this._testType(key, 'string', true, callback);
      const existingValue = this._getKey(key);
      const newValue = existingValue + value;
      this._setKey(key, newValue);
      retVal = newValue.length;
    } else {
      this.cache.set(key, this._makeKey(value, 'string'));
      retVal = value.length;
    }
    return this._handleCallback(callback, retVal);
  }

  /**
   * 获取字符串长度
   * @param key 
   * @param callback 
   */
  strlen(key: string, callback?: CallbackFunction) {
    let retVal = 0;
    if (this._hasKey(key)) {
      this._testType(key, 'string', true, callback);
      retVal = this._getKey(key).length;
    }
    return this._handleCallback(callback, retVal);
  }

  /**
   * 获取子字符串
   * @param key 
   * @param start 
   * @param end 
   * @param callback 
   */
  getrange(key: string, start: number, end: number, callback?: CallbackFunction) {
    let retVal = '';
    if (this._hasKey(key)) {
      this._testType(key, 'string', true, callback);
      const value = this._getKey(key);
      retVal = value.substring(start, end + 1);
    }
    return this._handleCallback(callback, retVal);
  }

  /**
   * 设置子字符串
   * @param key 
   * @param offset 
   * @param value 
   * @param callback 
   */
  setrange(key: string, offset: number, value: string, callback?: CallbackFunction) {
    let retVal = 0;
    if (this._hasKey(key)) {
      this._testType(key, 'string', true, callback);
      const existingValue = this._getKey(key);
      const newValue = existingValue.substring(0, offset) + value + existingValue.substring(offset + value.length);
      this._setKey(key, newValue);
      retVal = newValue.length;
    } else {
      // 如果键不存在，创建一个足够长的字符串
      const newValue = ''.padEnd(offset, '\0') + value;
      this.cache.set(key, this._makeKey(newValue, 'string'));
      retVal = newValue.length;
    }
    return this._handleCallback(callback, retVal);
  }

  /**
   * 批量获取
   * @param keys 
   * @param callback 
   */
  mget(...keys: any[]) {
    const callback = this._retrieveCallback(keys);
    const retVal: any[] = [];
    
    for (const key of keys) {
      if (this._hasKey(key)) {
        this._testType(key, 'string', false, callback);
        retVal.push(this._getKey(key));
      } else {
        retVal.push(null);
      }
    }
    
    return this._handleCallback(callback, retVal);
  }

  /**
   * 批量设置
   * @param keyValuePairs 
   * @param callback 
   */
  mset(...keyValuePairs: any[]) {
    const callback = this._retrieveCallback(keyValuePairs);
    
    // 确保参数是偶数个
    if (keyValuePairs.length % 2 !== 0) {
      return this._handleCallback(callback, null, messages.wrongArgCount.replace('%0', 'mset'));
    }
    
    for (let i = 0; i < keyValuePairs.length; i += 2) {
      const key = keyValuePairs[i];
      const value = keyValuePairs[i + 1];
      this.cache.set(key, this._makeKey(value.toString(), 'string'));
    }
    
    return this._handleCallback(callback, messages.ok);
  }

  /**
   * 获取所有键
   * @param pattern 
   * @param callback 
   */
  keys(pattern: string = '*', callback?: CallbackFunction) {
    const retVal: string[] = [];
    
    this.cache.forEach((_item: any, key: any) => {
      if (pattern === '*' || this.matchPattern(key, pattern)) {
        retVal.push(key);
      }
    });
    
    return this._handleCallback(callback, retVal);
  }

  /**
   * 简单的模式匹配
   * @param key 
   * @param pattern 
   */
  private matchPattern(key: string, pattern: string): boolean {
    if (pattern === '*') return true;
    
    // 转换glob模式为正则表达式
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')
      .replace(/\[([^\]]*)\]/g, '[$1]');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(key);
  }

  /**
   * 获取随机键
   * @param callback 
   */
  randomkey(callback?: CallbackFunction) {
    const keys: string[] = [];
    this.cache.forEach((_item: any, key: any) => {
      keys.push(key);
    });
    
    if (keys.length === 0) {
      return this._handleCallback(callback, null);
    }
    
    const randomIndex = Math.floor(Math.random() * keys.length);
    return this._handleCallback(callback, keys[randomIndex]);
  }

  /**
   * 重命名键
   * @param oldKey 
   * @param newKey 
   * @param callback 
   */
  rename(oldKey: string, newKey: string, callback?: CallbackFunction) {
    if (!this._hasKey(oldKey)) {
      return this._handleCallback(callback, null, messages.nokey);
    }
    
    const value = this.cache.get(oldKey);
    this.cache.set(newKey, value);
    this.cache.delete(oldKey);
    
    return this._handleCallback(callback, messages.ok);
  }

  /**
   * 安全重命名键（目标键不存在时才重命名）
   * @param oldKey 
   * @param newKey 
   * @param callback 
   */
  renamenx(oldKey: string, newKey: string, callback?: CallbackFunction) {
    if (!this._hasKey(oldKey)) {
      return this._handleCallback(callback, null, messages.nokey);
    }
    
    if (this._hasKey(newKey)) {
      return this._handleCallback(callback, 0);
    }
    
    const value = this.cache.get(oldKey);
    this.cache.set(newKey, value);
    this.cache.delete(oldKey);
    
    return this._handleCallback(callback, 1);
  }

  /**
   * 获取键的类型
   * @param key 
   * @param callback 
   */
  type(key: string, callback?: CallbackFunction) {
    if (!this._hasKey(key)) {
      return this._handleCallback(callback, 'none');
    }
    
    const item = this.cache.get(key);
    return this._handleCallback(callback, item.type);
  }

  /**
   * 清空当前数据库
   * @param callback 
   */
  flushdb(callback?: CallbackFunction) {
    this.cache.clear();
    return this._handleCallback(callback, messages.ok);
  }

  /**
   * 清空所有数据库
   * @param callback 
   */
  flushall(callback?: CallbackFunction) {
    this.databases.clear();
    this.cache = this.createLRUCache();
    this.databases.set(this.currentDBIndex, this.cache);
    return this._handleCallback(callback, messages.ok);
  }

  /**
   * 获取数据库大小
   * @param callback 
   */
  dbsize(callback?: CallbackFunction) {
    const size = this.cache.size || 0;
    return this._handleCallback(callback, size);
  }

  /**
   * Sorted Set基础实现 - 添加成员
   * @param key 
   * @param score 
   * @param member 
   * @param callback 
   */
  zadd(key: string, score: number, member: string, callback?: CallbackFunction) {
    let retVal = 0;
    
    if (this._hasKey(key)) {
      this._testType(key, 'zset', true, callback);
    } else {
      this.cache.set(key, this._makeKey([], 'zset'));
    }
    
    const zset = this._getKey(key);
    const existing = zset.find((item: any) => item.member === member);
    
    if (existing) {
      existing.score = score;
    } else {
      zset.push({ score, member });
      retVal = 1;
    }
    
    // 按分数排序
    zset.sort((a: any, b: any) => a.score - b.score);
    this._setKey(key, zset);
    
    return this._handleCallback(callback, retVal);
  }

  /**
   * Sorted Set - 获取成员分数
   * @param key 
   * @param member 
   * @param callback 
   */
  zscore(key: string, member: string, callback?: CallbackFunction) {
    if (!this._hasKey(key)) {
      return this._handleCallback(callback, null);
    }
    
    this._testType(key, 'zset', true, callback);
    const zset = this._getKey(key);
    const item = zset.find((item: any) => item.member === member);
    
    return this._handleCallback(callback, item ? item.score : null);
  }

  /**
   * Sorted Set - 获取范围内的成员
   * @param key 
   * @param start 
   * @param stop 
   * @param callback 
   */
  zrange(key: string, start: number, stop: number, callback?: CallbackFunction) {
    if (!this._hasKey(key)) {
      return this._handleCallback(callback, []);
    }
    
    this._testType(key, 'zset', true, callback);
    const zset = this._getKey(key);
    const length = zset.length;
    
    if (stop < 0) {
      stop = length + stop;
    }
    if (start < 0) {
      start = length + start;
    }
    
    const retVal = zset.slice(start, stop + 1).map((item: any) => item.member);
    return this._handleCallback(callback, retVal);
  }

  /**
   * Sorted Set - 获取成员数量
   * @param key 
   * @param callback 
   */
  zcard(key: string, callback?: CallbackFunction) {
    if (!this._hasKey(key)) {
      return this._handleCallback(callback, 0);
    }
    
    this._testType(key, 'zset', true, callback);
    const zset = this._getKey(key);
    return this._handleCallback(callback, zset.length);
  }

  /**
   * Sorted Set - 删除成员
   * @param key 
   * @param member 
   * @param callback 
   */
  zrem(key: string, member: string, callback?: CallbackFunction) {
    let retVal = 0;
    
    if (this._hasKey(key)) {
      this._testType(key, 'zset', true, callback);
      const zset = this._getKey(key);
      const index = zset.findIndex((item: any) => item.member === member);
      
      if (index !== -1) {
        zset.splice(index, 1);
        retVal = 1;
        this._setKey(key, zset);
      }
    }
    
    return this._handleCallback(callback, retVal);
  }
}