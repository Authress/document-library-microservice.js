const axios = require('axios');
const axiosRetry = require('axios-retry');
const cookieManager = require('cookie');
const jwtManager = require('./jwtManager');
const { jwtVerify, importJWK } = require('jose');
const { URL } = require('url');

const logger = require('./logger');

const client = axios.create();
axiosRetry(client, {
  retries: 4,
  retryCondition(error) {
    return axiosRetry.isNetworkOrIdempotentRequestError(error) || axiosRetry.isRetryableError(error);
  }
});

class Authorizer {
  constructor() {
    this.kidCache = {};
  }

  async getPolicy(request) {
    const authorization = Object.keys(request.headers).find(key => {
      return key.match(/^Authorization$/i);
    });

    const cookies = cookieManager.parse(request.headers.cookie || '');
    const token = request.headers[authorization] && request.headers[authorization].trim().split(' ')[1] || cookies.authorization;
    if (!token) {
      logger.log({ title: 'Unauthorized', level: 'WARN', details: 'no token specified', path: request.path, method: request.httpMethod });
      throw Error.create({ title: 'Unauthorized', statusCode: 401 });
    }

    const { jwt, accountId, principalId } = await this.extractRequestMetadata(request);
    if (!principalId) {
      logger.log({ title: 'Unauthorized', level: 'WARN', details: `Could not resolve user, either we should throw or specify the principalId: ${request.path}`, request });
      throw Error.create({ title: 'Unauthorized', statusCode: 401 });
    }

    const policy = {
      principalId,
      context: {
        accountId,
        jwt
      }
    };

    return policy;
  }

  async extractRequestMetadata(requestToken) {
    // Verify the issuer
    let token = requestToken;
    let unverifiedToken = jwtManager.decodeFull(token);
    if (!unverifiedToken && token) {
      // Check if the token is a client secret and then create a token dynamically from that
      const { ServiceClientTokenProvider } = require('authress-sdk');
      try {
        const replacementToken = await (new ServiceClientTokenProvider(requestToken))();
        unverifiedToken = jwtManager.decodeFull(replacementToken);
        if (unverifiedToken) {
          token = replacementToken;
        }
      } catch (error) {
        logger.log({ title: 'Unauthorized', level: 'INFO', details: 'Invalid token', token: unverifiedToken || token || '<NO TOKEN>' });
        throw Error.create({ title: 'Unauthorized', statusCode: 401 });
      }
    }

    const kid = unverifiedToken && unverifiedToken.header && unverifiedToken.header.kid;
    if (!kid) {
      logger.log({ title: 'Unauthorized', level: 'INFO', details: 'Kid not in token', token: unverifiedToken || token || '<NO TOKEN>' });
      throw Error.create({ title: 'Unauthorized', statusCode: 401 });
    }

    const issuer = unverifiedToken && unverifiedToken.payload && unverifiedToken.payload.iss;
    if (!issuer) {
      logger.log({ title: 'Unauthorized', level: 'INFO', details: 'Issuer not in token', token: unverifiedToken || token || '<NO TOKEN>' });
      throw Error.create({ title: 'Unauthorized', statusCode: 401 });
    }

    try {
      const key = await this.getKeyFromIssuer(issuer, kid, token);
      const verifiedToken = await jwtVerify(token, await importJWK(key), { algorithms: ['EdDSA', 'RS256', 'RS384', 'RS512', 'PS256', 'PS384', 'PS512', 'ES256', 'ES384', 'ES512'], issuer });
      const identity = verifiedToken.payload;
      return {
        principalId: identity.sub,
        jwt: token
      };
    } catch (error) {
      logger.log({ title: 'Invalid Token', level: 'INFO', error, token: unverifiedToken || token || '<NO TOKEN>' });
      throw Error.create({ title: 'Unauthorized', statusCode: 401 });
    }
  }

  async getKeyFromIssuer(issuer, kid, token) {
    const hash = `${issuer}|${kid}`;

    if (this.kidCache[hash]) {
      return this.kidCache[hash];
    }

    try {
      const issuerBasePath = issuer.startsWith('https://') ? issuer : `https://${issuer}`;
      const appPath = issuerBasePath[issuerBasePath.length - 1] === '/' ? '.well-known/openid-configuration' : '/.well-known/openid-configuration';
      const url = new URL(`${issuerBasePath}${appPath}`);
      const headers = {};
      if (token) {
        headers.authorization = `Bearer ${token}`;
      }
      const jwkKeyListUrl = (await client.get(url.toString(), { headers })).data.jwks_uri;
      this.kidCache[hash] = await this.getPublicKey(jwkKeyListUrl.toString(), kid, token);

      if (!this.kidCache[hash]) {
        logger.log({ title: 'Unauthorized', level: 'WARN', details: 'Public key not found', kid: kid || 'NO_KID_SPECIFIED' });
        throw Error.create('InternalServiceError');
      }

      return this.kidCache[hash];
    } catch (error) {
      logger.log({ title: 'Unauthorized', level: 'WARN', details: 'Failed to get public key from issuer', kid: kid || 'NO_KID_SPECIFIED', error });
      throw Error.create('InternalServiceError');
    }
  }

  async getPublicKey(jwkKeyListUrl, kid, token) {
    try {
      const headers = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const result = await client.get(jwkKeyListUrl, { headers });
      return result.data.keys.find(key => key.kid === kid);
    } catch (error) {
      logger.log({ title: 'Unauthorized', level: 'WARN', details: 'Failed to resolve public key', kid: kid || 'NO_KID_SPECIFIED', error });
      throw Error.create('InternalServiceError');
    }
  }
}

module.exports = new Authorizer();
