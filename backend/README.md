# Run notes

The app runs local only, so the server needs a single-node replica set. A plain
`mongod` will not run a cross-collection write, and the bought path and the consume
path both need one ([transactions](https://www.mongodb.com/docs/manual/core/transactions/)).

Start the database:

```bash
mongod --replSet rs0 --dbpath ./data
```

Then a one-time init:

```bash
mongosh --eval 'rs.initiate()'
```

Run the server:

```bash
cp .env.example .env
npm install
npm start
```

The API listens on `http://127.0.0.1:5000/it4788`. The daily job runs inside the
server process, which is allowed because the app is local only.

Environment:

| Name | Default | Rule |
| --- | --- | --- |
| `MONGO_URI` | `mongodb://localhost:27017/?replicaSet=rs0&directConnection=true` | the URI must name the replica set, or use `directConnection` for one host |
| `PORT` | 5000 | base path is `/it4788` |
| `JWT_SECRET` | dev value | change it |
| `TZ` | `Asia/Ho_Chi_Minh` | group time, read from the group leader |
| `SMTP_HOST` | empty | empty host runs the sender in noop mode, which returns the same code. Set it to the local capture for the demo |
| `SMTP_PORT` | 1025 | the local capture listens here, with its web page on 8025 |
| `EXPO_PUSH_URL` | empty | empty url reports the queue only, as the rule in D33 |

Run the local mail capture for the demo, so no provider account is needed:

```bash
docker run -p 1025:1025 -p 8025:8025 mailhog/mailhog
```

Then send a code with an empty `SMTP_HOST` first, to see the noop path, and set
`SMTP_HOST=127.0.0.1` to see the message arrive on the capture page.

Tests: `npm test` for Jest, `npm run test:integration` for the replica set proof,
`npm run test:api` for the HTTP layer.
