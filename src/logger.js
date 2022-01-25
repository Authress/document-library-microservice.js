const stringify = require('json-stringify-safe');
const shortUuid = require('short-uuid');

// Remove unnecessary strings from logging
function replacer(key, value) {
  if (key === 'body' && typeof value === 'string' && value) {
    try {
      return JSON.parse(value);
    } catch (error) {
      return value;
    }
  }

  if (key && key.match(/authorization(?!result)(?!s)/i) || value && typeof value === 'string' && value.match(/^bearer/i)) {
    return '{AUTHORIZATION}';
  }

  if (key && key.match(/(secret|signature)/i) && value) {
    return '{SECRET}';
  }

  if (key?.match('requestContext') && typeof value === 'object') {
    return { authorizer: value?.authorizer, requestId: value?.requestId };
  }

  if (key && key.match('identity') && value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'cognitoIdentityPoolId')) {
    return '{-}';
  }
  if (key === 'multiValueHeaders') {
    return undefined;
  }
  if (typeof value === 'string' && value.startsWith('<!DOCTYPE html>')) {
    return '<HTML DOCUMENT></HTML>';
  }
  return value;
}
class Logger {
  constructor(loggerFunc) {
    // eslint-disable-next-line no-console
    this.loggerFunc = loggerFunc || console.log;
    this.logDebug = true;

    this.invocationId = null;
    this.startTime = null;
    this.metadata = { tracking: [] };
  }

  startInvocation(metadata) {
    this.invocationId = shortUuid.generate();
    this.startTime = Date.now();
    this.metadata = Object.assign({ tracking: [{ name: 'Start', time: this.startTime }] }, metadata || {});
    return this.invocationId;
  }

  log(message) {
    const type = typeof message;
    let messageAsObject = message;
    if (type === 'undefined' || (type === 'string' && message === '')) {
      // eslint-disable-next-line no-console
      console.error('Empty message string.');
      return;
    } else if (type === 'string') {
      messageAsObject = {
        title: message
      };
    } else if (type === 'object' && Object.keys(message).length === 0) {
      // eslint-disable-next-line no-console
      console.error('Empty message object.');
      return;
    }

    messageAsObject.invocationId = this.invocationId;
    if (!messageAsObject.level) {
      messageAsObject.level = 'INFO';
    }

    if (messageAsObject.level === 'DEBUG' && !this.logDebug) {
      return;
    }

    const payload = {
      message: messageAsObject,
      metadata: Object.assign({ nodejs: process.version, executionTime: Date.now() - this.startTime }, this.metadata)
    };

    const truncateToken = innerPayload => {
      return innerPayload.replace(/(eyJ[a-zA-Z0-9_-]{5,}\.eyJ[a-zA-Z0-9_-]{5,})\.[a-zA-Z0-9_-]*/gi, (m, p1) => `${p1}.<sig>`);
    };

    let stringifiedPayload = truncateToken(stringify(payload, replacer, 2));
    // https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/cloudwatch_limits_cwl.html 256KB => 131072 2-byte characters
    if (stringifiedPayload.length >= 131072) {
      const replacementPayload = {
        invocationId: this.invocationId,
        message: {
          title: 'Payload too large',
          level: 'ERROR',
          originalInfo: {
            level: messageAsObject.level,
            title: messageAsObject.title,
            fields: Object.keys(messageAsObject)
          },
          truncatedPayload: truncateToken(stringify(payload, replacer)).substring(0, 40000)
        }
      };
      stringifiedPayload = stringify(replacementPayload, replacer, 2);
    }
    this.loggerFunc(stringifiedPayload);
  }
}

module.exports = new Logger();
