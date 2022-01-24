const { S3 } = require('aws-sdk');

const authressPermissionsManager = require('./authressPermissionsManager');
const logger = require('./logger');
const regionManager = require('./regionManager');

class DocumentsController {
  async getDocument(request) {
    const accountId = request.pathParameters.accountId;
    const documentUri = request.pathParameters.documentUri;

    if (!await authressPermissionsManager.hasAccessToResource(`/accounts/${accountId}/documents/${documentUri}`, 'documents:read')) {
      return {
        statusCode: 404
      };
    }

    const bucketId = `${request.requestContext.awsAccountId}-us-east-1-document-library-service.${accountId}`;
    const s3UrlLocation = await new S3({ region: regionManager.getExpectedAwsRegion() }).getSignedUrlPromise('getObject', { Bucket: bucketId, Key: `documents/${documentUri}`, Expires: 60 });

    return {
      statusCode: 307,
      headers: {
        'location': s3UrlLocation,
        'cache-control': 'public, max-age=60'
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

    const bucketId = `${request.requestContext.awsAccountId}-us-east-1-document-library-service.${accountId}`;

    const isDirectory = documentUri.slice(-1)[0] === '/';
    const s3UrlLocation = new S3({ region: regionManager.getExpectedAwsRegion() }).createPresignedPost({
      Bucket: bucketId,
      Conditions: [
        { acl: 'private' },
        { bucket: bucketId },
        ['starts-with', '$key', `documents/${documentUri}${isDirectory ? '' : '/'}`]
        // Example additional values: https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-HTTPPOSTConstructPolicy.html
      ],
      Expires: 60
    });

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

    const bucketId = `${request.requestContext.awsAccountId}-us-east-1-document-library-service.${accountId}`;
    try {
      await new S3({ region: regionManager.getExpectedAwsRegion() }).deleteObject({ Bucket: bucketId, Key: `documents/${documentUri}` }).promise();
    } catch (error) {
      logger.log({ title: 'Failed to delete object', error });
      return { statusCode: 400 };
    }

    return {
      statusCode: 204
    };
  }
}

module.exports = new DocumentsController();
