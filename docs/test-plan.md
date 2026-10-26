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
