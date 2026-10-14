# Iterations

Frozen, playable snapshots of earlier builds, kept so the progress is visible and any step can be replayed.
**The newest iteration is the repo root** (see the table in the main README), not a folder here.

```bash
npm start       # then open /iterations/iter-NN/index.html
```

| Folder | Recorded score | What it is |
|---|---|---|
| `iter-01/` | 71/87 | Physics port onto a tile world, full course, rectangle art |
| `iter-02/` | 71/87 | Fairer landing zone |
| `iter-03/` | 86/87 | Pixel-art sprites + visual suite |
| `iter-04/` | 87/87 | Planner hooks, completability proven (`shots/` shows the winning route) |

`scoreboard.json` holds the full per-group record. Scores are against the suite as it was then; re-score with
`npm run score -- iter-NN` to see a build against today's suite (older builds lack the newer hook members, so
some visual and planner tests are expected to fail on them).

To add one: `npm run snapshot -- iter-NN "label"` (freezes the current root). Do not edit these folders by hand.
