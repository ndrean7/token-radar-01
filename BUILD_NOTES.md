# Token Radar — build notes

Entry for make.fun's **"Build the best token launch radar"** (`token-radar-01`, $1,325 USDC in on-chain escrow, ends Mon 14 Dec 2026 10:00 UTC). Model **radar-4** (this revision); radar-3 was submitted 2026-11-16 (commit e12a9d2824e8b6a4da240dd411e78e85bb4b2a34, submission 01a1e27e, claim AF-FP9AN-7BJ38-YCTTH-XT7X0, check 13/0, status scored) and radar-4 awaits resubmission.

## What it is

`main.ts` (Node 22, standard library only) reads a sealed DefiLlama snapshot, scores every pre-token protocol with the radar-4 model in `lib/model.ts`, and writes:

- `board.json` — the ranked board
- `data.js` — the same board for the dashboard
- `dashboard/` — the static page (index.html + app.css + app.js, no network)
- `screenshots/` — the three screenshots
- `dossier.json` — built with the kit's vendored `vendor/makefun-board.ts` (byte-for-byte copy from the kit)

## The model (radar-4)

**Who counts as pre-token** — the sealed watchlist's own rule, applied to every protocol:

- records no token: market cap, CoinGecko id and symbol are all null;
- not a wrapped/staked product: category is not Bridge, Canonical Bridge, Cross Chain Bridge, Liquid Staking, Liquid Restaking, Restaked BTC or CEX; the name has no whole word `wrapped`/`staked`/`staking`, does not end in a version marker (`V2`, `v3`, `2.0`) and does not begin with a centralised-exchange brand.

**Implied value** — from the snapshot's own figures only, every number fitted from the snapshot's 119 live-token protocols:

```
implied = TVL x category_multiple
        x (TVL / typical_TVL) ^ -0.51
        x (1 + clamp(change_7d, -50, 100) / 100 x 0.25)
        x (0.90 + min(age_days, 1460) / 1460 x 0.10)
```

`category_multiple` is the geometric blend of the category's geometric-mean market-cap-to-TVL ratio and the global geometric mean (0.232x), weighted n/(n+30) by the category's live count; `typical_TVL` is the median TVL of the category's live protocols; the size tilt is clamped to 0.25–4.00x and every multiple to 0.05–0.75x. The size slope is not the least-squares fit (−0.33): it is the slope that minimises the median absolute log error of the model's own predictions over the live set (grid −0.60…0 in steps of 0.01, fitted −0.51 on this snapshot). No protocol name is special-cased. The dashboard recomputes every row from the same figures and checks it against board.json — the detail view prints "Page recomputes $X — matches board.json." and a provenance line for the row's category multiple (live count, blend weight, typical TVL).

**What the data said.** Measured on the 119 live protocols before changing anything: within a category, size is the one strong signal for the multiple (slope −0.33 by least squares, t = −2.6); 7-day growth (t = +0.2), chain count (t = −0.3) and age (t = −0.1) carry none. Radar-4 keeps the size tilt, the growth weight 0.25, no chain bonus and maturity 0.90–1.00 — and changes three things, each kept only because it raised the measured score on the same folds and seeds (see below): the category centre is the geometric mean of the ratios instead of the median (the ratios are log-spread, and the mean of the logs prices the typical protocol better); the blend leans harder on the global mean, n/(n+30) instead of n/(n+5), because most categories hold only a few live protocols and their own centre is mostly noise; and the size slope is fitted by median error instead of least squares, because the median protocol's multiple falls with size faster than the mean's does (fitted −0.51, against the OLS −0.33).

**What was tried and thrown away.** Per-category size slopes (shrunk toward the global slope at k = 3/5/10): worse on every reshuffle — 33 categories over 119 protocols is too little data per slope. Rank-based and z-scored size, and a quadratic size term: no gain. A least-absolute-deviation slope fit: worse (it fits the mean absolute error, not the median). Chain bonuses (+2%/+4% per chain): worse, as in radar-3. Growth weights 0–0.75 and maturity curves 0.80–1.00 / flat / log-age: within noise of 0.25 and 0.90–1.00. Fixed slopes steeper than −0.51 (down to the −0.60 clamp) keep shaving the median error but lose Spearman, so the fitted −0.51 stands — it is what the snapshot's own median-error fit picks, not a hand-set constant. The CV harness that ran all of this lives outside the repo (`/tmp/cv/cv.ts`); it reproduces radar-3's published same-seed numbers exactly (seed 20261116: 89.2% / 0.565 / 0.348 / 29.4%), so the comparisons below are on one protocol.

**How it was checked.** The model's job is to price a token that does not exist yet, and the snapshot's live protocols are the only ground truth: 5-fold cross-validation, fit on four folds, predict the held-out fold's market caps, reshuffled 10 times (same folds and metrics for every candidate). The winner was then re-checked on 10 fresh reshuffles (seed base 987654321) the tuning never saw:

| model | median abs. % error | median \|log10 error\| | Spearman | within 2× |
|---|---|---|---|---|
| radar-2 (flat median, growth 0.75, chain +4%, maturity 0.70–1.00; reconstructed) | 92.7% | 0.697 | 0.367 | 20.6% |
| radar-3 (median multiple n/(n+5), OLS size tilt −0.33, growth 0.25, no chains, maturity 0.90–1.00) | 88.6% | 0.596 | 0.360 | 28.0% |
| radar-4 (geometric-mean multiple n/(n+30), median-error size tilt −0.51, growth 0.25, no chains, maturity 0.90–1.00) | 86.2% | 0.544 | 0.356 | 30.8% |

Radar-3's own session measured it at 88.4% / 0.598 / 0.364 / 29.1% on its own fold assignment — this harness reproduces that within noise. Same-seed direct comparison (seed 20261116, shipped functions): radar-3 89.2% / 0.565 / 0.348 / 29.4% vs radar-4 85.1% / 0.520 / 0.352 / 29.4%. Fresh reshuffles (never used for tuning): radar-3 88.0% / 0.606 / 0.359 / 27.8% vs radar-4 85.5% / 0.552 / 0.369 / 31.4% — the gain is not a tuning artefact: on the fresh folds radar-4 beats radar-3 on the median log error in 10/10 reshuffles and on within-2× in 10/10. The Spearman difference (±0.01) is inside the noise (sd ±0.03 across reshuffles); the log-error and within-2× gains are not.

**Farm plan** — 7 steps per protocol, derived from its own record: category decides the action, TVL decides the capital ($50–$250), age decides the hold (30–60 days). First step is wallet hygiene, last is claim safety.

## Numbers (snapshot 2026-11-14)

- 758 protocols in the snapshot; 40 on the watchlist; 342 record no token
- Board: **197 rows** (40 watchlist + 157 found below the $50M floor), all 40 watchlist slugs covered
- Total implied value: **$2,604,749,804**; top launch Veda $230.8M; last row Nucleus $1,557,836
- Fitted size slope −0.51; global geometric-mean multiple 0.232x (radar-3: median 0.246x)
- All 197 implied values are distinct; every farm plan is 7 steps of 99–209 characters
- Live-token view: top 50 live protocols + a 33-category multiples table (blend weight and typical TVL per category)
- Dashboard source: 37,950 bytes total (dossier text 38,214 bytes, cap 65,536); dossier 754,219 bytes (cap 1.5 MiB); no `http` references anywhere in it

## How to run

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <path-to-snapshot.json>
```

Node 24.22.1 was used here (requirement: ≥ 22.18). The sealed snapshot lives in the kit at `../kit/token-radar-01-kit/input/snapshot.json` and is **not** copied into this repo — the grader mounts its own `/input/snapshot.json`.

## Screenshots

No browser was installed on this machine, so Chromium Headless Shell 140 was installed via Playwright (`~/.cache/ms-playwright/chromium_headless_shell-1187`, `npm i playwright-core` in `/tmp/pw`, script `/tmp/pw/verify.mjs`). All three were taken at 1440×900 against `out/dashboard/index.html`:

- `1-board.png` (170 KB) — the board, 197 rows
- `2-detail.png` (215 KB) — detail view of rank #1 Veda, scrolled so the model arithmetic and farm plan are visible
- `3-filtered.png` (138 KB) — the board filtered to category Dexs (21 rows)

Deep links used: `#protocol=veda` and `#category=Dexs` (the dashboard also supports `#tab=live|model` and `#chain=<name>`).

## Verification done

- `main.ts` runs clean; two runs produce byte-identical output (including `dossier.json`)
- Every one of the 197 implied values was independently recomputed from the snapshot with a separate script — 0 mismatches (independent fit: slope −0.51, global multiple 0.2317x)
- Dossier rebuilt independently with `buildDossier` — byte-for-byte identical to the written `dossier.json` (754,219 bytes; text 38,214 of 65,536 allowed)
- Headless-browser checks (all passed): board renders 197 rows; detail farm steps match board.json; page recomputation matches board.json; detail provenance line present; Dexs filter shows 21 rows; live tab renders 50 rows; model tab explains the formula and shows the CV table; the sandbox sliders re-rank the board live
- Screenshots retaken against the radar-4 board are byte-stable across re-runs
- `out/` is local build output, gitignored, not part of the entry

## What remains for resubmission (parent's job, not this session's)

1. Bundle the transcripts of the sessions that built radar-4 (`transcripts.tar.gz`) — the transcript gate counts the sessions that wrote this revision.
2. Run the pre-submit check from the kit directory: `node cli/makefun.mjs check --kit . --repo <your repository> --transcripts transcripts.tar.gz`, then submit: `node cli/makefun.mjs submit --competition token-radar-01 --repo-url <url> --commit <sha> --title <name> --bundle <file> --keypair <file>`.
3. At most 5 submissions a day, 10 in all; the last submission before Mon 14 Dec 2026 10:00 UTC is the final entry. Radar-3's submission (01a1e27e) stays the entry until radar-4 is submitted.
