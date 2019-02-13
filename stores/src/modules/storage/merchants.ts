import { IMerchantInfo } from "./interfaces/IMerchantInfo";
import * as azureStorage from "azure-storage";
import * as log4js from "log4js";
import { load } from "../../config/config-loader";
import { Exception } from "../utils/errors";
import { RedisCache } from "./RedisCache";
const logger: log4js.Logger = log4js.getLogger("MerchantInfo-storage");

const config: any = load();
const tableName = "MerchantInfo";
let service: azureStorage.TableService;

/**
 * Table storage setup
 * Returns a table storage service
 */
const connect = (): Promise<any> => {
	if (service) {
		Promise.resolve(service);
	}
	return new Promise((resolve, reject) => {
		const fallback = new Buffer("Hello World").toString("base64");
		service = azureStorage.createTableService(
			config.PLATFORM_STORAGE_ACCOUNT,
			config.PLATFORM_STORAGE_KEY || fallback,
		);

		service.createTableIfNotExists(tableName, (error: any) => {
			if (!error) {
				resolve(service);
			} else {
				const statusCode = error.statusCode ? error.statusCode : 500;
				const code = error.code || "";
				const message = error.message;
				logger.error(
					`Error while establishing connection to MerchantInfo table storage - \
					 statusCode: ${statusCode}, code: ${code}, message: ${message}`,
				);

				reject(
					new Exception({
						code: statusCode,
						message: "MerchantInfo table storage - " + message,
					}),
				);
			}
		});
	});
};

export function getMerchant(gln: string): Promise<IMerchantInfo> {
	const cacheKey = getCacheKeyForSingleMerchant(gln);
	return RedisCache.get(cacheKey)
		.then((result) => {
			try {
				const merchants = JSON.parse(result) as IMerchantInfo;
				return merchants;
			} catch (err) {
				throw err;
			}
		})
		.catch((err) => {
			return new Promise((resolve, reject) => {
				connect()
					.then((tsService: azureStorage.TableService) => {
						tsService.retrieveEntity(tableName, gln, gln, (error: any, result) => {
							if (error) {
								logger.error(`Failed to retrieve merchant with GLN: ${gln}.`, error);
								reject(
									new Exception({
										message: error.message,
										code: error.statusCode,
									}),
								);
							} else {
								if (result) {
									const merchant: IMerchantInfo = mapEntity(result);
									if (!merchant.accountNumber || !merchant.encryptionKey) {
										logger.warn(`${merchant.name} is missing AccountNumber and/or EncryptionKey`);
									}
									cacheMerchants(cacheKey).catch(() => {
										// ..
									});
									resolve(merchant);
								}
							}
						});
					})
					.catch(reject);
			});
		});
}

export function getMerchantsForChain(chainId: string): Promise<Array<IMerchantInfo>> {
	const cacheKey = getCacheKeyForAllMerchantsInChain(chainId);
	return RedisCache.get(cacheKey)
		.then((result) => {
			try {
				const merchants = JSON.parse(result) as Array<IMerchantInfo>;
				return merchants;
			} catch (err) {
				throw err;
			}
		})
		.catch((err) => {
			return new Promise((resolve, reject) => {
				connect()
					.then((tsService: azureStorage.TableService) => {
						const merchants: Array<IMerchantInfo> = [];

						const query = new azureStorage.TableQuery().where("ChainId eq ?", chainId);

						// Dirty fix since the typing for azureStorage is lacking
						(tsService as any).queryEntities(tableName, query, null, (error: any, result) => {
							if (error) {
								const statusCode = error.statusCode || 500;
								logger.error(`Failed to query merchants-entities with ChainId: ${chainId}.`, error);
								reject(
									new Exception({
										message: error.message,
										code: statusCode,
									}),
								);
							} else {
								if (Array.isArray(result.entries) && result.entries.length > 0) {
									result.entries.forEach((entry) => {
										const merchant: IMerchantInfo = mapEntity(entry);
										if (!merchant.accountNumber || !merchant.encryptionKey) {
											logger.error(
												`${merchant.name} (GLN: "${
													merchant.gln
												}") is missing AccountNumber and/or EncryptionKey`,
											);
										} else {
											merchants.push(merchant);
										}
									});
									cacheMerchants(cacheKey, merchants).catch(() => {
										// ..
									});
									resolve(merchants);
								} else {
									const errorMessage =
										"getMerchantsForChain, Azure-response is not an array or is empty";
									return reject(
										new Exception({
											message: errorMessage,
											code: 500,
										}),
									);
								}
							}
						});
					})
					.catch(reject);
			});
		});
}

