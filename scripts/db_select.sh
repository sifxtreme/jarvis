#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${DB_ENV_FILE:-"$SCRIPT_DIR/../db/finance_db.env"}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE"
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

if [[ -t 0 && $# -gt 0 ]]; then
  SQL="$*"
else
  SQL="$(cat)"
fi

SQL_TRIM="$(echo "$SQL" | tr '\n' ' ' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
if [[ -z "$SQL_TRIM" ]]; then
  echo "No SQL provided."
  exit 1
fi

SQL_LOWER="$(echo "$SQL_TRIM" | tr 'A-Z' 'a-z')"
if [[ "$SQL_LOWER" != select* ]]; then
  echo "Only SELECT statements are allowed."
  exit 1
fi

if echo "$SQL_LOWER" | grep -E -q '\b(insert|update|delete|drop|alter|create|truncate|grant|revoke)\b'; then
  echo "Only SELECT statements are allowed."
  exit 1
fi

PGPASSWORD="$DB_PASSWORD" psql \
  "host=$DB_HOST port=$DB_PORT dbname=$DB_NAME user=$DB_USER" \
  -c "$SQL"
