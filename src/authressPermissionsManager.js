const { AuthressClient, ServiceClientTokenProvider } = require('authress-sdk');

// Defined here: https://authress.io/app/#/api
const authressBaseUrl = process.env.AUTHRESS_HOST_URL;

// Create one here: https://authress.io/app/#/setup?focus=clients
const accessKey = process.env.AUTHRESS_SERVICE_CLIENT_ACCESS_KEY;

class AuthressPermissionsManager {
  constructor() {
    this.authressClient = new AuthressClient({ baseUrl: authressBaseUrl }, new ServiceClientTokenProvider(accessKey));
    this.authorization = null;
  }

  getUserAuthressClient() {
    return new AuthressClient({ baseUrl: authressBaseUrl }, () => this.authorization?.jwt);
  }

  async ensureAdminRecord(accountId, userId) {
    const recordId = `rec:${accountId}`;
    try {
      await this.authressClient.accessRecords.getRecord(recordId);
    } catch (error) {
      if (error.status !== 404) {
        throw error;
      }

      try {
        await this.authressClient.accessRecords.createRecord({
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
    const response = await this.getUserAuthressClient().userPermissions.getUserResources(null, resourceUri, 20, null, 'READ');
    return response.data;
  }

  async hasAccessToResource(resourceUri, permission = 'READ') {
    if (!accessKey) {
      throw Error.create({ title: "Lambda environment variable 'AUTHRESS_SERVICE_CLIENT_ACCESS_KEY' must be specified.", errorUrl: 'https://authress.io/app/#/setup?focus=clients' }, 'DocumentLibraryMissingArgumentException');
    }

    if (!accessKey) {
      throw Error.create({ title: "Lambda environment variable 'AUTHRESS_HOST_URL' must be specified. Create an Authress account to retrieve.", errorUrl: 'https://authress.io/app/#/api' }, 'DocumentLibraryMissingArgumentException');
    }

    try {
      await this.getUserAuthressClient().userPermissions.authorizeUser(null, resourceUri, permission);
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = new AuthressPermissionsManager();
