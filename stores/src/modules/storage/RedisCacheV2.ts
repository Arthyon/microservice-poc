/**
 * Redis client which can be instansiated with
 * a host, port and a key. This class is more flexible
 * than the old static RedisClient in that it allows
 * the configuration of different hosts.
 * @author Jørn Kinderås
 * @since 18.05.2017
 */
import * as log4js from "log4js";
import * as redis from "redis";
import { load } from "../../config/config-loader";
const config: any = load();

const logger = log4js.getLogger("RedisCacheV2");

export interface IRedisStatus {
	address: string;
	connected: boolean;
	commandQueueLength: number;
	offlineQueueLength: number;
	serverInfo: redis.ServerInfo;
}

export default class RedisCacheV2 {
	/**
	 * Static values for setting expire time
	 * for a key
	 */
	public static TTL_ONE_MINUTE: number = 60;
	public static TTL_ONE_HOUR: number = 60 * 60;
	public static TTL_ONE_DAY: number = 24 * RedisCacheV2.TTL_ONE_HOUR;
	public static TTL_ONE_WEEK: number = 7 * RedisCacheV2.TTL_ONE_DAY;
	public static TTL_ONE_MONTH: number = 4 * RedisCacheV2.TTL_ONE_WEEK;

	private _client: redis.RedisClient;
	private _isConnected: boolean = false;
	private _connectPromise;

	/**
	 * The connect method returns an instance of this class or an error
	 * Note that if the «TEST_MODE» env variable is set this will
	 * connect to the fakeredis instance and ignore the passed host
	 * @param host The host URL
	 * @param port The port for the host
	 * @param authKey The auth key, can be an empty string
	 */
	public connect(host: string, port: number, authKey: string): Promise<RedisCacheV2> {
		logger.debug("## RedisCacheV2 - connect called");

		if (this._isConnected) {
			logger.debug("## RedisCacheV2 - already connected");
			return Promise.resolve(this);
		}

		if (this._client && this._connectPromise) {
			logger.debug("## RedisCacheV2 - has client returning pending promise");
			return this._connectPromise;
		}

		logger.info("## RedisCacheV2 - creating new client");
		this._connectPromise = new Promise((resolve: (data?: any) => void, reject: (err: Error) => void) => {
			// If a test is being run
			// Then create a mock redis client
			// to avoid acctually writing / reading
			// to / from Redis during unit tests
			if (config.TEST_MODE || config.NODE_ENV === "test") {
				/* tslint:disable */
				this._client = require("fakeredis").createClient(port, host);
				/* tslint:enable */
				logger.info("## RedisCache (TEST) connected");
				this._isConnected = true;
				return resolve(this);
			}

			this._client = redis.createClient(port, host, {
				return_buffers: false,
			});

			if (config.NODE_ENV !== "local") {
				this._client.auth(authKey);
			}

			this._client
				.on("ready", () => {
					logger.info("## RedisCacheV2 - connected");
					this._isConnected = true;
					this.setPingInterval();
					resolve(this);
				})
				.on("end", () => {
					this._isConnected = false;
				})
				.on("error", (err: Error) => {
					logger.error("## RedisCacheV2 - failed " + err);
					reject(err);
				});
		});

		return this._connectPromise;
	}

	/**
	 * Fetches data for a key from redis
	 * @param key The key to fetch data for
	 */
	public get(key: string): Promise<any> {
		if (typeof key !== "string") {
			return Promise.reject("Missing key");
		}

		return new Promise((resolve: (data?: any) => void, reject: (err: Error) => void) => {
			(this._client as any).get(key, (err?: Error, res?: any) => {
				if (err || res === null) {
					return reject(err || new Error("Not found"));
				}

				resolve(res);
			});
		});
	}

	/**
	 * Writes data for a key to redis
	 * @param key The key to indentify the data
	 * @param data The data, can be any object
	 * @param useRaw If true, will return the raw string as stored in redis (default true)
	 */
	public set(key: string, data: any, useRaw: boolean = true): Promise<any> {
		if (typeof key !== "string") {
			return Promise.reject("Missing key");
		}

		if (!data) {
			return Promise.reject("The data param cannot be empty");
		}

		return new Promise((resolve: (data?: any) => void, reject: (err: Error) => void) => {
			(this._client as any).set(key, data, (err?: Error, res?: any) => {
				if (err) {
					return reject(err);
				}

				res = useRaw ? res : JSON.parse(res);

				resolve(res);
			});
		});
	}

	/**
	 * Writes data for a key to redis with timeout
	 * @param key The key to indentify the data
	 * @param timeout Number of seconds before key is invalid
	 * @param data The data, can be any object
	 * @param useRaw If true, will return the raw string as stored in redis (default true)
	 */
	public setex(key: string, timeout: number, data: any, useRaw: boolean = true): Promise<any> {
		if (typeof key !== "string") {
			return Promise.reject("Missing key");
		}
		if (typeof timeout !== "number") {
			return Promise.reject("Timeout should be a number");
		}
		if (!data) {
			return Promise.reject("The data param cannot be empty");
		}

		return new Promise((resolve: (data?: any) => void, reject: (err: Error) => void) => {
			(this._client as any).setex(key, timeout, data, (err?: Error, res?: any) => {
				if (err) {
					return reject(err);
				}
				res = useRaw ? res : JSON.parse(res);
				resolve(res);
			});
		});
	}

