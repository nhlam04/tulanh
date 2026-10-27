# App folder

`app.json` carries the Expo project id, which comes from the project settings on expo.dev and is
read by `src/features/push.ts` through `expo-constants`. It is left empty here because the value
belongs to the team account. The notifications plugin is listed so the client can ask for the
device permission and read the token.

The offline queue runs on `expo-sqlite` on the device. On this machine the rule tests run against
the interface in `src/offline/queue.ts`, not against a device database.
