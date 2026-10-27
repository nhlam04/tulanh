#!/usr/bin/env bash
# QA run (Hòa): Newman runs the collection built from the route table.
# The token is not passed in: the login request inside the collection stores it in the run
# environment, so the run is self-contained. The host is written plainly in the collection,
# because newman 6.2.3 does not resolve a variable in the host position.
#
# Two things this command form cannot do on this machine: it needs a server already running on
# port 5000, and the assertions read the seeded state, so the register request reads the duplicate
# rule and login reads the gate unless the demo user is verified in the database first. Use
# postman/run.js for the automated run, which seeds the user and reports the codes.
set -euo pipefail

cd "$(dirname "$0")/.."

npx newman run postman/ishop.postman_collection.json \
  --timeout 10000 \
  --reporter-cli-no-author \
  || { echo "collection run failed"; exit 2; }
