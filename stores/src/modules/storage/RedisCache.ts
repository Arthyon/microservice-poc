/**
 * This module is just a static proxy to RedisCacheV2
 * You should use this module to store simple data in the
 * default redis server for platform.
 *
 * If you need to use a custom redis host, use RedisCacheV2 instead
 */
import * as log4js from "log4js";
import RedisCacheV2 from "./RedisCacheV2";
import { load } from "../../config/config-loader";
const config: any = load();

export class RedisCache {
	public static TTL_ONE_MINUTE: number = 60;
	public static TTL_ONE_HOUR: number = 60 * 60;
	public static TTL_ONE_DAY: number = 24 * RedisCacheV2.TTL_ONE_HOUR;
	public static TTL_ONE_WEEK: number = 7 * RedisCacheV2.TTL_ONE_DAY;
	public static TTL_ONE_MONTH: number = 4 * RedisCacheV2.TTL_ONE_WEEK;

	private static _logger: log4js.Logger = log4js.getLogger("Rediscache");
	private static _client: RedisCacheV2;

	public static init(): Promise<any> {
		if (!RedisCache._client) {
			RedisCache._client = new RedisCacheV2();
		}
		RedisCache._logger.info("Initing global RedisCache");

		return RedisCache._client.connect(config.caching.redis.host, config.caching.redis.port, config.REDIS_KEY);
	}

	public static get(key: string): Promise<any> {
		return RedisCache._client.get(key);
	}

	public static set(key: string, data: any, useRaw: boolean = true): Promise<any> {
		return RedisCache._client.set(key, data, useRaw);
	}

	public static setex(key: string, timeout: number, data: any, useRaw: boolean = true): Promise<any> {
		return RedisCache._client.setex(key, timeout, data, useRaw);
	}

	public static expire(key: string, ttl: number): Promise<any> {
		return RedisCache._client.expire(key, ttl);
	}

	public static del(key: string) {
		return RedisCache._client.del(key);
	}

	public static scan(pattern: string): Promise<Array<string>> {
		return RedisCache._client.scan(pattern);
	}

	public static llen(key: string): Promise<number> {
		return RedisCache._client.llen(key);
	}

	public static lpush(key: string, value: string): Promise<number> {
		return RedisCache._client.lpush(key, value);
	}

	public static rpop(key: string): Promise<string> {
		return RedisCache._client.rpop(key);
	}

	public static lrange(key: string, start: number = 0, end: number = -1) {
		return RedisCache._client.lrange(key, start, end);
	}

	public static ltrim(key: string, start: number, end: number = -1) {
		return RedisCache._client.ltrim(key, start, end);
	}

	public static zremrangebyrank(key: string, start: number = 0, end: number = -1) {
		return RedisCache._client.zremrangebyrank(key, start, end);
	}

	public static zadd(key: string, score: number, member: string) {
		return RedisCache._client.zadd(key, score, member);
	}

	public static zrange(key: string, start: number, end: number) {
		return RedisCache._client.zrange(key, start, end);
	}

	public static sadd(key: string, member: string) {
		return RedisCache._client.sadd(key, member);
	}

	public static srem(key: string, member: string) {
		return RedisCache._client.srem(key, member);
	}

	public static status() {
		return RedisCache._client.status();
	}
}
