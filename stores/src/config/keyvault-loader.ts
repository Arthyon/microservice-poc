import * as msRestAzure from "ms-rest-azure";
import * as KeyVault from "azure-keyvault";
import { AuthenticationContext } from "adal-node";
import * as log4js from "log4js";
import * as fs from "fs";
const logger: log4js.Logger = log4js.getLogger("Key vault loader");

const clientId = process.env.CLIENT_ID; // service principal
const domain = process.env.DOMAIN; // tenant id
const secret = process.env.APPLICATION_SECRET; // application password
const vaultName = process.env.VAULT_NAME; // key vault name

const vaultUri = `https://${vaultName}.vault.azure.net/`;
const secretsFile = "../../configs/secrets.json";

export function getSecrets(): Promise<any> {
	if (!clientId || !domain || !secret || !vaultName) {
		logger.warn("Missing required environment variables to get secrets from key vault");
		return readFile().catch((err) => {
			logger.info("Could not read secrets file, returns none");
			return Promise.resolve({});
		});
	}
	logger.debug("Starting to get keys from key vault");
	return new Promise((resolve: (data?: any) => void, reject: (err?: Error) => void) => {
		msRestAzure
			.loginWithServicePrincipalSecret(clientId, secret, domain)
			.then((credentials) => {
				const kvCredentials = new KeyVault.KeyVaultCredentials(authenticator);
				const keyVaultClient = new KeyVault.KeyVaultClient(kvCredentials);
				keyVaultClient
					.getSecrets(vaultUri)
					.then((result) => {
						const promises: any = [];
						const loop = (nextLink) => {
							if (nextLink !== null && nextLink !== undefined) {
								keyVaultClient.getSecretsNext(nextLink, (err, res) => {
									for (const s of res) {
										promises.push(keyVaultClient.getSecret(s.id));
									}
									loop(res.nextLink);
								});
							}
						};
						for (const s of result) {
							if (s.id) {
								promises.push(keyVaultClient.getSecret(s.id));
							}
						}
						loop(result.nextLink);
						Promise.all(promises)
							.then((allSecrets) => {
								const secrets: any = {};
								extractSecrets(secrets, allSecrets);
								// add new content to file
								writeFile(secrets);
								logger.info("Successfully got secrets from key vault");
								return resolve(secrets);
							})
							.catch(async (e) => {
								logger.warn(
									"Could not get content from key vault: " +
										vaultUri +
										": " +
										e +
										" Will try to read last known secrets from file",
								);
								try {
									return resolve(await readFile());
								} catch (e2) {
									return reject(e);
								}
							});
					})
					.catch(async (e) => {
						logger.warn(
							"Could not get content from key vault: " +
								vaultUri +
								": " +
								e +
								" Will try to read last known secrets from file",
						);
						try {
							return resolve(await readFile());
						} catch (e2) {
							return reject(e);
						}
					});
			})
			.catch(async (e) => {
				logger.warn(
					"Could not get content from key vault: " +
						vaultUri +
						": " +
						e +
						" Will try to read last known secrets from file",
				);
				try {
					return resolve(await readFile());
				} catch (e2) {
					return reject(e);
				}
			});
	});
}

function extractSecrets(secrets, response) {
	const re = ".+/(.+)/";
	// do something to secrets
	for (const item of response) {
		const match = item.id.match(re);
		try {
			// content type is optional and only present on secrets where it has been specified
			const value = item.contentType === "application/json" ? JSON.parse(item.value) : item.value;
			if (match.length > 0) {
				secrets[match[1].replace(/-/g, "_")] = value;
			}
		} catch (err) {
			logger.error(`Could not parse secret with contentType ${item.contentType} and id ${match[1]}. Error:`, err);
		}
	}
}

function readFile(): Promise<any> {
	return new Promise((resolve: (data?: any) => void, reject: (err?: Error) => void) => {
		fs.readFile(secretsFile, "utf8", (err, data) => {
			if (err) {
				logger.error("Could not read secrets from file: " + err);
				return reject(err);
			} else {
				let secrets;
				try {
					secrets = JSON.parse(data);
				} catch (e) {
					logger.error("Could not parse secrets from file: " + e);
					return reject(e);
				}
				logger.info("Successfully read secrets from file");
				return resolve(secrets);
			}
		});
	});
}

function writeFile(secrets) {
	try {
		const fileContent = JSON.stringify(secrets);
		fs.writeFile(secretsFile, fileContent, "utf8", (err) => {
			logger.debug("Successfully wrote new content to disk");
		});
	} catch (e) {
		logger.error("Could not write secrets to disk: " + e);
	}
}

function authenticator(challenge, callback) {
	// Create a new authentication context.
	const context = new AuthenticationContext(challenge.authorization);

	// Use the context to acquire an authentication token.
	return context.acquireTokenWithClientCredentials(
		challenge.resource,
		clientId || "",
		secret || "",
		(err, tokenResponse: any) => {
			if (err) {
				throw err;
			}
			// Calculate the value to be set in the request's Authorization header and resume the call.
			const authorizationValue = tokenResponse.tokenType + " " + tokenResponse.accessToken;

			return callback(null, authorizationValue);
		},
	);
}
