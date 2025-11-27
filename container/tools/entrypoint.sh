#!/bin/bash


echo "custome entrypoint..."

AWS_PAGER="" aws secretsmanager get-secret-value --secret-id /config/env --output text --query 'SecretString' >.env
set -a # automatically export all variables
source .env
set +a

exec "${@}"