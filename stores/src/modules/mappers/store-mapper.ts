import { IStoreFull, ISpecialGoods, IBag, IHomeDeliveryFeeGroup, IClosePickupPoint } from "@ng-mw/platform-interfaces";
import { mapPickupFees, mapHomeDelivery, mapHomeDeliveryFees } from "./fees-mapper";
import { mapStorePickupSlots } from "./pickupslots-mapper";
import { mapAlcoholGrant } from "./alcohol-mapper";
import { isNil } from "lodash";

import * as log4js from "log4js";
const logger: log4js.Logger = log4js.getLogger("store-mapper");

// Converts an ES store to an IStoreFull (only mappings are done)
export function getEsStoreAsIStoreFull(response: any): Promise<IStoreFull> {
	if (isNil(response)) {
		return Promise.reject("store is null or undefined");
	} else {
		return new Promise((resolve, reject) => {
			try {
				const specialGoods = mapSpecialGoods(response.specialGoods);
				const alcoholGrant = mapAlcoholGrant(response.alcoholGrant);
				const pickupSlots = mapStorePickupSlots(response.pickupSlots);
				const store: IStoreFull = {
					chainId: response.chain,
					gln: response.storeId.toString(),
					pickupGln: response.storeId.toString(),
					name: response.name,
					city: response.city,
					postalCode: response.postalCode,
					address: response.address,
					county: response.county,
					municipality: response.municipality,
					phoneNumber: response.phonenumber,
					location: {
						lat: response.location ? response.location.lat : response.latitude,
						lon: response.location ? response.location.lon : response.longitude,
					},
					pickupPointDescription: response.pickupPointDescription || "",
					homeDeliveryProviders: response.homeDelivery,
					alcoholGrant,
					alcoholSlots: response.alcoholSlots,
					bookingHorizon: response.bookingHorizon,
					deliveryMinimumSum: response.deliveryMinimumSum,
					hasValidHomeDeliveryData: response.hasValidHomeDeliveryData,
					whitelist: response.whitelist || false,
					pickupMinimumSum: response.pickupMinimumSum,
					pickupSlots,
					specialGoods,
					openinghours: response.openinghours,
				};
				resolve(store);
			} catch (err) {
				const storeGln = response.storeId.toString() || "";
				logger.error(`could not map ES store (${storeGln}) to IStoreFull`, err);
				reject(`could not map ES store (${storeGln}) to IStoreFull`);
			}
		});
	}
}

function mapBags(bags: any): Array<IBag> {
	if (Array.isArray(bags)) {
		let mappedBags = Array<IBag>();
		if (bags.length > 0) {
			mappedBags = bags.map((fee): IBag => {
				return {
					ean: fee.ean,
					price: fee.price,
					title: fee.title,
					type: fee.type,
				};
			});
		}
		return mappedBags;
	} else {
		return [];
	}
}

function mapSpecialGoods(specialGoods: any): ISpecialGoods {
	const homeDelivery = mapHomeDelivery(specialGoods.homeDelivery);
	const pickupFees = mapPickupFees(specialGoods.pickupFee);
	const corporatePickupFee = mapPickupFees(specialGoods.corporatePickupFee);
	const bags = mapBags(specialGoods.bags);
	const corporateDelivery = mapHomeDelivery(specialGoods.corporateDelivery);
	return {
		homeDelivery: fallbackToOldDeliveryFormat(homeDelivery, specialGoods.homeDeliveryFee),
		pickupFee: pickupFees,
		bags,
		corporateDelivery: fallbackToOldDeliveryFormat(corporateDelivery, specialGoods.corporateDeliveryFee),
		corporatePickupFee,
	};
}

/**
 * If no new fees are possible to map, fall back to the old format.
 * This should be used in a transition phase to make it possible to deploy cacher and rest independent of each other.
 * Can be removed when new fee format (with zip code restrictions) are produced by rest cacher
 *
 * @param mappedHomeDelivery The mapped fees from the new format
 * @param oldFees The old property, possibly still present in ES, depending on version of cacher
 */
function fallbackToOldDeliveryFormat(
	mappedHomeDelivery: Array<IHomeDeliveryFeeGroup>,
	oldFees: any,
): Array<IHomeDeliveryFeeGroup> {
	if (mappedHomeDelivery && mappedHomeDelivery.length > 0) {
		return mappedHomeDelivery;
	}

	const mappedFees = mapHomeDeliveryFees(oldFees);
	return [
		{
			zipCodes: [],
			fees: mappedFees,
		},
	];
}

export function mapClosePickupPoint(closePickupPoint: any): IClosePickupPoint {
	return {
		gln: closePickupPoint.gln.toString(),
		sortIndex: closePickupPoint.sorteringsNummer,
		rangeInMeters: closePickupPoint.avstandIMeter,
	};
}
