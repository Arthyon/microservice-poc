import { IPickupFee, IHomeDeliveryFee, IHomeDeliveryFeeGroup } from "@ng-mw/platform-interfaces";

export function mapPickupFees(pickupFees: any): Array<IPickupFee> {
	if (Array.isArray(pickupFees)) {
		let mappedFees = Array<IPickupFee>();
		if (pickupFees.length > 0) {
			mappedFees = pickupFees.map((fee): IPickupFee => {
				return {
					ean: fee.ean,
					price: fee.price,
					title: fee.title,
					intervallFrom: fee.intervallFrom,
					intervallTo: fee.intervallTo,
				};
			});
		}
		return mappedFees;
	} else {
		return [];
	}
}

export function mapHomeDelivery(homeDelivery: any): Array<IHomeDeliveryFeeGroup> {
	if (Array.isArray(homeDelivery) && homeDelivery.length > 0) {
		return homeDelivery.map((delivery) => ({
			zipCodes: delivery.zipCodes,
			fees: mapHomeDeliveryFees(delivery.fees),
		}));
	} else {
		return [];
	}
}

export function mapHomeDeliveryFees(homeDeliveryFees: any): Array<IHomeDeliveryFee> {
	if (!Array.isArray(homeDeliveryFees)) {
		return [];
	}
	return homeDeliveryFees.map((fee): IHomeDeliveryFee => {
		return {
			deliveryAgent: fee.deliveryAgent,
			deliveryDateDeviation: fee.deliveryDateDeviation,
			deliveryWindow: fee.deliveryWindow,
			ean: fee.ean,
			flexibility: fee.fleksibilitetsgrad,
			intervallFrom: fee.intervallFrom,
			intervallTo: fee.intervallTo,
			price: fee.price,
			title: fee.title,
		};
	});
}
