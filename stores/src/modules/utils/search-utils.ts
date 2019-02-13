"use strict";
import * as moment from "moment";
import * as _ from "lodash";
/**
 * Get a from hit num based on size and page
 * @param size and reqPageNumber
 * @public
 * @returns hit number
 */
export const getPageNumber = (size: number, reqPageNumber: number) => {
	let fromPage = 0;
	if (reqPageNumber > 1) {
		fromPage = (reqPageNumber - 1) * size;
	}
	return fromPage;
};

/**
 * Generate static filter based on configuration
 *
 * @param configSF  - dict of available filter settings
 * containing:
 * - termFilters:
 *      -filterName : { "field": string, "term": string, "default": boolean }
 * - rangeFilters:
 *    - filterName: { "field": string, "range": dateexpression string, "type": range type , "default": boolean },
 *
 * @param filterArr  - list of pre existing filters to append to
 * @param setSF - dict of filters set by client
 *  containing:
 *  filterName: filterValue
 *  where filterValue can be
 *      a string,
 *      an array (for termFilters only),
 *      or an object (for rangeFilters only)
 *        with filter config that goes straight into elasticsearch
 * @public
 * @returns {Object[]} filter array
 */
export const createStaticFilters = (configSF, filterArr, setSF) => {
	for (const filterType in configSF) {
		if (configSF.hasOwnProperty(filterType)) {
			for (const key in configSF[filterType]) {
				if (configSF[filterType].hasOwnProperty(key)) {
					const elem = configSF[filterType][key];
					let f: any = {};
					if (filterType === "termFilters") {
						let array = false;
						// if values set other than default
						if (setSF.hasOwnProperty(key)) {
							if (setSF[key].constructor === Array && elem.mode === "AND") {
								for (const v of setSF[key]) {
									f[elem.field] = v;
									filterArr.push({
										term: f,
									});
									f = {};
								}
							} else {
								f[elem.field] = setSF[key];
								if (setSF[key].constructor === Array) {
									array = true;
								}
							}

							// if values not set and default values should be added
						} else if (!setSF.hasOwnProperty(key) && elem.default) {
							if (elem.term.constructor === Array) {
								array = true;
							}
							f[elem.field] = elem.term;
						}
						if (!isEmpty(f)) {
							if (array) {
								filterArr.push({ terms: f });
							} else {
								filterArr.push({ term: f });
							}
						}
					} else if (filterType === "rangeFilters") {
						// if values set other than default
						if (setSF.hasOwnProperty(key)) {
							const r = {};
							const filterValue = setSF[key];
							if (filterValue.hasOwnProperty("remove")) {
								f = {};
							} else {
								r[elem.type] = filterValue;
								f[elem.field] = r;
							}
							// if values not set and default values should be added
						} else if (!setSF.hasOwnProperty(key) && elem.default) {
							const r = {};
							r[elem.type] = elem.range;
							f[elem.field] = r;
						}
						if (!isEmpty(f)) {
							filterArr.push({ range: f });
						}
					} else if (filterType === "existsFilters") {
						if (!setSF.hasOwnProperty(key) && elem.default) {
							f.field = elem.field;
						}
						if (!isEmpty(f)) {
							filterArr.push({ exists: f });
						}
					}
				}
			}
		}
	}
	return filterArr;
};

export const createMissingQuery = (configQuery, missingArr, setQuery) => {
	for (const key in configQuery) {
		if (configQuery.hasOwnProperty(key)) {
			const elem = configQuery[key];
			const f: any = {};
			if (setQuery.hasOwnProperty(key) || elem.default) {
				f.field = elem.field;
				missingArr.push({ exists: f });
			}
		}
	}
	return missingArr;
};

/**
 * Return facet filter object
 * @param params
 * @public
 * @returns filter object
 */
export const getSetFacetsDict = (params) => {
	const setFacetsDict = {};

	if (params) {
		const paramsSplitArr = params.split(";");
		for (const i in paramsSplitArr) {
			if (paramsSplitArr.hasOwnProperty(i)) {
				const paramSplit = paramsSplitArr[i].split(":");
				setFacetsDict[paramSplit[0]] = paramSplit[1];
			}
		}
	}
	return setFacetsDict;
};

/**
 * Generate aggrigation object based on configuration
 * @param facetMapper
 * @public
 * @returns aggrigation object
 */
export const getAggs = (facetMapper, facets?: string) => {
	if (facets === "") {
		facets = undefined;
	}
	const aggs = {};
	for (const i in facetMapper) {
		if (facetMapper.hasOwnProperty(i)) {
			const fields = facetMapper[i];
			if (
				(fields.display === "true" && facets === undefined) ||
				_.some(facets, (val) => {
					return val === fields.displayName;
				})
			) {
				const termsDict: any = {};
				let childAgg: any = {};

				termsDict.field = fields.field;

				if (fields.order) {
					termsDict.order = fields.order;
				}

				if (fields.size) {
					termsDict.size = fields.size;
				}

				if (fields.child) {
					childAgg = this.getAggs(fields.child);
				}
				aggs[i] = {
					terms: termsDict,
					aggs: childAgg,
				};
			}
		}
	}
	return aggs;
};

