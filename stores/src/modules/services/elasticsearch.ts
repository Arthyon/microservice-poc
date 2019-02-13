// All of these modules use the internal-request handler convention on the callbacks (reversed argument order)
// TODO: rectify this

"use strict";

import * as _ from "lodash";
var log4js = require('log4js');
var elasticsearch = require("elasticsearch");
var check = require("check-types");
var util = require('util');

var searchUtils = require("../utils/search-utils");
var logger = log4js.getLogger('Elasticsearch');
var configuration = require('../../config/config-loader').load();
var HttpConnector = require('elasticsearch/src/lib/connectors/http');
var customHttpAgent = require('agentkeepalive');
var elasticClient;
var elasticsearchConfig;

/*
 * Custom http connection handler
 */
function CustomESHTTPConnector(host, config) {
	HttpConnector.call(this, host, config);
}
util.inherits(CustomESHTTPConnector, HttpConnector);
CustomESHTTPConnector.prototype.createAgent = function (config) {
	return new customHttpAgent(this.makeAgentConfig(config));
};


// We don't want to connect to ES if running as a webjob (it will throw an error since it does not have VPN enabled)
// todo: use config
if (configuration.WEBJOBS_TYPE !== undefined) {
	logger.info("We are running as a webjob, not connecting to Elasticsearch");
}

elasticsearchConfig = configuration.search.elasticsearch;

logger.trace('Initializing elasticsearch');
logger.info("Connecting to elastic hosts: " + (configuration.ELASTICSEARCH_HOSTS || elasticsearchConfig.hosts));

var clientConfig: any = {
	hosts: configuration.ELASTICSEARCH_HOSTS ? configuration.ELASTICSEARCH_HOSTS.split(",") : elasticsearchConfig.hosts,
	maxSockets: elasticsearchConfig.maxSockets,
	log: elasticsearchConfig.log,
	sniffOnStart: elasticsearchConfig.sniffOnStart,
	sniffInterval: elasticsearchConfig.sniffInterval,
	sniffOnConnectionFault: elasticsearchConfig.sniffOnConnectionFault
};

if (clientConfig.hosts[0].startsWith("https")) {
	clientConfig.sniffOnStart = false;
	clientConfig.sniffOnConnectionFault = false;
	clientConfig.sniffInterval = false;
	clientConfig.ssl = {
		rejectUnauthorized: false
	};
} else {
	clientConfig.connectionClass = CustomESHTTPConnector;
}

elasticClient = new elasticsearch.Client(clientConfig);


/**
 * Duplicate an error object, with all its properties and
 * add the expected fields from the TemplateReturnObject as well
 * @param {Error} err
 * @param {string} [msg]
 *
 * @returns Error object on the expected form of the templateReturnObject
 */
function createErrorObject(err: any, msg?: string) {
	var error = _.extend(new Error(err), err);

	if (msg) {
		error.message = msg;
	}

	return error;
}

/**
 * Fetches single id from Elasticsearch
 * @param getArgs - The object representing the document to get. Minimal required keys are index, type and id
 * @param callback(callbackObj)
 */
var get = function (getArgs, callback) {
	check.assert.object(getArgs);
	check.assert.string(getArgs.type);
	check.assert.string(getArgs.index);
	check.assert.string(getArgs.id);
	check.assert.function(callback);

	var fullResponse = !!getArgs.fullResponse;
	delete getArgs.fullResponse;

	var startTime = process.hrtime();
	elasticClient.get(getArgs, function (err, response) {
		getArgs.fullResponse = fullResponse;
		var diff = process.hrtime(startTime);
		logger.trace('Get finished in ' + (diff[0] * 1e9 + diff[1]) / 1e6 + ' ms' + '[' + getArgs + ']');

		var result,
			errMessage,
			error;

		if (err || response === null || response.found === false) {
			if (err) {

				if (err.status == 404) {
					errMessage = util.format('Requested id "%s" not found', getArgs.id);
					logger.warn(errMessage);
				} else {
					errMessage = util.format('GET failed (%s): %s', err.code, err.message);
					logger.error(errMessage);
				}
			} else {
				errMessage = util.format('Could not find "%s", although no error was returned', getArgs.id);
				logger.error(errMessage);
				err = new Error(errMessage);
			}
			error = createErrorObject(err, errMessage);
		} else {
			logger.trace('Get result: ' + response);
			try {
				if (fullResponse) {
					result = response;
				} else {
					result = response._source;
				}
			} catch (e) {
				error = createErrorObject(e);
			}
		}

		if (error) {
			callback(error);
		} else {
			callback(null, result);
		}
	});
};


/**
 * Fetches multiple ids from Elasticsearch
 *
 * @param mgetArgs - The object representing the document to multi get. Minimal required keys are index, type and array of ids
 * @param {string} mgetArgs.type
 * @param {string} mgetArgs.index
 * @param {object} mgetArgs.body contains an attribute ids
 * @param callback(callbackObj)
 **/
var mget = function (mgetArgs, callback) {
	check.assert.object(mgetArgs);
	check.assert.string(mgetArgs.type);
	check.assert.string(mgetArgs.index);
	check.assert.object(mgetArgs.body);
	check.assert.array(mgetArgs.body.ids);
	check.assert.function(callback);

	var fullResponse = !!mgetArgs.fullResponse;
	delete mgetArgs.fullResponse;

	var startTime = process.hrtime();
	elasticClient.mget(mgetArgs, function (err, response) {
		mgetArgs.fullResponse = fullResponse;
		var diff = process.hrtime(startTime);
		var result, error;
		logger.trace('Mget finished in ' + (diff[0] * 1e9 + diff[1]) / 1e6 + ' ms' + '[' + mgetArgs + ']');

		if (err) { error = err; }
		else if (response === null) {
			error = new Error('Unknown error');
		} else {
			logger.trace('Mget result: ' + response);
			try {
				if (fullResponse) {
					result = response;
				} else {
					result = searchUtils.createSimpleSearchResult(response);
				}
			} catch (ex) {
				error = ex;
			}
		}

		if (error) {
			logger.error('Mget failed: ' + error);
			callback(error)
		} else {
			callback(null, result);
		}
	});
};

