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
      // Fields support direct data as form fields and are directly translated to `eq` conditions. For exact matches they can be put here or used in the Conditions.
      // Fields: {
      //   // key: value
      // },
      Conditions: [
        { acl: 'private' },
        { bucket: bucketId },
        ['starts-with', '$key', `documents/${documentUri}${isDirectory ? '' : '/'}`]
        // Example additional values: https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-HTTPPOSTConstructPolicy.html
        // And more properties: https://docs.aws.amazon.com/AmazonS3/latest/API/RESTObjectPOST.html

        // Validate s3 specific properties
        // {"acl": "public-read"},
        // {"success_action_redirect": "http://sigv4examplebucket.s3.amazonaws.com/successful_upload.html"},
        // ["starts-with", "$Content-Type", "image/"], // or ["eq", "$Content-Type", "image/jpeg"],
        // {"x-amz-server-side-encryption": "AES256"},
        // ['content-length-range', 0, 10000000], // 10 MB

        // Set meta data properties
        // {"x-amz-meta-uuid": "14365123651274"},
        // ["starts-with", "$x-amz-meta-tag", ""],
    
        // X-AMZ properties
        // {"x-amz-credential": "AKIAIOSFODNN7EXAMPLE/20151229/us-east-1/s3/aws4_request"},
        // {"x-amz-algorithm": "AWS4-HMAC-SHA256"},
        // {"x-amz-date": "20151229T000000Z" }
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
