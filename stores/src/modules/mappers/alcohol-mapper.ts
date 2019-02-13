import { IAlcoholGrantArea, IMunicipality } from "@ng-mw/platform-interfaces";
import { isNil } from "lodash";

export function mapAlcoholGrant(alcoholGrant: any): Array<IAlcoholGrantArea> {
	if (Array.isArray(alcoholGrant)) {
		let mappedAlcoholGrant = Array<IAlcoholGrantArea>();
		if (alcoholGrant.length > 0) {
			mappedAlcoholGrant = alcoholGrant.map((area): IAlcoholGrantArea => {
				let municipality: IMunicipality | undefined;
				if (!isNil(area.municipality)) {
					municipality = {
						id: area.municipality.id,
						name: area.municipality.name,
					};
				}

				return {
					municipality,
					zipCodes: area.zipCodes,
				};
			});
		}
		return mappedAlcoholGrant;
	} else {
		return [];
	}
}