	/**
	 * Set the time to live for the given key
	 * @param {string} key - The key to set TTL for
	 * @param {number} ttl - Time to live
	 */
	public expire(key: string, ttl: number = RedisCacheV2.TTL_ONE_MINUTE): Promise<any> {
		if (typeof key !== "string") {
			return Promise.reject("Missing key");
		}

		return new Promise((resolve: any, reject: (err: Error) => void) => {
			(this._client as any).expire(key, ttl, (err?: Error, res?: any) => {
				if (err) {
					return reject(err);
				}
				resolve(res);
			});
		});
	}

	/**
	 * Removes data for a given key
	 * @param key The key to delete
	 */
	public del(key: string) {
		if (typeof key !== "string") {
			return Promise.reject("Missing key");
		}

		return new Promise((resolve: (data?: any) => void, reject: (err: Error) => void) => {
			(this._client as any).del(key, (err?: Error, res?: any) => {
				if (err) {
					return reject(err);
				}

				resolve(res);
			});
		});
	}

	/**
	 * Method for scanning the Redis index for a matching key pattern.
	 * Not horribly efficient O(n) (full iteration), så use with consideration
	 * (n == number of keys)
	 * @param pattern
	 */
	public scan(pattern: string): Promise<Array<string>> {
		return new Promise((resolve: (data: Array<string>) => void, reject: (err: Error) => void) => {
			// The cursor is a string, start it on 0
			let currentCursor = "0";
			let foundKeys = [];

			// Helper function for guaranteeing unique keys
			// since scan does not guarantee this.
			function onlyUnique(value, index, self) {
				return self.indexOf(value) === index;
			}

			// "Recursive" function for scanning all keys
			function scan(client) {
				client.scan(currentCursor, "MATCH", pattern, (err?: Error, res?: any) => {
					if (err) {
						return reject(err);
					}

					// Update the cursor
					currentCursor = res[0];

					// Get the matched keys
					const keys = res[1];

					// If additional keys where found
					// add them to the found array
					if (keys.length > 0) {
						foundKeys = foundKeys.concat(keys);
					}

					// If the cursor is 0 we are done
					if (currentCursor === "0") {
						// make sure we only have unique keys
						const onlyUniqueKeys = foundKeys.filter(onlyUnique);
						// resolve with the keys
						return resolve(onlyUniqueKeys);
					}

					// more keys, go again
					return scan(client);
				});
			}
			// start the scan
			scan(this._client);
		});
	}

	/*
		LLEN(key)
		Returns the length of the list stored at key.
		If key does not exist, it is interpreted as an empty list and 0 is returned.
		An error is returned when the value stored at key is not a list.
		https://redis.io/commands/llen
	*/
	public llen(key: string): Promise<number> {
		if (typeof key !== "string") {
			return Promise.reject("Missing key");
		}

		return new Promise((resolve: (data?: any) => void, reject: (err: Error) => void) => {
			(this._client as any).llen(key, (err?: Error, res?: any) => {
				if (err) {
					return reject(err);
				}
				resolve(res);
			});
		});
	}

	/*
		LPUSH(key)
		Insert all the specified values at the head of the list stored at key.
		If key does not exist, it is created as empty list before performing the push operations.
		When key holds a value that is not a list, an error is returned.

		It is possible to push multiple elements using a single command call just specifying multiple
		arguments at the end of the command. Elements are inserted one after the other to the head of the list,
		from the leftmost element to the rightmost element. So for instance the command LPUSH mylist a b c will
		result into a list containing c as first element, b as second element and a as third element.
		https://redis.io/commands/lpush
	*/
	public lpush(key: string, value: string): Promise<number> {
		if (typeof key !== "string") {
			return Promise.reject("Missing key");
		}

		return new Promise((resolve: (data?: any) => void, reject: (err: Error) => void) => {
			(this._client as any).lpush(key, value, (err?: Error, res?: any) => {
				if (err) {
					return reject(err);
				}
				resolve(res);
			});
		});
	}

	/*
		RPOP(key)
		Removes and returns the last element of the list stored at key.
		Returns the value of the last element, or nil when key does not exist.
		https://redis.io/commands/rpop
	*/
	public rpop(key: string): Promise<string> {
		if (typeof key !== "string") {
			return Promise.reject("Missing key");
		}

		return new Promise((resolve: (data?: any) => void, reject: (err: Error) => void) => {
			(this._client as any).rpop(key, (err?: Error, res?: any) => {
				if (err) {
					return reject(err);
				}
				resolve(res);
			});
		});
	}

