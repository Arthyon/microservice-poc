import * as check from "check-types";
import * as log4js from "log4js";
import { IStoreFull, IBag, IClosePickupPoint } from "@ng-mw/platform-interfaces";
import { getEsStoreAsIStoreFull, mapClosePickupPoint } from "../mappers/store-mapper";
import { getMerchantsForChain,getMerchant } from "../storage/merchants";
import { RedisCache } from "../storage/RedisCache";
import { isNil } from "lodash";
import { handleRequest } from "../utils/external-request";
const search = require("./elasticsearch");
const logger: log4js.Logger = log4js.getLogger("store-service");
const configuration = require("../../../configs/elasticsearch/config.json");
const storeConfiguration = configuration.storeSearch;

export function isKnownChainId(chainId: number): boolean {
	return chainId in storeConfiguration.chainAliases;
}

/**
 * @param options holds the various fields
 * @param options.fields fields to return
 * @param {String} options.type overrides default type in elasticsearch, usually not necessary
 * @param {String} options.search returns all hits that matches a given query
 * @param callback
 */
export function getSingleStore(options, callback?): Promise<any> {
	check.assert(isKnownChainId(options.chain_id));
	check.assert(options.store_id !== undefined);
	return new Promise((resolve, reject) => {
		const searchObject: object = {
			index: storeConfiguration.chainAliases[options.chain_id],
			type: options.type || storeConfiguration.type,
			_source: options.fields || storeConfiguration.returnFields,
			fullResponse: options.full_response ? options.full_response : false,
			id: options.store_id,
		};
		search.get(searchObject, (err, result) => {
			if (callback) {
				callback(err, result);
			} else {
				if (err) {
					reject(err);
				} else {
					resolve(result);
				}
			}
		});
	});
}

/**
 * Function fetches all fields for a store in ES and maps it to an IStoreFull object
 * @param options holds the various input params
 * @param options.chain_id
 * @param options.store_id
 * @param callback
 */
export function getSingleStoreAsIStoreFull(options, callback?): Promise<IStoreFull> {
	check.assert(isKnownChainId(options.chain_id));
	check.assert(options.store_id !== undefined);
	if (options.fields) {
		throw new Error("fields are not supported using this function. Use getSingleStore()");
	}
	return new Promise((resolve, reject) => {
		const searchObject: object = {
			index: storeConfiguration.chainAliases[options.chain_id],
			type: storeConfiguration.type,
			_source: storeConfiguration.returnFields,
			fullResponse: false,
			id: options.store_id,
		};
		search.get(searchObject, (err, result) => {
			if (callback) {
				callback(err, result);
			} else {
				if (err) {
					reject(err);
				} else {
					getEsStoreAsIStoreFull(result)
						.then((storeFull) => {
							resolve(storeFull);
						})
						.catch((mapperError) => {
							reject(mapperError);
						});
				}
			}
		});
	});
}

/**
 * @param options holds the various fields
 * @param options.fields fields to return
 * @param {String} options.type overrides default type in elasticsearch, usually not necessary
 * @param {String} options.search returns all hits that matches a given query
 * @param callback
 */
export function getAllStores(options, callback?): Promise<any> {
	check.assert(isKnownChainId(options.chain_id));
	return new Promise((resolve, reject) => {
		const searchObject: object = {
			index: storeConfiguration.chainAliases[options.chain_id],
			type: options.type || storeConfiguration.type,
			size: storeConfiguration.scrollSize,
			_source: options.fields || storeConfiguration.returnFields,
			fullResponse: options.full_response ? options.full_response : false,
			body: queryExpression(options),
		};
		search.scrollEs(searchObject, (err, result) => {
			if (callback) {
				callback(err, result);
			} else {
				if (err) {
					reject(err);
				} else {
					resolve(result);
				}
			}
		});
	});
}

/**
 * Function fetches all fields for a store in ES and maps it to an IStoreFull object.
 * If a
 * @param options holds the various input params
 * @param options.chain_id
 * @param options.member_id if set, the function will fetch whitelisted stores enabled for this user
 * @param callback
 */
export function getAllStoresAsIStoreFull(options, callback?): Promise<Array<IStoreFull>> {
	check.assert(isKnownChainId(options.chain_id));
	if (options.fields) {
		throw new Error("fields are not supported using this function. Use getAllStores()");
	}
	return new Promise((resolve, reject) => {
		const searchObject: object = {
			index: storeConfiguration.chainAliases[options.chain_id],
			type: storeConfiguration.type,
			size: storeConfiguration.scrollSize,
			_source: storeConfiguration.returnFields,
			fullResponse: false,
			body: queryExpression(options),
		};
		search.scroll(searchObject, async (err, result) => {
			if (callback) {
				callback(err, result);
			} else {
				if (err) {
					reject(err);
				} else {
					const stores: Array<IStoreFull> = new Array<IStoreFull>();
					for (const store of result) {
						await getEsStoreAsIStoreFull(store).then((mappedStore) => {
							stores.push(mappedStore);
						});
					}
					resolve(stores);
				}
			}
		});
	});
}

/**
 * Get all stores that has a valid PayEx accountNumber and encryptionKey.
 * @param options holds the various input params
 * @param options.chain_id
 * @param options.member_id if set, the function will fetch whitelisted stores enabled for this user
 * @param callback
 */