/**
 * Fetches all hits from a query
 * @param scrollArgs - The object representing the hits to get. Minimal required keys are index and body
 * @param callback(callbackObj)
 **/
var scrollEs = function (scrollArgs, callback) {
	check.assert.object(scrollArgs);
	check.assert.string(scrollArgs.index);
	check.assert.object(scrollArgs.body);
	check.assert.function(callback);

	var fullResponse = !!scrollArgs.fullResponse;
	delete scrollArgs.fullResponse;

	var scrollDuration = '30s';
	if (!scrollArgs.scroll) {
		scrollArgs['scroll'] = scrollDuration;
	} else {
		scrollDuration = scrollArgs['scroll'];
	}

	var allHits: Array<any> = [];
	var startTime = process.hrtime();

	elasticClient.search(scrollArgs, function getMoreUntilDone(err, response) {
		var returnedError;

		if (err) {
			returnedError = err;
		} else if (!response) {
			returnedError = new Error('No response returned');
		}

		if (returnedError) {
			logger.error('Scroll failed: ', returnedError);
			if (response && response._scroll_id) {
				elasticClient.clearScroll(response._scroll_id);
			}
			return callback(returnedError);
		}

		response.hits.hits.forEach(function (hit) {
			if (fullResponse) {
				allHits.push(hit);
			} else {
				allHits.push(hit._source);
			}
		});

		if (response.hits.total !== allHits.length && response.hits.hits.length !== 0) {
			elasticClient.scroll({
				scroll_id: response._scroll_id,
				scroll: scrollDuration
			}, getMoreUntilDone);
		} else {
			scrollArgs.fullResponse = fullResponse;
			var diff = process.hrtime(startTime);
			logger.trace('Scroll finished in ' + (diff[0] * 1e9 + diff[1]) / 1e6 + ' ms' + '[' + scrollArgs + ']');
			elasticClient.clearScroll(response._scroll_id);
			callback(null, allHits);
		}
	});
};

/**
 * Search Elasticsearch
 * @param searchArgs - The object what and where to search. Minimal required keys are index, and body
 * @param callback(callbackObj)
 **/
var search = function (searchArgs, callback) {
	check.assert.object(searchArgs);
	check.assert.object(searchArgs.body);
	check.assert.function(callback);
	//check.assert.hasLength(callback, 2);

	var fullResponse = !!searchArgs.fullResponse;
	delete searchArgs.fullResponse;

	var startTime = process.hrtime();

	elasticClient.search(searchArgs, function (err, response) {
		searchArgs.fullResponse = fullResponse;
		var diff = process.hrtime(startTime);
		logger.trace('Elasticsearch search finished in ', (diff[0] * 1e9 + diff[1]) / 1e6 + ' ms');

		// serialization should only be done after a guard clause
		if (logger.level.isLessThanOrEqualTo(log4js.levels.TRACE)) {
			logger.trace('SearchArgs:', searchArgs);
		}

		var result,
			error;

		if (err || response === null) {
			if (err) {
				logger.error('Search failed: ', err);
			} else {
				logger.error('Search failed: Unknown error');
				err = new Error('Unknown error: Got null response');
			}
			error = createErrorObject(err);
		} else {
			logger.trace('Search result: ', response);
			try {
				if (fullResponse) {
					result = response;
				} else {
					response.hits.hits = searchUtils.createSimpleSearchResult(response.hits.hits);
					result = response.hits;
				}
			} catch (e) {
				error = createErrorObject(e);
			}
		}

		if (error) {
			callback(error);
		} else {
			callback(null, result);
		}
	});
};


/**
 * Force refresh of index
 * @param refreshArgs - The object containing index to refresh
 * @param callback(callbackObj)
 **/
var refresh = function (refreshArgs, callback) {
	check.assert.string(refreshArgs.index);
	elasticClient.indices.refresh(refreshArgs, callback);
};

var exists = function (existArgs, callback) {
	elasticClient.exists(existArgs, callback);
}

var index = function (indexConfig, callback) {
	elasticClient.index(indexConfig, callback);
};

var healthy = function (callback) {
	return elasticClient.cluster.health({ waitForStatus: "yellow", timeout: "10s" }).then(function (result) {
		if (result.status === "red")
			return callback({ message: "Host not ready" });
		return callback(null, result);
	}, function (error) {
		return callback({ message: "Host not ready: " + error });
	});
}

var isHealthy = function () {
	return healthy(function (error) {
		return error ? false : true;
	});
}

var suggest = function (searchArgs, callback) {
	elasticClient.suggest(searchArgs).then(function (body) {
		callback(null, body);
	}, function (error) {
		callback(error);
	});
};

var del = function (deleteConfig, callback) {
	elasticClient.delete(deleteConfig, callback);
};

var update = function (updateConfig, callback) {
	elasticClient.update(updateConfig, callback);
};


module.exports = {
	"get": get,
	"mget": mget,
	"search": search,
	"scroll": scrollEs,
	"suggest": suggest,
	"index": index,
	"delete": del,
	"refresh": refresh,
	"isHealthy": isHealthy,
	"healthy": healthy,
	"update": update,
	"exists": exists
};