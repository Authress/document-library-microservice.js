#!/usr/bin/env bash

node make.js test-setup

aws --no-cli-auto-prompt cloudformation deploy --region us-east-1 --stack-name document-library-test --template-file template/cloudformationTemplate.json --capabilities CAPABILITY_NAMED_IAM 
# --parameter-overrides CustomDomain=CUSTOM_DOMANE