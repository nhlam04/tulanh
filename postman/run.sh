#!/usr/bin/env bash
# QA run (Hòa): Newman runs the collection built from the route table.
# The token is not passed in: the login request inside the collection stores it in the run
# environment, so the run is self-contained. The host is written plainly in the collection,
# because newman 6.2.3 does not resolve a variable in the host position.
set -euo pipefail

cd "$(dirname "$0")/.."

newman run postman/ishop.postman_collection.json \
  --timeout 10000 \
  --reporter-cli-no-author \
  || { echo "collection run failed"; exit 2; }
