#!/bin/bash

echo "custome entrypoint..."

if [ "$SKIP_ENTRYPOINT" == "true" ]; then
  echo "skipping."
  exec "${@}"
else 

AWS_PAGER="" aws secretsmanager get-secret-value --secret-id /config/env --output text --query 'SecretString' >.env.json

jq -r 'to_entries | .[] | "\(.key)=\"\(.value)\""' .env.json > .env

# automatically export all variables
set -a 
source .env
set +a

rm .env.json
rm .env

export RAGAPIPW=$(aws secretsmanager get-secret-value --secret-id $RA_ARN |jq '.SecretString | fromjson')
export POSTGRES_USER=$(echo $RAGAPIPW |jq -r .username)
export POSTGRES_PASSWORD=$(echo $RAGAPIPW |jq -r .password)
export POSTGRES_DB=ragapi 

exec "${@}"


fi
