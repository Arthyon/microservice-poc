/**
 * API Key format: API_KEY_V{1 | 2_}{chain_name}_{web || app}
 * Example: API_KEY_V1_MENY_APP
 */

import * as nconfttt from "nconf";
export const nconf = nconfttt;

import * as fs from "fs";
import * as log4js from "log4js";
import * as path from "path";
import * as keyvault from "./keyvault-loader";
import * as sleep from "system-sleep";

let defaults: any = {};
let appPackage: any = {};
let permissions: any = {};
let secrets: any = {};
let ready = false;
const logger: log4js.Logger = log4js.getLogger("Config loader");

export const load: any = (overrides: any = {}) => {
	// we need to wait for all configuration to be loaded before returning configuration
	// if this is not a test run
	if (process.env.NODE_ENV !== "test") {
		while (!ready) {
			sleep(1000);
		}
	}
	// store in memory only
	nconf.use("memory");

	// Check if the env is the build server
	if (process.env.isBuildServer) {
		nconf.set("PORT", Math.round(Math.random() * (5000 - 3000) + 3000));
	}

	// 1. any overrides, used for testing scenarios mostly
	// overrides must be taken in as arguments here, since calling .override
	// later would not actually override anything
	nconf.overrides(overrides);
	// 2. command line arguments
	nconf.argv();
	// 3. environment var
	nconf.env();
	// 4. Keyvault secrets
	// nconf.defaults({...secrets});

	const profile: string = nconf.get("NODE_ENV") || "defaults";

	if (profile) {
		// 5. attempt environment specific config file: local|development|preprod|production
		// const filename: string = path.join(__dirname, profile + ".json");
		const filename: string = path.join("./configs/", profile + ".json");

		if (fs.existsSync(filename)) {
			nconf.file(filename);
		} else {
			logger.warn(`Tried to load config file  ${filename}, but no such file exists.`);
		}
	}

	// 6. load package json for convenience
	nconf.set("app", appPackage);

	// 7. fall back to defaults
	nconf.defaults({ ...defaults, ...secrets });
	nconf.set("permissions", permissions);

	// Grab all api keys (wth the given format) from and
	// stick them in an array (apiKeys) on the config object
	const apiKeys = parseAPIKeys(nconf);
	nconf.set("apiKeys", apiKeys);

	return nconf.get();
};

async function readConfigurations() {
	try {
		defaults = JSON.parse(fs.readFileSync("./configs/defaults.json", "utf8"));
	} catch (e) {
		logger.error(e);
	}
	try {
		appPackage = JSON.parse(fs.readFileSync("./package.json", "utf8"));
	} catch (e) {
		logger.error(e);
	}
	try {
		permissions = JSON.parse(fs.readFileSync("./configs/permissions.json", "utf8"));
	} catch (e) {
		logger.error(e);
	}
	try {
		secrets = await keyvault.getSecrets();
	} catch (e) {
		logger.error(e);
	}
	ready = true;
}

/**
 * Finds all api keys in the config object and returns them in an array.
 * This is for the new type of api key
 * @param config The nconf object
 * @private
 */
const parseAPIKeys = (config): Array<{ name: string; key: string }> => {
	const apiKeys: Array<any> = [];
	Object.entries(config.get()).forEach(([key, value]) => {
		if (key.match(/^API_KEY_V.*$/i)) {
			apiKeys.push({ name: key, key: value });
		}
	});
	return apiKeys;
};

readConfigurations();
