const aws = require('aws-sdk');

class RegionManager {
  constructor() {
    this.globalAwsRegion = 'us-east-1';
  }

  getCurrentAwsRegion() {
    return aws.config.region;
  }
}

module.exports = new RegionManager();
