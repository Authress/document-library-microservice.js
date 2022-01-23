const { URL } = require('url');

const authressPermissionsManager = require('./authressPermissionsManager');
const logger = require('./logger');

class DocumentsController {
  async getDocument(request) {
    const accountId = request.pathParameters.accountId;
    const documentUri = request.pathParameters.documentUri;

    if (!await authressPermissionsManager.hasAccessToResource(`/accounts/${accountId}/documents/${documentUri}`, 'documents:read')) {
      return {
        statusCode: 404
      };
    }

    // GET S3 signed get, and return
    const s3UrlLocation = `https://${request.headers.host}/SET-THIS-VALUE`;

    return {
      statusCode: 307,
      headers: {
        location: s3UrlLocation
      }
    };
  }

  async updateDocument(request) {
    const accountId = request.pathParameters.accountId;
    const documentUri = request.pathParameters.documentUri;

    if (!await authressPermissionsManager.hasAccessToResource(`/accounts/${accountId}/documents/${documentUri}`, 'documents:update')) {
      return {
        statusCode: 404
      };
    }

    // GET S3 signed get, and return
    const s3UrlLocation = `https://${request.headers.host}/SET-THIS-VALUE`;

    return {
      statusCode: 307,
      headers: {
        location: s3UrlLocation
      }
    };
  }

  async deleteDocument(request) {
    const accountId = request.pathParameters.accountId;
    const documentUri = request.pathParameters.documentUri;

    if (!await authressPermissionsManager.hasAccessToResource(`/accounts/${accountId}/documents/${documentUri}`, 'documents:update')) {
      return {
        statusCode: 404
      };
    }

    // TODO: delete the s3 document
    return {
      statusCode: 204
    };
  }
}

module.exports = new DocumentsController();
