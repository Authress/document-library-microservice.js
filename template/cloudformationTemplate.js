module.exports = {
  getTemplate(packageName, lambdaVersion) {
    return {
      AWSTemplateFormatVersion: '2010-09-09',
      Transform: 'AWS::Serverless-2016-10-31',
      Description: 'S3 Explorer automation template',
      Parameters: {
        CustomDomain: {
          Type: 'String',
          Description: '[Optional] Configure a custom API domain for the document repository, by default uses API Gateway. Do not include the prefix "https://". [PATTERN: console.example.com]',
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
            Description: 'Document Repository Microservice',
            FunctionName: { 'Fn::Sub': '${AWS::StackName}-${AWS::Region}-lambda' },
            Handler: 'index.handler',
            Role: { 'Fn::GetAtt': ['AWSLambdaExecutionRole', 'Arn'] },
            Timeout: 900,
            Runtime: 'nodejs14.x',
            Code: {
              S3Bucket: '',
              S3Key: `${packageName}/${lambdaVersion}/lambda.zip`
            },
            Environment: {
              Variables: {
                AUTHRESS_HOST_URL: '',
                AUTHRESS_SERVICE_CLIENT_ACCESS_KEY: ''
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
                PolicyDocument: {
                  Statement: [
                    {
                      Action: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
                      Effect: 'Allow',
                      Resource: 'arn:aws:logs:*:*:*'
                    }
                  ],
                  Version: '2012-10-17'
                },
                PolicyName: { 'Fn::Sub': '${AWS::StackName}-${AWS::Region}-AWSLambda-CW' }
              },
              {
                PolicyDocument: {
                  Statement: [
                    {
                      Sid: 'S3Configuration',
                      Action: ['s3:PutObject', 's3:DeleteObject'],
                      Effect: 'Allow',
                      Resource: [{ 'Fn::Sub': '${BucketForS3ExplorerSavedConfiguration.Arn}/*' }]
                    },
                    {
                      Sid: 'CertificateManagement',
                      Action: ['acm:RequestCertificate', 'acm:DescribeCertificate', 'acm:ListCertificates', 'acm:AddTagsToCertificate', 'route53:ListHostedZonesByName'],
                      Effect: 'Allow',
                      Resource: '*'
                    }
                  ],
                  Version: '2012-10-17'
                },
                PolicyName: { 'Fn::Sub': '${AWS::StackName}-${AWS::Region}-AWSLambda' }
              }
            ],
            RoleName: { 'Fn::Sub': '${AWS::StackName}-${AWS::Region}-AWSLambdaExecutionRole' }
          }
        }
      },

      Outputs: {
        ApiUrl: {
          Description: "Document repository deployed API location, customize using the 'CustomDomain' parameter.",
          Value: { 'Fn::If': ['DeployCustomDomain', { 'Fn::Sub': 'https://${CustomDomain}' }, { 'Fn::Sub': '${ApiGateway.Domain}' }] }
        }
      }
    };
  }
};