export async function getStoresWithValidPayexSettings(options): Promise<Array<IStoreFull>> {
	const p1 = getMerchantsForChain(options.chain_id);
	const p2 = getAllStoresAsIStoreFull(options);

	return Promise.all([p1, p2])
		.then((values) => {
			const merchants = values[0];
			const stores = values[1];
			const filteredStores = stores.filter((store) => {
				return merchants.find((merchant) => {
					if (!merchant) {
						return false;
					}

					if (merchant.gln === store.gln) {
						if (merchant.accountNumber && merchant.encryptionKey) {
							return true;
						} else {
							return false;
						}
					} else {
						return false;
					}
				});
			});
			return filteredStores;
		})
		.catch((err) => {
			logger.error("getStores: Could not get all stores", err);
			throw err;
		});
}

export const getStoreStatus = async (
	gln: string,
	chainId: string,
	memberId?: string,
): Promise<{ isActive: boolean; errorCode?: number }> => {
	try {
		const options = {
			store_id: gln,
			chain_id: chainId,
			fields: ["whitelist", "whitelistedMembers"],
		};
		const store = await getSingleStore(options);
		if (store.whitelist) {
			// Whitelisted store
			if (memberId !== undefined) {
				if (!store.whitelistedMembers.some((m) => m === memberId)) {
					return { isActive: false, errorCode: 98 };
				}
			} else {
				return { isActive: false, errorCode: 98 };
			}
		}
		const merchant = await getMerchant(gln);
		const invalidPayexSettings = !merchant.accountNumber || !merchant.encryptionKey;
		const invalidAeraSettings = !merchant.aeraStoreCode;
		if (invalidPayexSettings && invalidAeraSettings) {
			// Invalid payex OR aera config
			return { isActive: false, errorCode: 99 };
		}

		return { isActive: true };
	} catch (err) {
		if (err.statusCode === 404) {
			return { isActive: false, errorCode: 100 };
		} else {
			logger.error(err.message + "[getStoreStatus]");
			return { isActive: false, errorCode: 101 };
		}
	}
};

/**
 * @param options holds the various fields
 * @param options.fields fields to return
 * @param {String} options.type overrides default type in elasticsearch, usually not necessary
 * @param {String} options.search returns all hits that matches a given query
 * @param callback
 */
export function getStoresBagFees(options): Promise<Array<IBag>> {
	check.assert(isKnownChainId(options.chain_id));
	check.assert(options.store_id !== undefined);
	return new Promise((resolve, reject) => {
		const searchObject: object = {
			index: storeConfiguration.chainAliases[options.chain_id],
			type: options.type || storeConfiguration.type,
			_source: options.fields || storeConfiguration.returnFields,
			fullResponse: options.full_response ? options.full_response : false,
			id: options.store_id,
		};
		search.get(searchObject, (err, result) => {
			if (err) {
				reject(err);
			} else {
				if (!isNil(result.specialGoods) && !isNil(result.specialGoods.bags)) {
					const bags = result.specialGoods.bags;
					resolve(bags);
				}
				reject("Something wrong with result.specialGoods.bags");
			}
		});
	});
}

function queryExpression(options): object {
	const retObject: any = {
		query: {
			bool: {
				must: [],
			},
		},
	};
	// If member_id is provided, search for stores with whitelisting
	if (options.member_id) {
		// Check if integer
		retObject.query.bool.must.push({
			bool: {
				should: [
					{
						term: {
							whitelist: false,
						},
					},
					{
						terms: {
							whitelistedMembers: [options.member_id],
						},
					},
				],
			},
		});
	} else {
		retObject.query.bool.must.push({
			term: {
				whitelist: false,
			},
		});
	}
	if (options.hasValidHomeDeliveryData) {
		retObject.query.bool.must.push({
			term: {
				hasValidHomeDeliveryData: true,
			},
		});
	}

	return retObject;
}

export async function getClosestInpostalCode(
	chainId: string,
	postalCode: string,
	isStore: boolean,
): Promise<Array<IClosePickupPoint>> {
	const storeOrPickupPoint = isStore ? "butikker" : "hentepunkter";
	const redisKey = storeOrPickupPoint + postalCode;
	try {
		const cachedData = await RedisCache.get(redisKey);
		return JSON.parse(cachedData);
	} catch (err) {
		try {
			// const authorizationHeader = await oamAuthorization.getClickAndCollectAuthorizationHeader();
			const options: any = {
				method: "GET",
				originalUrl:
					"/tjenester/kjeder/" + chainId + "/" + storeOrPickupPoint + "/avstand/postnummer/" + postalCode,
				headers: {
					"x-target-server": "click & collect",
					Authorization: "Basic Y2NicnVrZXI6Y2NicnVrZXIyMDE0",
					"content-type": "application/json",
				},
			};
			const result = await handleRequest(options);
			const response = JSON.parse(result.response);
			const list = response.map((element) => mapClosePickupPoint(element));
			await RedisCache.set(redisKey, JSON.stringify(list));
			RedisCache.expire(redisKey, RedisCache.TTL_ONE_MINUTE * 30);
			return list;
		} catch (err) {
			logger.error("Could not fetch closest stores/pickup point based on postal code", err);
			return [];
		}
	}
}