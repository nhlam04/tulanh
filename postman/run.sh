#!/usr/bin/env bash
# QA run (Hòa): Newman runs the collection built from the route table.
# The host is written plainly in the collection, because newman 6.2.3 does not resolve a variable in
# the host position, so this form needs a server already running on port 5000.
#
# The assertions read rules, not state. The collection names an account the run creates for itself,
# so register answers the register rule and login answers the gate that refuses an account the run
# cannot verify. The same pair holds on any database, which the first version could not do: it
# asserted codes for one fixed demo account, so a database that already had that account read the
# duplicate rule instead.
#
# The reads still need a session. The login request stores the token only when the account is
# verified, and a run cannot verify the account it created, because the code leaves through the mail
# path. So fill {{token}} in the Postman environment from a verified account, or use postman/run.js,
# which seeds one, signs in over http and passes the token in.
set -euo pipefail

cd "$(dirname "$0")/.."

npx newman run postman/tulanh.postman_collection.json \
  --timeout 10000 \
  --reporter-cli-no-author \
  || { echo "collection run failed"; exit 2; }
