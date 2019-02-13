/**
 * Handles external requests to NGT
 * Uses streaming to continuously output incoming
 * data from a service directly to the response.
 * @author Jørn Kinderås
 * @since 09.03 2016
 */

"use strict";

import * as httpRequest from "request";
import { load as configLoader } from "../../config/config-loader";
import * as log4js from "log4js";
import * as express from "express";
import { IncomingMessage } from "http";

/* tslint:disable */
const agentkeepalive = require("agentkeepalive");
const httpsAgent = agentkeepalive.HttpsAgent;
const httpAgent = agentkeepalive;
/* tslint:enable */

const logger: log4js.Logger = log4js.getLogger("External Request");
const config: any = configLoader();

const jervPayexProxy: string = config.jerv_payex_proxy;
const ngtDefaultServer: string = config.ngt_server;
const ngtOauthServer: string = config.ngt_oauth_server;
const clickAndCollectServer: string = config.ngt_clickandcollect_server;
const polldaddyServer: string = config.polldaddyServer;
const zoopitServer: string = config.zoopitServer;
const ngtOldAxaptaServer: string = config.ngt_old_axapta_server;
const elasticServer: string = config.search.elasticsearch;
let defaultSource: string = config.DEFAULT_SOURCE; // tslint:disable-line

export interface IExternalResponse {
	statusCode: number;
	response: string;
	headers: Array<string>;
	uri: string;
}

/**
 * Takes a http request and get the correct server name
 * @param req - http request
 * @return {string} server name
 */
export function getServerInfo(
	req: express.Request,
): { serverName: string; authorizationType: "OAuth" | "C&C" | "NGT" | "External" } {
	"use strict";

	const isOauthRequest: boolean = req.originalUrl.toLowerCase().includes("/oauth");
	const source: string = getSource(req);

	// If there is a custom target header
	if (req.headers && req.headers["x-target-server"]) {
		// Grab the server name
		const serverName: string = req.headers["x-target-server"] as string;
		// remove the custom header since we don"t acctually
		// want to send this header to NGT
		delete req.headers["x-target-server"];

		if (serverName === "click & collect") {
			return { serverName: clickAndCollectServer, authorizationType: "C&C" };
		} else if (serverName === "polldaddy") {
			return { serverName: polldaddyServer, authorizationType: "External" };
		} else if (serverName === "zoopit") {
			return { serverName: zoopitServer, authorizationType: "External" };
		} else if (serverName === "elastic") {
			return { serverName: elasticServer, authorizationType: "External" };
		} else if (serverName === "jerv payex proxy") {
			return { serverName: jervPayexProxy, authorizationType: "External" };
		} else {
			return { serverName, authorizationType: "External" };
		}
	}

	if (isOauthRequest) {
		return { serverName: ngtOauthServer, authorizationType: "OAuth" };
	}

	// If the «ax» format is selected we use
	// the old backup Axapta preprod server
	if (source === "ax") {
		return { serverName: ngtOldAxaptaServer, authorizationType: "External" };
	}

	return { serverName: ngtDefaultServer, authorizationType: "NGT" };
}

/**
 * Takes a http request and builds the correct URI to call
 * @param req - http request
 * @return {string} uri
 */
function createUri(req: express.Request): string {
	"use strict";

	// Remove query parameters named format and source from url, and ending ? if no parameters left
	const path: string = req.originalUrl.replace(/(format|source)[^&]+&?/gi, "").replace(/\?$/, "");

	const serverInfo = getServerInfo(req);
	return serverInfo.serverName + path;
}

export const test_createUri: (req: express.Request) => string = createUri;

/**
 * Takes a http request and get the query source/default
 * @param req - http request
 * @return {string} uri
 */
export function getSource(req: express.Request): string {
	"use strict";

	return ((req.query && req.query.source) || defaultSource || "").toLowerCase();
}

/**
 * Takes a http request and decides if request will need patching
 * @param req - http request
 * @return {boolean}
 */
export function doPatch(req: express.Request): boolean {
	"use strict";

	const shouldPatch: boolean = getSource(req) === "crm" && (req.query.format || "").toLowerCase() !== "crm";

	if (shouldPatch) {
		logger.debug("INCOMING REQUEST SHOULD BE PATCHED");
	}

	return shouldPatch;
}

/**
 * Takes a request and a response Node object
 * and pipes the result from the called service
 * into the passed response object
 * @param req - Node request object
 * @param res - Node response object
 * @param {Function} [onResponse] - Callback to be called on response
 * @param {Function} [onError] - Callback to be called on error
 */
