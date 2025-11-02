/*
 * @Description: 
 * @Usage: 
 * @Author: richen
 * @Date: 2023-02-18 23:58:10
 * @LastEditTime: 2023-02-18 23:58:15
 */

export interface CacheStoreInterface {
  // 连接管理 - 必需
  getConnection(): any;
  close(): Promise<void>;
  release(conn: any): Promise<void>;
  
  // 基础操作 - 必需
  get(name: string): Promise<string | null>;
  set(name: string, value: string | number, timeout?: number): Promise<string>;
  del(name: string): Promise<number>;
  exists(name: string): Promise<number>;
  ttl(name: string): Promise<number>;
  expire(name: string, timeout: number): Promise<number>;
  
  // 数值操作 - 必需
  incr(name: string): Promise<number>;
  decr(name: string): Promise<number>;
  incrby(name: string, increment: number): Promise<number>;
  decrby(name: string, decrement: number): Promise<number>;
  
  // Hash 操作 - 必需
  hset(name: string, key: string, value: string | number, timeout?: number): Promise<number>;
  hget(name: string, key: string): Promise<string | null>;
  hdel(name: string, key: string): Promise<number>;
  hexists(name: string, key: string): Promise<number>;
  hgetall(name: string): Promise<any>;
  hkeys(name: string): Promise<string[]>;
  hvals(name: string): Promise<any[]>;
  hlen(name: string): Promise<number>;
  hincrby(name: string, key: string, increment: number): Promise<number>;
  
  // List 操作 - 必需
  lpush(name: string, value: string | number): Promise<number>;
  rpush(name: string, value: string | number): Promise<number>;
  lpop(name: string): Promise<string | null>;
  rpop(name: string): Promise<string | null>;
  llen(name: string): Promise<number>;
  lrange(name: string, start: number, stop: number): Promise<any[]>;
  
  // Set 操作 - 必需
  sadd(name: string, value: string | number, timeout?: number): Promise<number>;
  srem(name: string, key: string): Promise<number>;
  scard(name: string): Promise<number>;
  sismember(name: string, key: string): Promise<number>;
  smembers(name: string): Promise<any[]>;
  spop(name: string): Promise<any>;
  smove(source: string, destination: string, member: string): Promise<number>;
}