export function getAllMerchants(): Promise<Array<IMerchantInfo>> {
	const cacheKey = getCacheKeyForAllMerchants();
	return RedisCache.get(cacheKey)
		.then((result) => {
			try {
				const merchants = JSON.parse(result) as Array<IMerchantInfo>;
				return merchants;
			} catch (err) {
				throw err;
			}
		})
		.catch((err) => {
			return new Promise((resolve, reject) => {
				connect()
					.then((tsService: azureStorage.TableService) => {
						const merchants: Array<IMerchantInfo> = [];
						// Dirty fix since the typing for azureStorage is lacking
						(tsService as any).queryEntities(
							tableName,
							new azureStorage.TableQuery(),
							null,
							(error: any, result) => {
								if (error) {
									const statusCode = error.statusCode || 500;
									logger.error(`Failed to query merchants-entities:`, error);
									reject(
										new Exception({
											message: error.message,
											code: statusCode,
										}),
									);
								} else {
									if (Array.isArray(result.entries) && result.entries.length > 0) {
										result.entries.forEach((entry: any) => {
											const merchant: IMerchantInfo = mapEntity(entry);
											if (!merchant.accountNumber || !merchant.encryptionKey) {
												logger.error(
													`${merchant.name} (GLN: "${
														merchant.gln
													}") is missing AccountNumber and/or EncryptionKey`,
												);
											} else {
												merchants.push(merchant);
											}
										});
										cacheMerchants(cacheKey, merchants).catch(() => {
											// ..
										});
										resolve(merchants);
									} else {
										throw new Exception({
											message: "getAllMerchants, Azure-response is not an array or is empty.",
											code: 500,
										});
									}
								}
							},
						);
					})
					.catch(reject);
			});
		});
}

const mapEntity = (entity): IMerchantInfo => {
	const merchant: IMerchantInfo = {
		chainId: pick(entity, "ChainId"),
		gln: pick(entity, "RowKey"),
		accountNumber: pick(entity, "AccountNumber"),
		encryptionKey: pick(entity, "EncryptionKey"),
		name: pick(entity, "Name"),
		oneClickDefaultMaxAmount: pick(entity, "OneClickDefaultMaxAmount"),
		zoopitAccessKey: pick(entity, "ZoopitAccessKey"),
		aeraStoreCode: pick(entity, "AeraStoreCode"),
	};
	return merchant;
};

const pick = (object, attr) => {
	return object[attr] ? object[attr]._ : null;
};

const getCacheKeyForAllMerchants = (): string => {
	return "merchants";
};

const getCacheKeyForAllMerchantsInChain = (chainId: string): string => {
	return `merchant-${chainId}`;
};

const getCacheKeyForSingleMerchant = (gln: string): string => {
	return `merchant-${gln}`;
};

const cacheMerchants = (key: string, data?: any): Promise<any | undefined> => {
	try {
		const pSetMerchants: Promise<any> = RedisCache.set(key, JSON.stringify(data));
		const pSetExpireTime: Promise<any> = RedisCache.expire(key, RedisCache.TTL_ONE_DAY);
		return Promise.all([pSetMerchants, pSetExpireTime]);
	} catch (err) {
		// don't throw error
		logger.error("cacheMerchants: failed", err);
		return Promise.resolve();
	}
};

export const invalidateCache = async (chainId: string): Promise<any> => {
	try {
		const merchants = await getMerchantsForChain(chainId);
		const list = new Array<Promise<any>>();

		for (const merchant of merchants) {
			list.push(RedisCache.del(getCacheKeyForSingleMerchant(merchant.gln)));
		}

		list.push(RedisCache.del(getCacheKeyForAllMerchantsInChain(chainId)));
		list.push(RedisCache.del(getCacheKeyForAllMerchants()));

		return Promise.all(list)
			.then(() => {
				return { success: true };
			})
			.catch((err) => {
				throw new Exception({ success: false, error: err });
			});
	} catch (err) {
		logger.error("invalidateCache - could not invalidate cache because an error occured", err);
		throw err;
	}
};
