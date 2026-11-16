# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/ndrean7/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/ndrean7/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar ranks every protocol in a sealed DefiLlama snapshot (758 protocols, 14 Nov 2026) that still records no token, by what its launch would be worth. The board carries all 40 watchlist protocols plus 157 more that pass the same rule — 197 rows in all — with a seven-step farm plan for each. The value model (radar-2) prices each protocol with the median market-cap-to-TVL multiple of the live-token protocols in its own category, read out of the snapshot itself, adjusted for 7-day growth, chain count and age. The dashboard is a static page with no network: a sortable, filterable board, a detail view for every protocol with the model's arithmetic and its farm plan, a live-token comparison view, and a model sandbox.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <path-to-snapshot.json>
```

Node.js 22.18 or later. The program writes `out/board.json`, `out/data.js`, `out/dashboard/`, `out/screenshots/` and `out/dossier.json`. Screenshots are taken with a headless browser against `out/dashboard/index.html` (see `BUILD_NOTES.md`).

---

<sub>Entered on [make.fun](https://make.fun/?ref={referral_code}&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