	/**
	 * LRANGE(key, start, end)
	 * Returns the specified elements of the list stored at key.
	 * The offsets start and stop are zero-based indexes, with 0 being the first element of the list
	 * (the head of the list), 1 being the next element and so on.
	 * These offsets can also be negative numbers indicating offsets starting at the end of the list.
	 * For example, -1 is the last element of the list, -2 the penultimate, and so on.
	 */
	public lrange(key: string, start: number = 0, end: number = -1): Promise<Array<any>> {
		if (typeof key !== "string") {
			return Promise.reject("Missing key");
		}

		return new Promise((resolve, reject) => {
			(this._client as any).lrange(key, start, end, (err?: Error, res?: Array<any>) => {
				if (err) {
					return reject(err);
				}
				resolve(res);
			});
		});
	}

	/**
	 * LTRIM(key, start, end)
	 * Trim an existing list so that it will contain only the specified range
	 * of elements specified. Both start and stop are zero-based indexes,
	 * where 0 is the first element of the list (the head), 1 the next element and so on.
	 */
	public ltrim(key: string, start: number, end: number = -1): Promise<Array<any>> {
		if (typeof key !== "string") {
			return Promise.reject("Missing key");
		}

		return new Promise((resolve, reject) => {
			(this._client as any).ltrim(key, start, end, (err?: Error, res?: any) => {
				if (err) {
					return reject(err);
				}
				resolve(res);
			});
		});
	}

	/**
	 * Removes all elements in the sorted set stored at key with rank between
	 * start and stop. Both start and stop are 0 -based indexes with 0 being
	 * the element with the lowest score. These indexes can be negative numbers,
	 * where they indicate offsets starting at the element with the highest score.
	 * For example: -1 is the element with the highest score, -2 the element with
	 * the second highest score and so forth.
	 */
	public zremrangebyrank(key: string, start: number, stop: number = -1): Promise<Array<any>> {
		if (typeof key !== "string") {
			return Promise.reject("Missing key");
		}

		return new Promise((resolve, reject) => {
			(this._client as any).zremrangebyrank(key, start, stop, (err?: Error, res?: any) => {
				if (err) {
					return reject(err);
				}
				resolve(res);
			});
		});
	}

	/**
	 * Add the specified members to the set stored at key. Specified members that are
	 * already a member of this set are ignored. If key does not exist, a new set is
	 * created before adding the specified members.
	 */
	public sadd(key: string, member: string) {
		if (typeof key !== "string") {
			return Promise.reject("Missing key");
		}

		return new Promise((resolve, reject) => {
			(this._client as any).sadd(key, member, (err?: Error, res?: any) => {
				if (err) {
					return reject(err);
				}
				resolve(res);
			});
		});
	}

	/**
	 * Remove the specified members from the set stored at key. Specified
	 * members that are not a member of this set are ignored. If key does
	 * not exist, it is treated as an empty set and this command returns 0.
	 */
	public srem(key: string, member: string) {
		if (typeof key !== "string") {
			return Promise.reject("Missing key");
		}

		return new Promise((resolve, reject) => {
			(this._client as any).srem(key, member, (err?: Error, res?: any) => {
				if (err) {
					return reject(err);
				}
				resolve(res);
			});
		});
	}

	/**
	 * Adds all the specified members with the specified scores to the sorted set stored at key.
	 * It is possible to specify multiple score / member pairs. If a specified member is already
	 * a member of the sorted set, the score is updated and the element reinserted at the right
	 * position to ensure the correct ordering.
	 */
	public zadd(key: string, score: number, member: string) {
		if (typeof key !== "string") {
			return Promise.reject("Missing key");
		}

		return new Promise((resolve, reject) => {
			(this._client as any).zadd(key, score, member, (err?: Error, res?: any) => {
				if (err) {
					return reject(err);
				}
				resolve(res);
			});
		});
	}

	/**
	 * Returns the specified range of elements in the sorted set stored at key.
	 * The elements are considered to be ordered from the lowest to the highest score.
	 * Lexicographical order is used for elements with equal score.
	 */
	public zrange(key: string, start: number, stop: number = -1): Promise<Array<any>> {
		if (typeof key !== "string") {
			return Promise.reject("Missing key");
		}

		return new Promise((resolve, reject) => {
			(this._client as any).zrange(key, start, stop, (err?: Error, res?: any) => {
				if (err) {
					return reject(err);
				}
				resolve(res);
			});
		});
	}
	/**
	 * Returns misc status data for the redis instance
	 */
	public status(): IRedisStatus {
		return {
			address: config.caching.redis.host + ":" + config.caching.redis.port,
			connected: this._client.connected,
			commandQueueLength: this._client.command_queue.length,
			offlineQueueLength: this._client.offline_queue.length,
			serverInfo: this._client.server_info,
		};
	}

	private setPingInterval(): void {
		setInterval(() => {
			this._client.ping();
		}, 1000 * 60 * 2);
	}
}
