# Backend Tests

Run commands from the `backend` directory. The default suite uses Node's built-in test runner and stubs database/provider calls; it does not need MongoDB credentials or make paid AI requests.

## Run All Isolated Tests

```sh
npm test
```

The suite currently includes regression checks for known issues. Failures mean the expected behavior is not currently met; they are not tests that should be skipped to get a green run.

## Run One Module Check

Use `--test-name-pattern` to run a single named check:

```sh
node --test --test-name-pattern='ai/normalizer.js' test-each.js
node --test --test-name-pattern='ai/port.js' test-each.js
node --test --test-name-pattern='ai/orchestrator.js' test-each.js
node --test --test-name-pattern='ai/adapters/openrouter.js' test-each.js
node --test --test-name-pattern='ai/queue.js' test-each.js
node --test --test-name-pattern='ai/index.js' test-each.js
node --test --test-name-pattern='models/Group.js' test-each.js
node --test --test-name-pattern='models/Note.js' test-each.js
node --test --test-name-pattern='models/Usage.js' test-each.js
node --test --test-name-pattern='models/Messages.js' test-each.js
node --test --test-name-pattern='models/User.js' test-each.js
node --test --test-name-pattern='middleware/Auth.js' test-each.js
node --test --test-name-pattern='utils/context.js' test-each.js
node --test --test-name-pattern='routes/Auth.js' test-each.js
node --test --test-name-pattern='routes/Note.js' test-each.js
node --test --test-name-pattern='routes/Ai.js' test-each.js
node --test --test-name-pattern='server.js' test-each.js
node --test --test-name-pattern='legacy ai/test.js' test-each.js
```

The syntax check is included for `server.js` and all production modules. The final command separately checks the older `ai/test.js` script, which is not production code.

## Live Database/API Integration

These tests need the backend server running against a disposable test database. They create users and notes and should not be run against production data. Set `BASE_URL` to the actual server address; the server defaults to port 3000:

```sh
BASE_URL=http://localhost:3000 npm run test:integration
```

The AI end-to-end test also contacts the configured provider, creates persistent test records, and can consume provider quota:

```sh
BASE_URL=http://localhost:3000 npm run test:ai
```

Run that only with test credentials and a disposable database. Do not use `testA.js` for routine verification because it prints a prefix of the configured provider key.