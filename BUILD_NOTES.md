# Token Radar — build notes

Entry for make.fun's **"Build the best token launch radar"** (`token-radar-01`, $1,325 USDC in on-chain escrow, ends Mon 14 Dec 2026 10:00 UTC). Model **radar-5** (this revision); radar-4 was submitted 2026-11-16 (commit 424f910b3afdee71d92ac8d99b2f8f43c9aa11a6, submission 01a1e39d, claim AF-GC0WP-T90CW-38QWY-NFYYN, check 13/0) and radar-5 awaits resubmission.

## What it is

`main.ts` (Node 22, standard library only) reads a sealed DefiLlama snapshot, scores every pre-token protocol with the radar-5 model in `lib/model.ts`, and writes:

- `board.json` — the ranked board
- `data.js` — the same board for the dashboard
- `dashboard/` — the static page (index.html + app.css + app.js, no network)
- `screenshots/` — the three screenshots
- `dossier.json` — built with the kit's vendored `vendor/makefun-board.ts` (byte-for-byte copy from the kit)

## The model (radar-5)

**Who counts as pre-token** — the sealed watchlist's own rule, applied to every protocol:

- records no token: market cap, CoinGecko id and symbol are all null;
- not a wrapped/staked product: category is not Bridge, Canonical Bridge, Cross Chain Bridge, Liquid Staking, Liquid Restaking, Restaked BTC or CEX; the name has no whole word `wrapped`/`staked`/`staking`, does not end in a version marker (`V2`, `v3`, `2.0`) and does not begin with a centralised-exchange brand.

**Implied value** — from the snapshot's own figures only, every number fitted from the snapshot's 119 live-token protocols:

```
implied = TVL x category_multiple
        x (TVL / typical_TVL) ^ -0.60
        x (1 + clamp(change_7d, -50, 100) / 100 x 0.25)
        x (0.90 + min(age_days, 1460) / 1460 x 0.10)
```

`category_multiple` is the geometric blend of the category's geometric-mean market-cap-to-TVL ratio and the global geometric mean (0.232x), weighted n/(n+10) by the category's live count; `typical_TVL` is the category's median live TVL, itself shrunk toward the global median TVL in log space, weighted n/(n+2); the size tilt is clamped to 0.25–4.00x and every multiple to 0.05–0.75x. The size slope is not the least-squares fit (−0.33): it is the slope that minimises the median absolute log error of the model's own predictions over the live set (grid −0.60…0 in steps of 0.01, fitted −0.60 — the grid floor — on this snapshot). No protocol name is special-cased. The dashboard recomputes every row from the same figures and checks it against board.json — the detail view prints "Page recomputes $X — matches board.json." and a provenance line for the row's category multiple (live count, blend weight, typical TVL).

**What the data said.** Measured on the 119 live protocols before changing anything: within a category, size is the one strong signal for the multiple (slope −0.33 by least squares, t = −2.6); 7-day growth (t = +0.2), chain count (t = −0.3) and age (t = −0.1) carry none. Radar-5 keeps the size tilt, the growth weight 0.25, no chain bonus and maturity 0.90–1.00 — and changes two things against radar-4, each kept only because it raised the measured score on the same folds and seeds (see below): the category's typical TVL is shrunk toward the global median TVL, n/(n+2) in log space, because a category with one or two live protocols cannot price its own typical size — and the size tilt is only as good as the reference it is measured against; and the multiple blend leans less hard on the global mean, n/(n+10) instead of n/(n+30), which only helps once the reference is shrunk (on its own it is worth nothing: +0.005 MdALE, 5/10 reshuffles). The fitted slope moved to the −0.60 grid floor with the shrunk references; widening the floor to −0.70/−0.80 was tested and buys nothing (MdALE 0.497/0.499, Spearman falls to 0.35/0.34), so the floor stays.

**What was tried and thrown away.** Per-category size slopes (shrunk toward the global slope at k = 3/5/10): worse on every reshuffle — 33 categories over 119 protocols is too little data per slope. Rank-based and z-scored size, and a quadratic size term: no gain. A least-absolute-deviation slope fit: worse (it fits the mean absolute error, not the median). Chain bonuses (+2%/+4% per chain): worse, as in radar-3. Growth weights 0–0.75 and maturity curves 0.80–1.00 / flat / log-age: within noise of 0.25 and 0.90–1.00. Fixed slopes steeper than −0.51 (down to the −0.60 clamp) keep shaving the median error but lose Spearman, so the fitted −0.51 stands — it is what the snapshot's own median-error fit picks, not a hand-set constant. The CV harness that ran all of this lives outside the repo (`/tmp/cv/cv.ts`); it reproduces radar-3's published same-seed numbers exactly (seed 20261116: 89.2% / 0.565 / 0.348 / 29.4%), so the comparisons below are on one protocol.

