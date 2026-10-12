# Security-rule tests

These check `firestore.rules` (who may read or write what) against the local Firestore emulator. They need Java and Node.

From the project folder (the one with `firebase.json`):

```
npm run test:rules
```

Run them after every change to `firestore.rules`. Nothing in this folder is deployed.
