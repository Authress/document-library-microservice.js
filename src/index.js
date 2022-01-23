require('error-object-polyfill');

const logger = require('./logger');
const authressPermissionsManager = require('./authressPermissionsManager');

process.env.AWS_NODEJS_CONNECTION_REUSE_ENABLED = 1;
require('http').globalAgent.keepAlive = true;
require('https').globalAgent.keepAlive = true;

try {
  const Api = require('openapi-factory');
  const aws = require('aws-sdk');
  // Override aws defaults, don't wait forever to connect when it isn't working.
  aws.config.update({ maxRetries: 5, httpOptions: { connectTimeout: 1000, timeout: 10000 } });

  const api = new Api({
    requestMiddleware(request, context) {
      context.callbackWaitsForEmptyEventLoop = true;
      const capturedInvocationId = logger.startInvocation({ version: context.functionVersion });
      authressPermissionsManager.authorization = request.requestContext.authorizer;

      setTimeout(() => {
        if (logger.invocationId === capturedInvocationId) {
          logger.log({ title: 'Logging the full request in case lambda decides to timeout, we can see what the request was about', level: 'INFO', request });
        }
      }, 55000);
      return request;
    },
    responseMiddleware(request, response) {
      authressPermissionsManager.authorization = null;

      const origin = request.headers.origin || request.headers.Origin || request.headers.Referer && new URL(request.headers.Referer).origin
        || request.headers.referer && new URL(request.headers.referer).origin || '*';

      response.headers = Object.assign({
        'Access-Control-Allow-Origin': origin,
        'x-request-id': logger.invocationId,
        'strict-transport-security': 'max-age=31556926; includeSubDomains;',
        'vary': 'Origin, Host'
      }, response.headers || {});

      const loggedResponse = response.statusCode >= 400 ? response : { statusCode: response.statusCode };
      logger.log({ title: 'RequestLogger', level: 'INFO', request, loggedResponse });
      return response;
    },
    errorMiddleware(request, error) {
      authressPermissionsManager.authorization = null;

      const origin = request.headers.origin || request.headers.Origin || request.headers.Referer && new URL(request.headers.Referer).origin
        || request.headers.referer && new URL(request.headers.referer).origin || '*';

      logger.log({ title: 'RequestLogger', level: 'ERROR', request, error });
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'x-request-id': logger.invocationId,
          'strict-transport-security': 'max-age=31556926; includeSubDomains;'
        },
        body: { title: 'Unexpected error', errorId: request.requestContext.requestId }
      };
    }
  });
  module.exports = api;

  //   api.onSchedule(async (configuration, context) => {
  //     logger.startInvocation({ version: context.functionVersion });
  //     permissionsManager.authorization = null;
  //     const apiTrigger = require('./apiTrigger');
  //     const result = await apiTrigger.onSchedule(configuration, context);
  //     return result;
  //   });
  //   api.onEvent(async (trigger, context) => {
  //     logger.startInvocation({ version: context.functionVersion });
  //     permissionsManager.authorization = null;
  //     const apiTrigger = require('./apiTrigger');
  //     const result = await apiTrigger.onEvent(trigger, context);
  //     return result;
  //   });

  const documentsController = require('./documentsController');
  api.get('/accounts/{accountId}/documents/{documentUri+}', request => documentsController.getDocument(request));
  api.put('/accounts/{accountId}/documents/{documentUri+}', request => documentsController.updateDocument(request));
  api.delete('/accounts/{accountId}/documents/{documentUri+}', request => documentsController.deleteDocument(request));

  api.get('/', () => {
    // const openapi = require('./openapi');
    return { body: {}, statusCode: 200 };
  });

  api.get('/.well-known/openapi', () => {
    // const openapi = require('./openapi');
    return { body: {}, statusCode: 200 };
  });

  api.options('/{proxy+}', () => {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Powered-By,If-Unmodified-Since,Origin,Referer,Accept,Accept-Language,Accept-Encoding,User-Agent,Content-Length,Cache-Control,Pragma,Sec-Fetch-Dest,Sec-Fetch-Mode,Sec-Fetch-Site,sec-gpc',
        'Access-Control-Allow-Methods': 'DELETE,GET,HEAD,OPTIONS,PATCH,POST,PUT',
        'Cache-Control': 'public, max-age=3600'
      }
    };
  });

  api.any('/{proxy+}', request => {
    logger.log({ title: '404 Path Not Found', level: 'WARN', request: request });
    return { statusCode: 404 };
  });
} catch (error) {
  logger.log({ title: 'LoaderLogger - failed to load service', level: 'CRITICAL', error });
  throw error;
}
