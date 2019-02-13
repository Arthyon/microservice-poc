import { IStorePickupSlot, IPickupPointPickupSlot } from "@ng-mw/platform-interfaces";

export function mapStorePickupSlots(pickupSlots: any): Array<IStorePickupSlot> {
	if (Array.isArray(pickupSlots)) {
		let mappedPickupSlots = Array<IStorePickupSlot>();
		if (pickupSlots.length > 0) {
			mappedPickupSlots = pickupSlots.map((pickupSlot): IStorePickupSlot => {
				return {
					capacity: pickupSlot.capacity,
					deadline: pickupSlot.deadline,
					deadlineCorporate: pickupSlot.deadlineCorporate,
					from: pickupSlot.from,
					to: pickupSlot.to,
					homeDelivery: pickupSlot.homeDelivery,
					pickup: pickupSlot.pickup,
					storeWindowId: pickupSlot.id,
					isTripleTrumf: pickupSlot.isTripleTrumf || false,
				};
			});
		}
		return mappedPickupSlots;
	} else {
		return [];
	}
}

export function mapPickupPointPickupSlots(pickupSlots: any): Array<IPickupPointPickupSlot> {
	if (Array.isArray(pickupSlots)) {
		let mappedPickupSlots = Array<IPickupPointPickupSlot>();
		if (pickupSlots.length > 0) {
			mappedPickupSlots = pickupSlots.map((pickupSlot): IPickupPointPickupSlot => {
				return {
					capacity: pickupSlot.capacity,
					deadline: pickupSlot.deadline,
					from: pickupSlot.from,
					to: pickupSlot.to,
					homeDelivery: pickupSlot.homeDelivery,
					pickup: pickupSlot.pickup,
					pickupPointWindowId: pickupSlot.id,
					displayFrom: pickupSlot.pickupStart,
					displayTo: pickupSlot.pickupStop,
					isTripleTrumf: pickupSlot.isTripleTrumf || false,
				};
			});
		}
		return mappedPickupSlots;
	} else {
		return [];
	}
}