/**
 * Generate static filter based on configuration
 * @param configSF, filterArr, setSF
 * @public
 * @returns filter array
 */
export const paramSplitter = (facetsString: string) => {
	const paramDict = {};
	const paramsSplitArr = facetsString.split(";");
	paramsSplitArr.forEach((elem) => {
		if (elem.indexOf(":") > -1) {
			const paramSplit = elem.split(":");
			paramDict[paramSplit[0]] = paramSplit[1];
		}
	});
	return paramDict;
};

/**
 * Generate
 * @param
 * @public
 * @returns
 */
export const buildTermFilterArr = (params, termName: string) => {
	const paramArr: Array<any> = [];
	const paramsSplitArr = Array.isArray(params) ? params : params.split(";");
	const filter = {};
	paramsSplitArr.forEach((elem) => {
		if (elem.length > 0) {
			paramArr.push(elem);
		}
	});
	filter[termName] = paramArr;
	return { terms: filter };
};

/**
 * Generate
 * @param
 * @public
 * @returns
 */
export const buildRangeFilter = (field, value, type) => {
	const filter = {};
	const r = {};
	r[type] = value;
	filter[field] = r;

	return { range: filter };
};

/**
 * Generate
 * @param
 * @public
 * @returns
 */
export const getSetFacetsFilter = (facetMapper: {}, paramsDict: {}) => {
	const filterMustArr: Array<any> = [];
	const filterMustNotArr: Array<any> = [];
	for (const key in paramsDict) {
		if (paramsDict && paramsDict.hasOwnProperty(key)) {
			if (facetMapper && facetMapper.hasOwnProperty(key)) {
				const mustArray: Array<any> = [];
				const mustNotArray: Array<any> = [];
				const splitResult: Array<string> = paramsDict[key].split("|");
				splitResult.forEach((split) => {
					split.charAt(0) === "!" ? mustNotArray.push(split.substring(1)) : mustArray.push(split);
				});

				if (mustArray.length > 0) {
					const jsonVariable = {};
					if (mustArray.length > 1) {
						jsonVariable[facetMapper[key].field] = mustArray;
						filterMustArr.push({
							terms: jsonVariable,
						});
					} else {
						jsonVariable[facetMapper[key].field] = mustArray[0];
						filterMustArr.push({
							term: jsonVariable,
						});
					}
				}
				if (mustNotArray.length > 0) {
					const jsonVariable = {};
					if (mustNotArray.length > 1) {
						jsonVariable[facetMapper[key].field] = mustNotArray;
						filterMustNotArr.push({
							terms: jsonVariable,
						});
					} else {
						jsonVariable[facetMapper[key].field] = mustNotArray[0];
						filterMustNotArr.push({
							term: jsonVariable,
						});
					}
				}
			}
		}
	}
	return {
		must: filterMustArr,
		mustNot: filterMustNotArr,
	};
};

export const getMappedAggregationResult = (config, aggs) => {
	const returnArray: Array<any> = [];
	for (const num in aggs) {
		if (aggs && aggs.hasOwnProperty(num)) {
			const obj = {};
			obj[config.bucketName] = aggs[num].key;
			obj[config.countName] = aggs[num].doc_count;
			returnArray.push(obj);
			if (config.child) {
				for (const child of Object.keys(config.child)) {
					if (aggs[num][config.child[child].displayName]) {
						obj[config.child[child].displayName] = this.getMappedAggregationResult(
							config.child[child],
							aggs[num][config.child[child].displayName].buckets,
						);
					}
				}
			}
		}
	}
	return returnArray;
};

export const createSimpleSearchResult = (results) => {
	const returnArray: Array<any> = [];
	if (results.docs) {
		for (const result in results.docs) {
			if (results.docs.hasOwnProperty(result)) {
				returnArray.push(results.docs[result]._source);
			}
		}
	} else {
		for (const result in results) {
			if (results.hasOwnProperty(result)) {
				returnArray.push(results[result]._source);
			}
		}
	}
	return _.filter(returnArray, (r) => r);
};

export const buildFilters = (facetFilters: {}, otherFilters, excludeFilters) => {
	const filter: any = {
		bool: {},
	};
	if (facetFilters && Object.keys(facetFilters).length !== 0) {
		filter.bool.must = facetFilters;
	}
	if (otherFilters && Object.keys(otherFilters).length !== 0) {
		filter.bool.should = otherFilters;
	}
	if (excludeFilters && excludeFilters.length > 0) {
		filter.bool.must_not = excludeFilters;
	}
	return filter;
};

export const isEmpty = (obj: {}) => {
	for (const prop in obj) {
		if (obj.hasOwnProperty(prop)) {
			return false;
		}
	}
	return true;
};

export const getUtcNowAsString = () => {
	const utcNow = moment.utc();
	return utcNow.format("YYYY-MM-DDTHH[:]mm[:]ss[.]SSS[Z]");
};
