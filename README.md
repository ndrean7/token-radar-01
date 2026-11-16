# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/ndrean7/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/ndrean7/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar ranks every protocol in a sealed DefiLlama snapshot (758 protocols, 14 Nov 2026) that still records no token, by what its launch would be worth. The board carries all 40 watchlist protocols plus 157 more that pass the same rule — 197 rows in all — with a seven-step farm plan for each. The value model (radar-5) prices each protocol from the snapshot's own live-token protocols: a shrunk category multiple (the category's geometric-mean market-cap-to-TVL ratio blended with the global geometric mean by live count, n/(n+10)), adjusted for size — within a category the market prices a bigger protocol at a lower multiple of its TVL (size slope −0.60, fitted by median error — the grid floor on this snapshot — measured against the category's typical TVL, itself shrunk toward the global median TVL by live count, n/(n+2)) — plus small tilts for 7-day growth and age. The dashboard is a static page with no network: a sortable, filterable board, a detail view for every protocol with the model's arithmetic, its category-multiple provenance and its farm plan, a live-token comparison view, and a model sandbox.

The model was checked against the snapshot's own 119 live-token protocols (repeated 5-fold cross-validation, 10 reshuffles, same folds for every model): it predicts their market caps with a median log error of 0.49, against 0.54 for radar-4, 0.60 for radar-3 and 0.67 for a flat category median, and lands within 2× of the true value 31% of the time, against 31%, 28% and 22%. The gain holds on ten fresh reshuffles the tuning never saw. Growth, chain count and age carry no measurable signal for the multiple, so the chain bonus is gone and the growth and maturity tilts are small — only the changes that raised the measured score were kept.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <path-to-snapshot.json>
```

Node.js 22.18 or later. The program writes `out/board.json`, `out/data.js`, `out/dashboard/`, `out/screenshots/` and `out/dossier.json`. Screenshots are taken with a headless browser against `out/dashboard/index.html` (see `BUILD_NOTES.md`).

---

<sub>Entered on [make.fun](https://make.fun/?ref={referral_code}&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
