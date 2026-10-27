# Test plan

One count for the report: 60 test cases in 9 blocks. The audit file holds the other
numbers, and the design files are reference, so this is the number the build runs to.

Tools, as the register settles them: Postman for the API, Jest for unit tests, React
Native Testing Library for component tests, Detox for the app flow.

| Block | What it covers | Cases |
| --- | --- | --- |
| 1 | Auth gates: register, code, verify, login, refresh, logout | 9 |
| 2 | Permission levels and Rule C ownership | 8 |
| 3 | Name rules as unique indexes | 7 |
| 4 | Food, category, unit reads | 6 |
| 5 | Fridge lot model, update, delete | 7 |
| 6 | Shopping list, task add, claim, bought path | 8 |
| 7 | Consumption write and the replay guard | 6 |
| 8 | Reports, logs, retention, notification job | 6 |
| 9 | Offline read rule, sync queue, admin reads | 6 |

Run set:

- `npm test` — Jest, unit tests over the fake store.
- `npm run test:integration` — node runner against a single-node replica set, because a
  cross-collection write needs one.
- `npm run test:api` — the HTTP layer with the rate limit and the envelope shape.
- Postman collection in `postman/ishop.postman_collection.json`, built from the route
  table in `src/routes.js`, so the collection cannot drift from the server.
- Newman for the run: `newman run postman/ishop.postman_collection.json`.

Cross-check pairs, from the assignment table: Lâm and Việt check the mobile screens,
Minh and Hùng check the API, and Hòa checks the whole system.

## Run result, 2026-10-27

The collection walks 66 requests: 49 from the spec table and 17 the build adds. The server
ran against a single-node replica set.

| Result | Value |
| --- | --- |
| Envelope rule holds on every response | 66 of 66 |
| Requests that hit the rate limit | 8, code 00024, so the 60 per minute rule reads as written |
| Login | code 00047, token set for the rest of the walk |
| Required-field codes | 24 of 66, because the walk sends an empty body on purpose |
| Permission and group codes | 00167 x2, 00345 x5, 00210 x4, 00225 x2 |

Newman does not complete on this machine. It sends the request and fires the test event, but
the end event never arrives, so a run that waits for it hangs. Checked with one request against
a plain local server: response received, test event fired, no end event within 20 seconds. The
collection stays the artifact, and the run on this machine walks the same collection over http.
Newman remains the tool named in the plan for a machine where it completes.

What runs on this machine today: Jest unit tests over the fake store, the node runner
integration tests against a single-node replica set, the HTTP layer test, and the two
client rule tests. React Native Testing Library and Detox need the React Native toolchain,
so those runs happen on a device, not here.

Commit rule: one member's scope per commit, with the member's name in the message, for
example `core: Lâm - ...` or `business: Việt - ...`. Git lives in `implementation/` only.
