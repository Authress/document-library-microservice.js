module.exports = {
  getTemplate(packageName, lambdaVersion) {
    return {
      AWSTemplateFormatVersion: '2010-09-09',
      Transform: 'AWS::Serverless-2016-10-31',
      Description: 'S3 Document Library Microservice utilizing Authress.',
      Parameters: {
        CustomDomain: {
          Type: 'String',
          Description: '[Optional] Configure a custom API domain for the document library, by default uses CloudFront domain. Do not include the prefix "https://". [PATTERN: console.example.com]',
          Default: ''
        },
        AuthressHostUrl: {
          Type: 'String',
          Description: '[Optional] Your Authress account host url, found at: https://authress.io/app/#/api. This can be updated after deployment.',
          Default: ''
        },
        AuthressServiceClientAccessKey: {
          Type: 'String',
          Description: '[Optional] Your Authress service client access key, found at: https://authress.io/app/#/setup?focus=clients. This can be updated after deployment.',
          Default: ''
        }
      },

      Conditions: {
        DeployCustomDomain: { 'Fn::Not': [{ 'Fn::Equals': [{ Ref: 'CustomDomain' }, ''] }] }
      },

      Resources: {
        // S3CustomResource: {
        //   Type: 'Custom::S3CustomResource',
        //   DependsOn: 'AWSLambdaExecutionRole',
        //   Properties: {
        //     ServiceToken: { 'Fn::GetAtt': ['AWSLambdaFunction', 'Arn'] },
        //     Type: 'BUCKET',
        //     AwsAccountId: { Ref: 'AWS::AccountId' },
        //     CustomDomain: { Ref: 'CustomDomain' }
        //   }
        // },
        AWSLambdaFunction: {
          Type: 'AWS::Lambda::Function',
          Properties: {
            Description: 'Document Library Microservice',
            FunctionName: { 'Fn::Sub': '${AWS::StackName}-${AWS::Region}-lambda' },
            Handler: 'index.handler',
            Role: { 'Fn::GetAtt': ['AWSLambdaExecutionRole', 'Arn'] },
            Timeout: 900,
            Runtime: 'nodejs14.x',
            Code: {
              S3Bucket: 'document-repository-microservice-public-artifacts-us-east-1',
              S3Key: `${packageName}/${lambdaVersion}/lambda.zip`
            },
            Environment: {
              Variables: {
                AUTHRESS_HOST_URL: { Ref: 'AuthressHostUrl' },
                AUTHRESS_SERVICE_CLIENT_ACCESS_KEY: { Ref: 'AuthressServiceClientAccessKey' }
              }
            }
          }
        },

        CloudWatchLambdaLogGroup: {
          Type: 'AWS::Logs::LogGroup',
          Properties: {
            LogGroupName: { 'Fn::Sub': '/aws/lambda/${AWS::StackName}-${AWS::Region}-lambda' },
            RetentionInDays: 365
          }
        },

        AWSLambdaExecutionRole: {
          Type: 'AWS::IAM::Role',
          Properties: {
            RoleName: { 'Fn::Sub': '${AWS::StackName}-${AWS::Region}-AWSLambdaExecutionRole' },
            AssumeRolePolicyDocument: {
              Statement: [
                {
                  Action: ['sts:AssumeRole'],
                  Effect: 'Allow',
                  Principal: {
                    Service: ['lambda.amazonaws.com']
                  }
                }
              ],
              Version: '2012-10-17'
            },
            Path: '/',
            Policies: [
              {
                PolicyName: { 'Fn::Sub': '${AWS::StackName}-${AWS::Region}-AWSLambda-CW' },
                PolicyDocument: {
                  Statement: [
                    {
                      Action: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
                      Effect: 'Allow',
                      Resource: 'arn:aws:logs:*:*:*'
                    }
                  ],
                  Version: '2012-10-17'
                }
              },
              {
                PolicyName: { 'Fn::Sub': '${AWS::StackName}-${AWS::Region}-AWSLambda' },
                PolicyDocument: {
                  Statement: [
                    {
                      Sid: 'ManageS3DocumentLibraryBuckets',
                      Action: ['s3:*'],
                      Effect: 'Allow',
                      Resource: [{ 'Fn::Sub': 'arn:aws:s3:::${AWS::AccountId}-${AWS::Region}-document-library-service.*' }]
                    },
                    {
                      Sid: 'CertificateManagement',
                      Action: ['acm:RequestCertificate', 'acm:DescribeCertificate', 'acm:ListCertificates', 'acm:AddTagsToCertificate', 'route53:ListHostedZonesByName'],
                      Effect: 'Allow',
                      Resource: '*'
                    }
                  ],
                  Version: '2012-10-17'
                }
              }
            ]
          }
        }
      }

      // Outputs: {
      //   ApiUrl: {
      //     Description: "Document library deployed API location, customize using the 'CustomDomain' parameter.",
      //     Value: { 'Fn::If': ['DeployCustomDomain', { 'Fn::Sub': 'https://${CustomDomain}' }, { 'Fn::Sub': '${CloudFront.Domain}' }] }
      //   }
      // }
    };
  }
};

