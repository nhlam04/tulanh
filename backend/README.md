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

Tests: `npm test` for Jest, `npm run test:integration` for the replica set proof,
`npm run test:api` for the HTTP layer.