**Radar-5 round (same harness, extended in `/tmp/cv5/cv.ts`).** One early sweep was run on the wrong base (median multiple + OLS slope instead of radar-4) and thrown out when the identical numbers exposed it — every candidate below is on the radar-4 base (geomean multiple, median-error slope). Discarded: trimmed geometric means (10%/20% of log-ratios per category, +0.006/+0.012 MdALE); empirical-Bayes variance-aware shrinkage of the multiple (+0.060 MdALE — the weights lean so hard on the global mean it is effectively a flat model); multiple caps 1.0/1.5 and floor 0.02 (never bind, identical numbers); size clamps 0.5 / 2 / 8 (noise to −1.2pp within-2x); averaging log-predictions with radar-3 (+0.023 MdALE); a slope chosen to maximise train within-2x instead of minimising median error (+0.022 MdALE — it overfits the train folds); growth 0.15–0.35 and maturity 0.85/0.95 (noise). Kept: reference-TVL shrinkage, n/(n+2) in log space — MdALE 0.544 → 0.507 alone (10/10 reshuffles better, within-2x 31.5%) — and, only in combination with it, the multiple blend at n/(n+10) (0.494, 9/10 better, within-2x 31.3%).

**How it was checked.** The model's job is to price a token that does not exist yet, and the snapshot's live protocols are the only ground truth: 5-fold cross-validation, fit on four folds, predict the held-out fold's market caps, reshuffled 10 times (same folds and metrics for every candidate). The winner was then re-checked on 10 fresh reshuffles (seed base 987654321) the tuning never saw:

| model | median abs. % error | median \|log10 error\| | Spearman | within 2× |
|---|---|---|---|---|
| flat category median (no size tilt, no growth, no maturity) | 93.4% | 0.672 | 0.379 | 21.6% |
| radar-2 (flat median, growth 0.75, chain +4%, maturity 0.70–1.00; reconstructed) | 92.7% | 0.697 | 0.367 | 20.6% |
| radar-3 (median multiple n/(n+5), OLS size tilt −0.33, growth 0.25, no chains, maturity 0.90–1.00) | 88.6% | 0.596 | 0.360 | 28.0% |
| radar-4 (geometric-mean multiple n/(n+30), median-error size tilt −0.51, growth 0.25, no chains, maturity 0.90–1.00) | 86.2% | 0.544 | 0.356 | 30.8% |
| radar-5 (radar-4 + reference TVL shrunk n/(n+2), multiple blend n/(n+10)) | 87.1% | 0.494 | 0.360 | 31.3% |

Radar-3's own session measured it at 88.4% / 0.598 / 0.364 / 29.1% on its own fold assignment — this harness reproduces that within noise. Same-seed direct comparison (seed 20261116, shipped functions): radar-3 89.2% / 0.565 / 0.348 / 29.4% vs radar-4 85.1% / 0.520 / 0.352 / 29.4%. Fresh reshuffles (never used for tuning): radar-3 88.0% / 0.606 / 0.359 / 27.8% vs radar-4 85.5% / 0.552 / 0.369 / 31.4% — the gain is not a tuning artefact: on the fresh folds radar-4 beats radar-3 on the median log error in 10/10 reshuffles and on within-2× in 10/10. The Spearman difference (±0.01) is inside the noise (sd ±0.03 across reshuffles); the log-error and within-2× gains are not.

**Radar-5 fresh check (seed base 987654321, same fresh folds as the radar-4 round):** radar-4 85.5% / 0.552 / 0.369 / 31.4% vs radar-5 86.0% / 0.505 / 0.365 / 31.6% — the median log error improves by 0.047 in 10/10 reshuffles, within-2× by +0.2pp, Spearman unchanged within noise. The reference-TVL shrinkage alone (n/(n+2), multiple blend kept at n/(n+30)) is 0.508 / 31.0% on the same fresh folds, so the two changes stack: the reference shrink is the driver, the blend at n/(n+10) adds a little more on top. Radar-5 trades one point of median percentage error (86.2% → 87.1% on the tuning folds) for the log-error gain; the log error is the headline the board is ranked on, and the within-2× share does not fall.

