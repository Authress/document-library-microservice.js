const aws = require('aws-sdk');

class RegionManager {
  constructor() {
    this.globalAwsRegion = 'us-east-1';
  }

  getCurrentAwsRegion() {
    return aws.config.region;
  }

  getExpectedAwsRegion() {
    return 'us-east-1';
  }
}

module.exports = new RegionManager();
