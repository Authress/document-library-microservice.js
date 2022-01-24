const { S3 } = require('aws-sdk');
const shortUuid = require('short-uuid');

const authressPermissionsManager = require('./authressPermissionsManager');
const regionManager = require('./regionManager');

class AccountsController {
  async getAccount(request) {
    const accountId = request.pathParameters.accountId;

    if (!await authressPermissionsManager.hasAccessToResource(`/accounts/${accountId}`, 'accounts:read')) {
      return {
        statusCode: 404
      };
    }

    return {
      statusCode: 200,
      body: {
        accountId
      }
    };
  }

  async createAccount(request) {
    const userId = request.requestContext.authorizer.principalId;

    const accountIdTranslator = shortUuid('abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ346789');
    const accountId = `acc_${accountIdTranslator.generate()}`;

    await authressPermissionsManager.ensureAdminRecord(accountId, userId);

    const bucketId = `${request.requestContext.awsAccountId}-us-east-1-document-library-service.${accountId}`;
    await new S3({ region: regionManager.getExpectedAwsRegion() }).createBucket({
      Bucket: bucketId,
      ACL: 'private',
      CreateBucketConfiguration: {
        LocationConstraint: regionManager.getExpectedAwsRegion()
      }
    }).promise();

    return {
      statusCode: 201,
      body: {
        accountId
      }
    };
  }
}

module.exports = new AccountsController();
