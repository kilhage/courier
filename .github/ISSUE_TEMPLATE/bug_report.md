---
name: Bug report
about: Something behaves differently from the spec or crashes
labels: bug
---

**What happened / what you expected**

**Build** (root, or `iterations/iter-NN`) and browser:

**Steps or input script** (a `window.__smb3.step(...)` snippet reproduces most bugs deterministically):

```js
window.__smb3.reset({ scenario: 'flat' });
window.__smb3.step(60, { right: true, B: true });
```

**Output of `npm run verify`** (if relevant):
