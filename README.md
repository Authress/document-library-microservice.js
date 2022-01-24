# AWS S3 Document Library

<p align="center">
    <a href="./LICENSE" alt="apache 2.0 license">
      <img src="https://img.shields.io/badge/license-Apache%202.0-blue.svg">
    </a>
    <a href="https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/create/app?applicationId=arn:aws:serverlessrepo:eu-west-1:922723803004:applications/S3-Document-Library" alt="Installations">
      <img src="https://img.shields.io/badge/Installed%20Deployments-1637-success">
    </a>
    <a href="https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/create/app?applicationId=arn:aws:serverlessrepo:eu-west-1:922723803004:applications/S3-Document-Library" alt="AWS Serverless Application">
        <img src="https://img.shields.io/badge/AWS%20Serverless%20Application-S3%20Document%20Library-blue">
    </a>
</p>

This is the Document Library microservice. It uses S3 as a backend to expose a REST api providing the features of a Dropbox or Google Drive. To do this it utilizes an [Authress account](https://authress.io) and deploys a Lambda microservice to CloudFront. It is a globally redundant service which is 100% serverless and scales with usage.

The Authress development team has provided this as a fully working service to demonstrate the ability to add granular access permissions to any microservice.

## Features
* Fully integratable with any user identity management tool. Follow the configuration steps and hook up the IdP to your Authress account.
* Utilizes CloudFront to be global accessible and redundant using Lambda@Edge for edge compute
* Generates Presigned urls where possible to enable GB or TB large uploads directly to and downloads from S3.
* Hierarchy based permissions management to give access to cascading resources.
* Multitenant architecture, enabling your users to use separated `accounts` to manage their own tenant in your service
* One-click deploys directly from the [AWS Serverless Application(https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/create/app?applicationId=arn:aws:serverlessrepo:eu-west-1:922723803004:applications/S3-Document-Library)

## Setup
1. Deploy the lambda function using the `npm run deploy` function or directly from the [AWS Serverless Application(https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/create/app?applicationId=arn:aws:serverlessrepo:eu-west-1:922723803004:applications/S3-Document-Library).
1. Configure your Authress account and generate a Service Client for access permission checks
1. Done!

## Troubleshooting
If you run into any problems just try running through the suggested [Troubleshooting steps](./docs/troubleshooting.md) and if that doesn't help, [file an issue](https://github.com/Authress/document-library-microservice.js/issues), we are usually quick to respond.

<!-- ## Standard use cases:


## Contribution

### Development -->