export function handleRequest(
	req: any,
	res?: express.Response,
	onResponse?: (res: any) => void,
	onError?: (err: any) => void,
): Promise<IExternalResponse> {
	"use strict";

	// Return promise, but fall back to old res.pipe()
	return new Promise((resolve: (res: any) => void, reject: (err: any) => void) => {
		const headers: any = req.headers;
		let fullResponse: string = "";
		let statusCode: number;
		let responseHeaders: any;
		let request: any;

		// Since the CRM oauth server exposes an invalid
		// certificate we can in certain situations allow
		// request to complete anyway in order for testing
		// to be possible. See the «rejectUnauthorized» setting
		// in the request method on how this is used.
		let rejectUnauthorized: boolean = config.REJECT_INVALID_NGT_SSL_CERT;

		if (typeof rejectUnauthorized !== "boolean") {
			rejectUnauthorized = true;
		}

		try {
			// Remove the encoding header to avoid
			// getting gzipped content from NGT which
			// we would then need to decompress
			// We are compressing all responses before
			// sending them to the clients anyway.
			delete headers["accept-encoding"];

			// As of Node 0.10 when using an SSL Cert
			// your hostname is required to be in the «altNames»
			// of the certificate. Hence we remove the original host
			// and which allows this server to act as host to NGT
			delete (headers as any).host;
		} catch (err) {
			// do nothing
		}

		if (!headers["content-type"]) {
			headers["content-type"] = "application/json";
		}

		// If there is a payload
		// then recalculate the constent-length header
		// in case the incoming request has a different encoding
		// or some chars have been stripped
		if (req.body && Object.keys(req.body).length > 0) {
			try {
				const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
				headers["content-length"] = Buffer.byteLength(body, "utf8");
			} catch {
				// .. nothing we can do, just don't crash
			}
		}

		const keepaliveAgent: any = new httpsAgent({
			// See https://www.npmjs.com/package/agentkeepalive
			keepAlive: true,
			maxSockets: 100,
			maxFreeSockets: 10,
			timeout: 50000,
			keepAliveTimeout: 30000, // free socket keepalive for 30 seconds
		});
		const keepaliveAgentUnsecure: any = new httpAgent({
			// See https://www.npmjs.com/package/agentkeepalive
			keepAlive: true,
			maxSockets: 100,
			maxFreeSockets: 10,
			timeout: 50000,
			keepAliveTimeout: 30000, // free socket keepalive for 30 seconds
		});
		const uri: string = createUri(req);

		// Build the request
		// The agent settings is based on MS reccommended settings
		// from https://tinyurl.com/h3jstcb
		// Since we are always using this mudule to make all requests
		// these settings should apply for all outgoing traffic
		const requestOptions: any = {
			agent: uri.indexOf("https://") === 0 ? keepaliveAgent : keepaliveAgentUnsecure,
			uri,
			headers,
			cookies: req.cookies,
			timeout: 50 * 1000, // Timeout after 50 sec
			method: req.method,
			body: req.body,
			json: headers["content-type"] === "application/json",
			// Setting «rejectUnauthorized» to false when developing and
			// testing allows us to skip around certificate issues
			// NGT is having on their temporary servers (crm).
			// This parameter should ALWAYS be true in prod!
			rejectUnauthorized,
		};

		// Initiate the request
		request = httpRequest(requestOptions);
		const startTime: [number, number] = process.hrtime();
		request
			.on("response", (response: IncomingMessage) => {
				responseHeaders = response.headers;

				if (response.statusCode === undefined) {
					reject(response);
					if (typeof onError === "function") {
						return onError(response);
					}
					return;
				}
				statusCode = response.statusCode;

				// Verify that the response is valid,
				// over 304 is considered an error
				// If an error handler was passed defer to it
				if (response.statusCode > 304 && typeof onError === "function") {
					reject(response);
					return onError(response);
				}

				// If the service responds with a valid code
				// and a res object was supplied stream the NGT response
				if (res) {
					request.pipe(res).on("error", (err) => {
						logger.error("Pipe error", JSON.stringify(requestOptions));
						res.end();
					});
				}
			})
			.on("data", (chunk: string) => {
				fullResponse += chunk;
			})
			.on("end", () => {
				const diff: Array<number> = process.hrtime(startTime);
				const responseTime: number = (diff[0] * 1e9 + diff[1]) / 1000000; // response time in ms
				const responseSummary: string =
					"[method:" +
					requestOptions.method +
					"] [uri:" +
					requestOptions.uri +
					"] [statusCode:" +
					statusCode +
					"] [duration:" +
					responseTime +
					"]";
				const responseObject: IExternalResponse = {
					statusCode,
					response: fullResponse,
					uri: requestOptions.uri,
					headers: responseHeaders,
				};

				// Resovle or reject as appropriet with response object
				if (statusCode > 304) {
					logger.error(responseSummary, {
						input: JSON.stringify(requestOptions.body),
						response: responseObject,
					});

					reject(responseObject);
				} else {
					logger.info(responseSummary);

					resolve(responseObject);
				}
			})
			.on("error", (err: Error) => {
				reject({
					statusCode: statusCode != null ? statusCode : 500,
					response: err,
					uri: requestOptions.uri,
					headers: [],
				});
				const diff: Array<number> = process.hrtime(startTime);
				const responseTime: number = (diff[0] * 1e9 + diff[1]) / 1000000;
				const responseSummary: string =
					"[method:" +
					requestOptions.method +
					"] [uri:" +
					requestOptions.uri +
					"] [statusCode:" +
					statusCode +
					"] [duration:" +
					responseTime +
					"]";
				logger.error(responseSummary + " Error: ", err);

				// If res object supplied respond with error
				if (res && !res.headersSent) {
					res.status(500).send(err);
					res.end();
				}
			});
	});
}
