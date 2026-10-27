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
- Newman for the run: `newman run postman/ishop.postman_collection.json`. The command form
  completes on this machine, checked on 2026-10-27. `postman/run.js` runs the same collection
  through the library with the demo user seeded first, and `postman/walk.js` reports the codes.

Cross-check pairs, from the assignment table: Lâm and Việt check the mobile screens,
Minh and Hùng check the API, and Hòa checks the whole system.

## Run result, 2026-10-27

The collection holds 66 requests: 49 from the spec table and 17 the build adds. The server ran
against a single-node replica set.

| Result | Value |
| --- | --- |
| Requests | 66, 49 from the spec table and 17 the build adds |
| Newman run | 0 failures |
| Envelope rule holds on every response | 66 of 66 |
| Register inside the collection | 00032, the duplicate rule, because the run seeds the user first |
| Login | 00047, token stored for the rest of the run |
| Required-field codes | 24, because the walk sends an empty body on purpose |
| Rate limit | 8 requests read 00024, so the 60 per minute rule reads as written |

The first version of the runner looked like it hung. It did not. Newman 6.2.3 completes through the
callback form; the emitter form on its own never fires the end event, and the handler read
`summary.run.responseCount.total`, which is undefined without a reporter, so it threw and the promise
never resolved. Memory was not the cause: the same single-request probe ran with 27.9 GB free and
behaved the same way. Four more things had to be corrected on the way:

- the url carries the port, as a string or as its own field in the object form;
- a variable in the host position is not resolved, so the host is written plainly;
- a raw body needs the content-type header, or the server reads the required-field code;
- the sandbox chai on this machine has no `toEqual` or `toBe`, so plain equality is used.

The codes read by each request come from walk.js, because the callback form does not carry the
response through an event on this version. The walk is not a second test tool; it reports what the
same collection reads.

One rule reads differently in a run: the rate limit window is a calendar minute, so a run that
crosses the boundary can land 60 requests in each window and read no limit. The test sends until
the limit answers. The 8 requests that read 00024 in the walk above are the rule working, not a fault.

What runs on this machine today: Jest unit tests over the fake store, the node runner
integration tests against a single-node replica set, the HTTP layer test, and the two
client rule tests. React Native Testing Library and Detox need the React Native toolchain,
so those runs happen on a device, not here.

Commit rule: one member's scope per commit, with the member's name in the message, for
example `core: Lâm - ...` or `business: Việt - ...`. Git lives in `implementation/` only.
