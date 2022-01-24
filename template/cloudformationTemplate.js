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
        CloudFrontHostingBucket: {
          Type: 'AWS::S3::Bucket',
          Properties: {
            BucketName: { 'Fn::Sub': '${AWS::AccountId}-${AWS::Region}-document-library' },
            Tags: [
              {
                Key: 'Service',
                Value: { Ref: 'S3 Document Library' }
              }
            ],
            LifecycleConfiguration: {
              Rules: [{
                Id: 'LifecycleRule',
                Status: 'Enabled',
                AbortIncompleteMultipartUpload: {
                  DaysAfterInitiation: 5
                },
                NoncurrentVersionExpirationInDays: 30
              }]
            }
          }
        },
        CloudFrontOriginAccessIdentity: {
          Type: 'AWS::CloudFront::CloudFrontOriginAccessIdentity',
          Properties: {
            CloudFrontOriginAccessIdentityConfig: {
              Comment: { 'Fn::Sub': '${AWS::AccountId}-${AWS::Region}-document-library' }
            }
          }
        },
        S3BucketPolicy: {
          Type: 'AWS::S3::BucketPolicy',
          Properties: {
            Bucket: { 'Fn::Sub': '${AWS::AccountId}-${AWS::Region}-document-library' },
            PolicyDocument: {
              Version: '2012-10-17',
              Statement: [
                {
                  Sid: 'Grant a CloudFront Origin Identity access to support private content',
                  Effect: 'Allow',
                  Principal: {
                    CanonicalUser: { 'Fn::GetAtt': ['CloudFrontOriginAccessIdentity', 'S3CanonicalUserId'] }
                  },
                  Action: 's3:GetObject',
                  Resource: { 'Fn::Sub': 'arn:aws:s3:::${AWS::AccountId}-${AWS::Region}-document-library/*' }
                }
              ]
            }
          }
        },
    
        CloudFrontDistribution: {
          Type: 'AWS::CloudFront::Distribution',
          Properties: {
            DistributionConfig: {
              Comment: 'Document Library API',
              DefaultRootObject: 'index.html',
              HttpVersion: 'http2',
              PriceClass: 'PriceClass_200',
              Origins: [
                {
                  DomainName: { 'Fn::Sub': '${AWS::AccountId}-${AWS::Region}-document-library.s3.amazonaws.com' },
                  Id: { 'Fn::Sub': 'API' },
                  S3OriginConfig: {
                    OriginAccessIdentity: { 'Fn::Sub': 'origin-access-identity/cloudfront/${CloudFrontOriginAccessIdentity}' }
                  }
                }
              ],
              Enabled: true,
              // ViewerCertificate: {
              //   AcmCertificateArn: { Ref: 'AcmCertificateWildcard' },
              //   MinimumProtocolVersion: 'TLSv1.2_2019',
              //   SslSupportMethod: 'sni-only'
              // },
              DefaultCacheBehavior: {
                AllowedMethods: ['GET', 'HEAD', 'OPTIONS', 'PUT', 'PATCH', 'POST', 'DELETE'],
                Compress: true,
                CachePolicyId: '4135ea2d-6df8-44a3-9df3-4b5a84be39ad',
                OriginRequestPolicyId: '216adef6-5c7f-47e4-b989-5492eafa07d3',
                TargetOriginId: { 'Fn::Sub': 'API' },
                ViewerProtocolPolicy: 'redirect-to-https',
                LambdaFunctionAssociations: [{
                  EventType: 'origin-request',
                  IncludeBody: true,
                  LambdaFunctionARN: { 'Fn::Sub': `\${LambdaFunctionVersion-${Date.now()}.Arn}` }
                }]
              }
            }
          }
        },

        LambdaConfiguration: {
          Type: 'AWS::SSM::Parameter',
          Properties: {
            DataType: 'Text',
            Description: 'Configuration for Document Library lambda',
            Name: { 'Fn::Sub': 'Document-Library-Configuration/AuthressConfiguration' },
            Tier: 'Standard',
            Type: 'StringList',
            Value: { 'Fn::Sub': '${AuthressHostUrl},${AuthressServiceClientAccessKey}' }
          }
        },

        AWSLambdaFunction: {
          Type: 'AWS::Lambda::Function',
          Properties: {
            Description: 'Document Library Microservice',
            FunctionName: { 'Fn::Sub': '${AWS::StackName}-${AWS::Region}-lambda' },
            Handler: 'index.handler',
            Role: { 'Fn::GetAtt': ['AWSLambdaExecutionRole', 'Arn'] },
            MemorySize: 512,
            Timeout: 30,
            Runtime: 'nodejs14.x',
            Code: {
              S3Bucket: 'document-repository-microservice-public-artifacts-us-east-1',
              S3Key: `${packageName}/${lambdaVersion}/lambda.zip`
            }
          }
        },

        [`LambdaFunctionVersion-${Date.now()}`]: {
          Type: 'AWS::Lambda::Version',
          Properties: {
            FunctionName: { Ref: 'AWSLambdaFunction' },
            Description: `CloudFront deployed lambda function from version template version: ${lambdaVersion}`
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
                    Service: ['lambda.amazonaws.com', 'edgelambda.amazonaws.com']
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
                      Sid: 'GetLambdaConfigurationFromParameterStore',
                      Action: ['ssm:GetParameter', 'ssm:GetParameters', 'ssm:GetParametersByPath'],
                      Effect: 'Allow',
                      Resource: [{ 'Fn::Sub': 'arn:aws:ssm:${AWS::Region}:${AWS::AccountId}:parameter/Document-Library-Configuration*' }]
                    },
                    {
                      Sid: 'ManageS3DocumentLibraryBuckets',
                      Action: ['s3:*'],
                      Effect: 'Allow',
                      Resource: [{ 'Fn::Sub': 'arn:aws:s3:::${AWS::AccountId}-${AWS::Region}-document-library-service.*' }]
                    }
                    // {
                    //   Sid: 'CertificateManagement',
                    //   Action: ['acm:RequestCertificate', 'acm:DescribeCertificate', 'acm:ListCertificates', 'acm:AddTagsToCertificate', 'route53:ListHostedZonesByName'],
                    //   Effect: 'Allow',
                    //   Resource: '*'
                    // }
                  ],
                  Version: '2012-10-17'
                }
              }
            ]
          }
        }
      },

      Outputs: {
        ApiUrl: {
          Description: "Document library deployed API location, customize using the 'CustomDomain' parameter.",
          Value: { 'Fn::If': ['DeployCustomDomain', { 'Fn::Sub': 'https://${CustomDomain}' }, { 'Fn::Sub': 'https://${CloudFront.DomainName}' }] }
        }
      }
    };
  }
};