**Farm plan** — 7 steps per protocol, derived from its own record: category decides the action, TVL decides the capital ($50–$250), age decides the hold (30–60 days). First step is wallet hygiene, last is claim safety.

## Numbers (snapshot 2026-11-14)

- 758 protocols in the snapshot; 40 on the watchlist; 342 record no token
- Board: **197 rows** (40 watchlist + 157 found below the $50M floor), all 40 watchlist slugs covered
- Total implied value: **$2,059,766,725**; top launch Sentora Curator $188.0M (radar-4: Veda $230.8M); last row Nucleus $1,754,639
- Fitted size slope −0.60 (the grid floor); global geometric-mean multiple 0.232x (radar-3: median 0.246x)
- All 197 implied values are distinct; every farm plan is 7 steps of 99–209 characters
- Live-token view: top 50 live protocols + a 33-category multiples table (blend weight and typical TVL per category)
- Dashboard source: 38,411 bytes total (dossier text 38,671 bytes, cap 65,536); dossier 744,507 bytes (cap 1.5 MiB); no `http` references anywhere in it

## How to run

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <path-to-snapshot.json>
```

Node 24.22.1 was used here (requirement: ≥ 22.18). The sealed snapshot lives in the kit at `../kit/token-radar-01-kit/input/snapshot.json` and is **not** copied into this repo — the grader mounts its own `/input/snapshot.json`.

## Screenshots

No browser was installed on this machine, so Chromium Headless Shell 140 was installed via Playwright (`~/.cache/ms-playwright/chromium_headless_shell-1187`, `npm i playwright-core` in `/tmp/pw2`, script `/tmp/pw2/verify-r5.mjs`). All three were taken at 1440×900 against `out/dashboard/index.html`:

- `1-board.png` (170 KB) — the board, 197 rows
- `2-detail.png` (208 KB) — detail view of rank #1 Sentora Curator, scrolled so the model arithmetic and farm plan are visible
- `3-filtered.png` (138 KB) — the board filtered to category Dexs (21 rows)

Deep links used: `#protocol=sentora-curator` and `#category=Dexs` (the dashboard also supports `#tab=live|model` and `#chain=<name>`).

## Verification done

- `main.ts` runs clean; two runs produce byte-identical output (including `dossier.json`)
- Every one of the 197 implied values was independently recomputed from the snapshot with a separate script — 0 mismatches (independent fit: slope −0.60, global multiple 0.2317x; the multiples table's 33 categories also match, 0 mismatches)
- Dossier rebuilt independently with `buildDossier` — byte-for-byte identical to the written `dossier.json` (744,507 bytes; text 38,671 of 65,536 allowed)
- Headless-browser checks (all passed): board renders 197 rows; detail farm steps match board.json; page recomputation matches board.json ("Page recomputes $188.0M — matches board.json." for rank #1 Sentora Curator); detail provenance line present; Dexs filter shows 21 rows; live tab renders 50 rows; model tab explains the formula and shows the CV table (radar-5 row: 0.49 / 31% / 0.36); the sandbox sliders re-rank the board live; 0 console errors, 0 external network requests
- Screenshots retaken against the radar-5 board (1-board, 2-detail of Sentora Curator, 3-filtered Dexs) and verified visually; the board's new #1 is Sentora Curator ($188.0M), Veda is now #4 ($53.5M)
- `out/` is local build output, gitignored, not part of the entry

## What remains for resubmission (parent's job, not this session's)

1. Bundle the transcripts of the sessions that built radar-5 (`transcripts.tar.gz`) — the transcript gate counts the sessions that wrote this revision.
2. Run the pre-submit check from the kit directory: `node cli/makefun.mjs check --kit . --repo <your repository> --transcripts transcripts.tar.gz`, then submit: `node cli/makefun.mjs submit --competition token-radar-01 --repo-url <url> --commit <sha> --title <name> --bundle <file> --keypair <file>`.
3. At most 5 submissions a day, 10 in all; the last submission before Mon 14 Dec 2026 10:00 UTC is the final entry. Radar-4's submission (01a1e39d) stays the entry until radar-5 is submitted.
