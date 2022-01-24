const { SSM } = require('aws-sdk');
const { AuthressClient, ServiceClientTokenProvider } = require('authress-sdk');
const regionManager = require('./regionManager');

const ssmParameterAsync = new SSM({ region: regionManager.getExpectedAwsRegion() }).getParametersByPath({ Path: '/Document-Library-Configuration' }).promise().then(r => r.Parameters[0].Value);

class AuthressPermissionsManager {
  constructor() {
    this.authressClient = null;
    this.authorization = null;
  }

  async getParameters() {
    const ssmParameter = await ssmParameterAsync;
    const authressBaseUrl = ssmParameter.split(',')[0];
    const accessKey = ssmParameter.split(',')[1];
    if (!accessKey) {
      throw Error.create({ title: 'SSM Parameter does not contain a valid Authress access key.', errorUrl: 'https://authress.io/app/#/setup?focus=clients' }, 'DocumentLibraryMissingArgumentException');
    }

    if (!authressBaseUrl) {
      throw Error.create({ title: 'SSM Parameter does not contain a valid Authress domain host.', errorUrl: 'https://authress.io/app/#/api' }, 'DocumentLibraryMissingArgumentException');
    }

    return { accessKey, authressBaseUrl };
  }

  async getUserAuthressClient() {
    const { authressBaseUrl } = await this.getParameters();
    return new AuthressClient({ baseUrl: authressBaseUrl }, () => this.authorization?.jwt);
  }

  async getAuthressServiceClient() {
    if (!this.authressClient) {
      const { authressBaseUrl, accessKey } = await this.getParameters();
      this.authressClient = new AuthressClient({ baseUrl: authressBaseUrl }, new ServiceClientTokenProvider(accessKey));
    }
    return this.authressClient;
  }

  async ensureAdminRecord(accountId, userId) {
    const recordId = `rec:${accountId}`;
    const authressClient = await this.getAuthressServiceClient();
    try {
      await authressClient.accessRecords.getRecord(recordId);
    } catch (error) {
      if (error.status !== 404) {
        throw error;
      }

      try {
        await authressClient.accessRecords.createRecord({
          recordId,
          name: `Admin Access for ${accountId}`,
          users: [{ userId }],
          admins: [{ userId }],
          statements: [{ resources: [{ resourceUri: `/accounts/${accountId}` }], roles: ['Authress:Owner'] }]
        });
      } catch (createError) {
        if (createError.status !== 409) {
          throw createError;
        }
      }
    }
  }

  async getUserResources(resourceUri) {
    const userAuthressClient = await this.getUserAuthressClient();
    const response = await userAuthressClient.userPermissions.getUserResources(null, resourceUri, 20, null, 'READ');
    return response.data;
  }

  async hasAccessToResource(resourceUri, permission = 'READ') {
    try {
      const userAuthressClient = await this.getUserAuthressClient();
      await userAuthressClient.userPermissions.authorizeUser(null, resourceUri, permission);
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = new AuthressPermissionsManager();
