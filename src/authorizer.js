const cookieManager = require('cookie');

const logger = require('./logger');
const authressPermissionsManager = require('./authressPermissionsManager');

class Authorizer {
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

    let identity;
    try {
      identity = await authressPermissionsManager.verifyToken(token);
    } catch (error) {
      logger.log({ title: 'Unauthorized', level: 'INFO', token, error });
      throw Error.create({ title: 'Unauthorized', statusCode: 401 });
    }

    if (!identity?.sub) {
      logger.log({ title: 'Unauthorized', level: 'WARN', details: `Could not resolve user, either we should throw or specify the principalId: ${request.path}`, request });
      throw Error.create({ title: 'Unauthorized', statusCode: 401 });
    }

    const policy = {
      principalId: identity.sub,
      context: { jwt: token }
    };

    return policy;
  }
}

module.exports = new Authorizer();
