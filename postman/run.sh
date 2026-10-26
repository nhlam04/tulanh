#!/usr/bin/env bash
# QA run (Hòa): Newman runs the collection built from the route table.
# Needs a token from the login call, so the run keeps the login step first.
set -euo pipefail

BASE="${API_BASE:-http://127.0.0.1:5000/it4788}"
TOKEN="${POSTMAN_TOKEN:-}"

if [ -z "$TOKEN" ]; then
  echo "set POSTMAN_TOKEN from a login call, or run the collection login first"
  exit 1
fi

newman run postman/ishop.postman_collection.json \
  --env-file postman/env.json \
  --timeout 10000 \
  --reporter-cli-no-author \
  || { echo "collection run failed"; exit 2; }
