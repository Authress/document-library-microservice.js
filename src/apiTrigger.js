const querystring = require('querystring');
const { cloneDeep } = require('lodash');

const logger = require('./logger');

class ApiTrigger {
  async onEvent(trigger, context, apiHandler) {
    const records = trigger.Records;
    if (!records || !records.length) {
      logger.log({ title: 'Triggered work with no records or source', level: 'WARN' });
      return {};
    }

    // records are from CloudFront
    const cloudFrontData = trigger.Records[0].cf;
    if (!cloudFrontData) {
      logger.log({ title: 'Missing CloudFront data in request', level: 'ERROR', trigger });
      throw Error('CloudFrontDataNotFound');
    }

    const request = cloudFrontData.request;
    let body = request.body && request.body.data && Buffer.from(request.body.data, 'base64').toString() || null;
    try {
      body = body && JSON.parse(body);
    } catch (error) {
      /* */
    }

    const constructedRequest = {
      path: request.uri.replace(/^\/api/, ''),
      resource: '/{proxy+}',
      httpMethod: request.method,
      methodArn: '{CloudFrontRequest}',
      routeArn: '{CloudFrontRequest}',
      queryStringParameters: querystring.parse(request.querystring),
      pathParameters: {
        proxy: request.uri.replace(/^\/api/, '').slice(1)
      },
      headers: Object.keys(request.headers).reduce((agg, h) => {
        agg[h] = request.headers[h].length === 1 ? request.headers[h][0].value : request.headers[h].map(o => o.value);
        return agg;
      }, {}),
      body,
      requestContext: {
        requestId: request.config && request.config.requestId,
        stage: null
      }
    };

    if (constructedRequest.httpMethod !== 'OPTIONS') {
      try {
        const { principalId, context: authorizerContext } = await apiHandler(Object.assign({ type: 'REQUEST' }, cloneDeep(constructedRequest)));
        constructedRequest.requestContext.authorizer = { principalId, ...authorizerContext };
      } catch (error) {
        if (error.message.statusCode) {
          return {
            status: error.message.statusCode || 401,
            headers: { 'access-control-allow-origin': [{ value: '*' }] },
            body: Buffer.from(JSON.stringify(error.message.body || {})).toString('base64'),
            bodyEncoding: 'base64'
          };
        }
        logger.log({ title: 'Failed to handle authorize cloud front request', level: 'ERROR', constructedRequest, context, error });
        return {
          status: 500,
          headers: { 'access-control-allow-origin': [{ value: '*' }] },
          body: Buffer.from(JSON.stringify({ title: 'Unexpected error in authorization' })).toString('base64'),
          bodyEncoding: 'base64'
        };
      }
    }

    try {
      const response = await apiHandler(constructedRequest, context);
      const responseHeaders = cloneDeep(response.headers || {});
      Object.keys(responseHeaders).forEach(h => {
        responseHeaders[h] = responseHeaders[h] ? [{ value: responseHeaders[h] }] : [];
      });
      const multiValueHeaders = cloneDeep(response.multiValueHeaders || {});
      Object.keys(multiValueHeaders).filter(h => multiValueHeaders[h]).forEach(h => {
        responseHeaders[h] = multiValueHeaders[h].filter(v => v).map(value => ({ value }));
      });

      const cloudFrontResponse = {
        status: `${response.statusCode}`,
        // statusDescription: 'OK',
        headers: responseHeaders,
        body: response.body ? Buffer.from(response.body).toString('base64') : undefined,
        bodyEncoding: response.body ? 'base64' : undefined
      };
      return cloudFrontResponse;
    } catch (error) {
      logger.log({ title: 'Failed to handle cloud front request, and it should have been caught', level: 'ERROR', constructedRequest, context, error });
      return {
        status: 500,
        headers: { 'access-control-allow-origin': [{ value: '*' }] },
        body: Buffer.from(JSON.stringify({ title: 'Unexpected error in with CDN', error: { code: error.code, message: error.message } })).toString('base64'),
        bodyEncoding: 'base64'
      };
    }
  }
}

module.exports = new ApiTrigger();
