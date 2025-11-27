#!/bin/bash


echo "custome entrypoint..."

AWS_PAGER="" aws secretsmanager get-secret-value --profile SandboxAdmin --secret-id /config/env --output text --query 'SecretString' >.env.json

jq -r 'to_entries | .[] | "\(.key)=\"\(.value)\""' .env.json > .env

# automatically export all variables
set -a 
source .env
set +a

rm .env.json
rm .env

exec "${@}"