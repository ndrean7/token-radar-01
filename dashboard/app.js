// Token Radar's dashboard. It reads window.RADAR (written beside dashboard/ by main.ts) and
// renders the ranked board, a filterable table, a per-protocol detail view with the model's own
// inputs and the protocol's farm plan, the live-token set the board keeps apart, and the model
// itself. No network: every byte it shows is in data.js. The farm plans are embedded in the
// data, so the page and board.json can never disagree about them; the implied value is
// recomputed here from the same figures and checked against the board's number.
(function () {
  'use strict';

  var DATA = window.RADAR;
  var app = document.getElementById('app');
  if (!DATA || !app) return;
  app.setAttribute('aria-busy', 'false');

  var M = DATA.model;
  var state = { q: '', category: 'all', chain: 'all', watchOnly: false, sort: 'implied', tab: 'board', selected: null,
    sandbox: { on: false, gw: M.growth_weight, se: DATA.size_slope } };

  // Deep links for screenshots and sharing: #protocol=<slug>, #category=<name>, #tab=live|model.
  function parseHash() {
    var h = (location.hash || '').replace(/^#/, '');
    if (!h) return;
    var parts = h.split('&');
    for (var i = 0; i < parts.length; i++) {
      var kv = parts[i].split('=');
      var k = decodeURIComponent(kv[0] || ''), v = decodeURIComponent(kv[1] || '');
      if (k === 'protocol' && v) state.selected = v;
      if (k === 'category' && v) state.category = v;
      if (k === 'chain' && v) state.chain = v;
      if (k === 'tab' && (v === 'live' || v === 'model')) state.tab = v;
    }
  }
  parseHash();
  // A hash change (back/forward, or a screenshot URL loaded onto the same page) re-applies
  // the deep link. Row clicks use replaceState, which does not fire this.
  window.addEventListener('hashchange', function () {
    state.selected = null; state.category = 'all'; state.chain = 'all';
    parseHash();
    render();
  });

  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd0.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtDate(iso) { return iso || 'unknown'; }

  // The model in one function: the page recomputes a row from the snapshot figures and checks
  // the number board.json carries, so the page's code and the board's data are visibly the
  // same arithmetic. The sandbox sliders only change the growth weight and the size elasticity.
  function modelOf(row) {
    var gw = state.sandbox.on ? state.sandbox.gw : M.growth_weight;
    var se = state.sandbox.on ? state.sandbox.se : DATA.size_slope;
    var growth = Math.min(M.growth_cap, Math.max(M.growth_floor, row.change_7d === null ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * gw;
    var sizeMult = Math.pow(row.tvl_usd / row.size_reference_tvl, se);
    sizeMult = Math.min(Math.max(sizeMult, M.size_clamp_low), M.size_clamp_high);
    var age = row.age_days === null ? M.unknown_age_days : row.age_days;
    var maturity = M.maturity_floor + (Math.min(Math.max(age, 0), M.maturity_days) / M.maturity_days) * M.maturity_range;
    var base = row.tvl_usd * row.category_multiple;
    var implied = Math.max(1, Math.round(base * sizeMult * growthMult * maturity));
    return { base: base, growthPct: growth, growthMult: growthMult, sizeMult: sizeMult, maturityMult: maturity, implied: implied };
  }
  function shownImplied(row) { return state.sandbox.on ? modelOf(row).implied : row.implied_value_usd; }

  function categories() {
    var seen = {}, out = [];
    DATA.rows.forEach(function (r) { var c = r.category || 'Unknown'; if (!seen[c]) { seen[c] = 1; out.push(c); } });
    return out.sort();
  }
  function chains() {
    var seen = {}, out = [];
    DATA.rows.forEach(function (r) { r.chains.forEach(function (c) { if (!seen[c]) { seen[c] = 1; out.push(c); } }); });
    return out.sort();
  }

  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    var rows = DATA.rows.filter(function (r) {
      if (state.watchOnly && !r.watchlist) return false;
      if (state.category !== 'all' && (r.category || 'Unknown') !== state.category) return false;
      if (state.chain !== 'all' && r.chains.indexOf(state.chain) < 0) return false;
      if (q && (r.name + ' ' + r.slug + ' ' + (r.category || '')).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var key = state.sort;
    rows.sort(function (a, b) {
      if (key === 'tvl') return b.tvl_usd - a.tvl_usd;
      if (key === 'change') return (b.change_7d === null ? -Infinity : b.change_7d) - (a.change_7d === null ? -Infinity : a.change_7d);
      if (key === 'age') return (b.age_days === null ? -1 : b.age_days) - (a.age_days === null ? -1 : a.age_days);
      return shownImplied(b) - shownImplied(a);
    });
    return rows;
  }

  function rowHtml(r) {
    var imp = shownImplied(r);
    var chg = r.change_7d;
    var chgCls = chg === null ? '' : (chg >= 0 ? 'pos' : 'neg');
    var sel = state.selected === r.slug ? ' class="selected"' : '';
    return '<tr data-slug="' + esc(r.slug) + '"' + sel + '>' +
      '<td class="r num">' + r.rank + '</td>' +
      '<td class="name"><b>' + esc(r.name) + '</b>' + (r.watchlist ? '<span class="badge watch">WATCHLIST</span>' : '') +
      '<span class="slug">' + esc(r.slug) + '</span></td>' +
      '<td>' + esc(r.category || 'Unknown') + '</td>' +
      '<td>' + esc(r.chains.slice(0, 3).join(', ')) + (r.chains.length > 3 ? ' +' + (r.chains.length - 3) : '') + '</td>' +
      '<td class="r num">' + fmtUsd(r.tvl_usd) + '</td>' +
      '<td class="r num ' + chgCls + '">' + fmtPct(chg) + '</td>' +
      '<td class="r num">' + fmtAge(r.age_days) + '</td>' +
      '<td class="r num implied">' + fmtUsd(imp) + (state.sandbox.on ? ' *' : '') + '</td></tr>';
  }

  function detailHtml(r) {
    if (!r) return '<div class="placeholder"><b>Select a protocol</b><br>Click any row in the board to see its metrics, the model&rsquo;s arithmetic and its seven-step farm plan.</div>';
    var m = modelOf(r);
    var match = m.implied === r.implied_value_usd;
    var steps = r.farm_steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');
    return '<div class="head"><div class="muted small">Rank #' + r.rank + ' &middot; ' + esc(r.category || 'Unknown') +
      (r.watchlist ? ' &middot; <span class="badge watch">WATCHLIST</span>' : '') + '</div>' +
      '<h2>' + esc(r.name) + '</h2><div class="muted small">' + esc(r.chains.join(', ')) +
      ' &middot; listed ' + fmtDate(r.listed_at) + '</div></div>' +
      '<div class="body"><div class="metrics">' +
      '<div class="metric"><div class="label">TVL</div><div class="value num">' + fmtUsd(r.tvl_usd) + '</div></div>' +
      '<div class="metric"><div class="label">Implied value</div><div class="value num" style="color:var(--accent)">' + fmtUsd(r.implied_value_usd) + '</div></div>' +
      '<div class="metric"><div class="label">7-day change</div><div class="value num ' + (r.change_7d === null ? '' : (r.change_7d >= 0 ? 'pos' : 'neg')) + '">' + fmtPct(r.change_7d) + '</div></div>' +
      '<div class="metric"><div class="label">Age</div><div class="value num">' + fmtAge(r.age_days) + '</div></div>' +
      '<div class="metric"><div class="label">Category multiple</div><div class="value num">' + r.category_multiple.toFixed(3) + 'x</div></div>' +
      '<div class="metric"><div class="label">Size adjustment</div><div class="value num">&times;' + m.sizeMult.toFixed(2) + '</div></div>' +
      '</div>' +
      '<div class="math"><h3>How the value is built</h3>' +
      '<div class="row"><span>Base &mdash; TVL &times; ' + r.category_multiple.toFixed(3) + 'x</span><span class="num">' + fmtUsd(m.base) + '</span></div>' +
      '<div class="row"><span>&times; Size (TVL ' + fmtUsd(r.tvl_usd) + ' vs typical ' + fmtUsd(r.size_reference_tvl) + ')</span><span class="num">&times;' + m.sizeMult.toFixed(2) + '</span></div>' +
      '<div class="row"><span>&times; Growth (' + fmtPct(m.growthPct) + ' &times; ' + (state.sandbox.on ? state.sandbox.gw : M.growth_weight) + ')</span><span class="num">&times;' + m.growthMult.toFixed(2) + '</span></div>' +
      '<div class="row"><span>&times; Maturity (' + fmtAge(r.age_days) + ')</span><span class="num">&times;' + m.maturityMult.toFixed(2) + '</span></div>' +
      '<div class="row total"><span>Implied launch value</span><span class="v num">' + fmtUsd(m.implied) + '</span></div>' +
      (state.sandbox.on
        ? '<div class="check">Sandbox values &mdash; board.json keeps the published model.</div>'
        : (match ? '<div class="check">Page recomputes ' + fmtUsd(m.implied) + ' &mdash; matches board.json.</div>'
          : '<div class="check" style="color:var(--amber)">Page recomputes ' + fmtUsd(m.implied) + ' &mdash; board.json says ' + fmtUsd(r.implied_value_usd) + '.</div>')) +
      '</div>' +
      '<div class="farm"><h3>Farm plan &mdash; 7 steps</h3><ol>' + steps + '</ol></div>' +
      '<p class="note">Records no token in the sealed snapshot: no market cap, no CoinGecko id, no symbol. ' +
      'Implied value is a model estimate from the snapshot, not a price and not a promise of a launch.</p></div>';
  }

  function boardTab() {
    var rows = filteredRows();
    var cats = categories().map(function (c) { return '<option value="' + esc(c) + '"' + (state.category === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('');
    var chs = chains().map(function (c) { return '<option value="' + esc(c) + '"' + (state.chain === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('');
    var sel = null;
    if (state.selected) { for (var i = 0; i < DATA.rows.length; i++) if (DATA.rows[i].slug === state.selected) sel = DATA.rows[i]; }
    return '<div class="controls">' +
      '<input type="search" id="q" placeholder="Search name, slug or category&hellip;" value="' + esc(state.q) + '" aria-label="Search protocols">' +
      '<select id="fcat" aria-label="Filter by category"><option value="all">All categories</option>' + cats + '</select>' +
      '<select id="fchain" aria-label="Filter by chain"><option value="all">All chains</option>' + chs + '</select>' +
      '<label class="check"><input type="checkbox" id="fwatch"' + (state.watchOnly ? ' checked' : '') + '> Watchlist only</label>' +
      '<select id="fsort" aria-label="Sort by"><option value="implied"' + (state.sort === 'implied' ? ' selected' : '') + '>Sort: implied value</option>' +
      '<option value="tvl"' + (state.sort === 'tvl' ? ' selected' : '') + '>Sort: TVL</option>' +
      '<option value="change"' + (state.sort === 'change' ? ' selected' : '') + '>Sort: 7-day change</option>' +
      '<option value="age"' + (state.sort === 'age' ? ' selected' : '') + '>Sort: age</option></select></div>' +
      '<p class="resultline">' + rows.length + ' of ' + DATA.board_size + ' protocols' +
      (state.watchOnly ? ' &middot; watchlist only' : '') + (state.category !== 'all' ? ' &middot; ' + esc(state.category) : '') +
      (state.chain !== 'all' ? ' &middot; ' + esc(state.chain) : '') + (state.q ? ' &middot; matching &ldquo;' + esc(state.q) + '&rdquo;' : '') +
      ' &middot; click a row for its detail and farm plan.</p>' +
      '<details class="sandbox" id="sandbox"><summary>Model sandbox &mdash; try different weights</summary>' +
      '<div class="sliders"><div><label>Growth weight: <span class="val" id="gwval">' + state.sandbox.gw.toFixed(2) + '</span></label>' +
      '<input type="range" id="gw" min="0" max="1" step="0.05" value="' + state.sandbox.gw + '"></div>' +
      '<div><label>Size elasticity: <span class="val" id="seval">' + state.sandbox.se.toFixed(2) + '</span></label>' +
      '<input type="range" id="se" min="-0.6" max="0" step="0.05" value="' + state.sandbox.se + '"></div></div>' +
      '<p>Moving a slider turns the sandbox on: the board re-ranks with your weights and sandbox values are marked *. ' +
      'board.json always keeps the published model (growth weight ' + M.growth_weight + ', size elasticity ' + DATA.size_slope + ').</p></details>' +
      '<div class="board-wrap"><div class="panel"><div class="table-scroll"><table>' +
      '<thead><tr><th class="r">#</th><th>Protocol</th><th>Category</th><th>Chains</th><th class="r">TVL</th><th class="r">7d</th><th class="r">Age</th><th class="r">Implied value' + (state.sandbox.on ? ' *' : '') + '</th></tr></thead>' +
      '<tbody id="rows">' + (rows.length ? rows.map(rowHtml).join('') : '<tr><td colspan="8"><div class="empty">No protocol matches these filters.</div></td></tr>') + '</tbody>' +
      '</table></div></div>' +
      '<aside class="detail" id="detail" aria-live="polite">' + detailHtml(sel) + '</aside></div>';
  }

  function liveTab() {
    var live = DATA.live.map(function (p, i) {
      var ratio = (p.mcap_usd !== null && p.tvl_usd > 0) ? (p.mcap_usd / p.tvl_usd).toFixed(2) + 'x' : 'n/a';
      return '<tr><td class="r num">' + (i + 1) + '</td><td class="name"><b>' + esc(p.name) + '</b><span class="slug">' + esc(p.slug) + '</span></td>' +
        '<td>' + esc(p.category || 'Unknown') + '</td><td class="r num">' + fmtUsd(p.tvl_usd) + '</td>' +
        '<td class="r num">' + fmtUsd(p.mcap_usd) + '</td><td class="r num">' + ratio + '</td></tr>';
    }).join('');
    var mult = DATA.multiples.map(function (m) {
      var w = m.category_weight;
      var src = w <= 0 ? 'Global median &mdash; no live protocol in this category'
        : Math.round(w * 100) + '% own median &middot; ' + Math.round((1 - w) * 100) + '% global';
      return '<tr><td>' + esc(m.category) + '</td><td class="r num">' + m.live_count + '</td>' +
        '<td class="r num">' + m.multiple.toFixed(2) + 'x</td><td class="r num">' + fmtUsd(m.ref_tvl_usd) + '</td><td>' + src + '</td></tr>';
    }).join('');
    return '<div class="grid2"><div class="panel"><h2>Already trading &mdash; the market&rsquo;s own values</h2>' +
      '<div class="table-scroll"><table><thead><tr><th class="r">#</th><th>Protocol</th><th>Category</th><th class="r">TVL</th><th class="r">Market cap</th><th class="r">mcap / TVL</th></tr></thead>' +
      '<tbody>' + live + '</tbody></table></div></div>' +
      '<div class="panel"><h2>Where each category&rsquo;s multiple comes from</h2>' +
      '<div class="table-scroll"><table><thead><tr><th>Category</th><th class="r">Live</th><th class="r">Multiple</th><th class="r">Typical TVL</th><th>Source</th></tr></thead>' +
      '<tbody>' + mult + '</tbody></table></div>' +
      '<p class="small muted" style="padding:12px 16px">The board never ranks these protocols: their tokens already trade, ' +
      'so the snapshot&rsquo;s market cap is their value. Each category&rsquo;s multiple blends its own live protocols&rsquo; median mcap/TVL with the global median, weighted by how many live protocols it has &mdash; and each protocol&rsquo;s own multiple is then adjusted for its size against the category&rsquo;s typical TVL. The model is calibrated by the snapshot itself, not by a hand-picked number.</p></div></div>';
  }

  function modelTab() {
    return '<article class="prose"><h2>How the radar works</h2>' +
      '<p>Token Radar reads one sealed snapshot of every protocol DefiLlama tracks (' + DATA.total_protocols +
      ' protocols, ' + DATA.as_of + ') and asks one question: which of them still record no token, and what ' +
      'would a launch be worth if the market priced it like the protocols that already trade?</p>' +
      '<h3>1 &middot; Who counts as pre-token</h3>' +
      '<p>A protocol counts when its snapshot entry records no token at all &mdash; market cap, CoinGecko id and ' +
      'symbol are all null &mdash; and it is not a wrapped or staked product of one that trades. That means the ' +
      'category is not Bridge, Canonical Bridge, Cross Chain Bridge, Liquid Staking, Liquid Restaking, Restaked BTC ' +
      'or CEX, the name has no whole word <code>wrapped</code>, <code>staked</code> or <code>staking</code>, does not end in a ' +
      'version marker (<code>V2</code>, <code>v3</code>, <code>2.0</code>) and does not begin with a centralised-exchange brand. ' +
      'This is the sealed watchlist&rsquo;s own rule, applied to every protocol rather than only to the ' + DATA.watchlist_size +
      ' above the $50M floor. The board carries all ' + DATA.watchlist_size + ' watchlist protocols plus ' + DATA.early_size +
      ' more that pass the same rule &mdash; ' + DATA.board_size + ' rows in all.</p>' +
      '<h3>2 &middot; The value model (radar-3)</h3>' +
      '<div class="formula">implied = TVL x category_multiple\n        x (TVL / typical_TVL) ^ ' + DATA.size_slope.toFixed(2) + '\n        x (1 + clamp(change_7d, -50, 100) / 100 x 0.25)\n        x (0.90 + min(age_days, 1460) / 1460 x 0.10)</div>' +
      '<p><b>category_multiple</b> blends the category&rsquo;s own median market-cap-to-TVL ratio with the global median ' + DATA.global_multiple.toFixed(2) + 'x, weighted by how many live protocols the category has (n out of n+5); a category with no live protocol takes the global median outright. Every multiple is clamped to ' + M.multiple_floor + '&ndash;' + M.multiple_cap +
      'x. <b>Size</b> is the market&rsquo;s own slope: within a category, a bigger protocol trades at a lower multiple of its TVL (fitted slope ' + DATA.size_slope.toFixed(2) + '), so each protocol&rsquo;s multiple is adjusted against its category&rsquo;s typical TVL and clamped to &times;' + M.size_clamp_low + '&ndash;&times;' + M.size_clamp_high +
      '. <b>Growth</b> keeps only a small tilt: on the live set, a week&rsquo;s TVL change carries almost no signal for the multiple, so one wild week cannot dominate. <b>Maturity</b> keeps only a gentle tilt for the wait &mdash; age carries almost no signal either, and the chain count carries none at all, so there is no chain bonus. No protocol name is special-cased: the same function scores every row, and this page recomputes every value from the same figures.</p>' +
      '<p><b>How it was checked.</b> The model&rsquo;s job is to price a token that does not exist yet, and the snapshot carries 119 live-token protocols whose market caps are known &mdash; so the model was tested against them: split into five folds, fitted on four, asked to price the fifth, reshuffled ten times. It lands within 2&times; of the true market cap 29% of the time, against 24% for a flat category median, with a median log error of 0.60 against 0.72. The check is in the open: every number above is read out of this snapshot, not chosen by hand.</p>' +
      '<h3>3 &middot; The farm plan</h3>' +
      '<p>Every row carries seven steps, derived from the protocol&rsquo;s own record &mdash; its category decides the ' +
      'action, its TVL decides the capital ($50&ndash;$250), its age decides how long to hold (30&ndash;60 days). The first ' +
      'step is wallet hygiene, the last is claim safety: claim only from the link the protocol itself publishes, ' +
      'never pay to claim, and keep a farm log. Nothing here is a promise: a protocol can run for years without ' +
      'launching a token, and an implied value is a model estimate, not a price.</p>' +
      '<h3>4 &middot; What the board is not</h3>' +
      '<p>It is not financial advice, and it does not track live prices &mdash; the snapshot is sealed at ' + DATA.as_of +
      '. Live-token protocols are shown separately, with the market&rsquo;s own values, and never ranked against ' +
      'pre-token ones. Say a protocol &ldquo;records no token&rdquo;, never that it &ldquo;has none&rdquo;: the snapshot is the ' +
      'only evidence this radar uses.</p></article>';
  }

  function render() {
    var total = fmtUsd(DATA.total_implied_usd);
    var top = DATA.rows[0];
    var html = '<header class="hero"><div class="eyebrow">DefiLlama snapshot &middot; ' + esc(DATA.as_of) + ' &middot; model radar-3</div>' +
      '<h1>Token Radar<span class="dot">.</span></h1>' +
      '<p class="sub">Every protocol that still records no token, ranked by what its launch would be worth &mdash; ' +
      'priced by the market&rsquo;s own multiples, not by a hand-picked number.</p>' +
      '<div class="stats">' +
      '<div class="stat"><div class="label">Protocols tracked</div><div class="value">' + DATA.total_protocols.toLocaleString('en-US') + '</div><div class="note">in the sealed snapshot</div></div>' +
      '<div class="stat"><div class="label">Watchlist</div><div class="value">' + DATA.watchlist_size + '</div><div class="note">TVL &ge; $50M, no token</div></div>' +
      '<div class="stat"><div class="label">Board rows</div><div class="value">' + DATA.board_size + '</div><div class="note">' + DATA.early_size + ' found below the floor</div></div>' +
      '<div class="stat"><div class="label">Total implied value</div><div class="value accent">' + total + '</div><div class="note">across the whole board</div></div>' +
      '<div class="stat"><div class="label">Top launch</div><div class="value">' + fmtUsd(top ? top.implied_value_usd : 0) + '</div><div class="note">' + esc(top ? top.name : '') + '</div></div>' +
      '</div></header>' +
      '<nav class="tabs" role="tablist">' +
      '<button class="tab" role="tab" data-tab="board" aria-selected="' + (state.tab === 'board') + '">Board <span class="count">' + DATA.board_size + '</span></button>' +
      '<button class="tab" role="tab" data-tab="live" aria-selected="' + (state.tab === 'live') + '">Live tokens <span class="count">' + DATA.live_size + '</span></button>' +
      '<button class="tab" role="tab" data-tab="model" aria-selected="' + (state.tab === 'model') + '">How the model works</button>' +
      '</nav>' +
      '<section id="board">' + (state.tab === 'board' ? boardTab() : state.tab === 'live' ? liveTab() : modelTab()) + '</section>' +
      '<footer>Source: ' + esc(DATA.source) + '. Snapshot sealed ' + esc(DATA.as_of) + ' &middot; floor $50M &middot; ' +
      'Model radar-3 &middot; Implied values are estimates from the snapshot, not prices and not financial advice.</footer>';
    app.innerHTML = html;
    bind();
  }

  function bind() {
    var tabs = app.querySelectorAll('.tab');
    for (var i = 0; i < tabs.length; i++) tabs[i].addEventListener('click', function (e) {
      state.tab = e.currentTarget.getAttribute('data-tab'); render();
    });
    var q = document.getElementById('q');
    if (q) q.addEventListener('input', function (e) { state.q = e.target.value; renderBoardOnly(); });
    var fc = document.getElementById('fcat');
    if (fc) fc.addEventListener('change', function (e) { state.category = e.target.value; render(); });
    var fch = document.getElementById('fchain');
    if (fch) fch.addEventListener('change', function (e) { state.chain = e.target.value; render(); });
    var fw = document.getElementById('fwatch');
    if (fw) fw.addEventListener('change', function (e) { state.watchOnly = e.target.checked; render(); });
    var fs = document.getElementById('fsort');
    if (fs) fs.addEventListener('change', function (e) { state.sort = e.target.value; render(); });
    var gw = document.getElementById('gw');
    if (gw) gw.addEventListener('input', function (e) {
      state.sandbox.on = true; state.sandbox.gw = parseFloat(e.target.value);
      var v = document.getElementById('gwval'); if (v) v.textContent = state.sandbox.gw.toFixed(2);
      renderBoardOnly();
    });
    var se = document.getElementById('se');
    if (se) se.addEventListener('input', function (e) {
      state.sandbox.on = true; state.sandbox.se = parseFloat(e.target.value);
      var v = document.getElementById('seval'); if (v) v.textContent = state.sandbox.se.toFixed(2);
      renderBoardOnly();
    });
    var rows = app.querySelectorAll('#rows tr[data-slug]');
    for (var j = 0; j < rows.length; j++) rows[j].addEventListener('click', function (e) {
      state.selected = e.currentTarget.getAttribute('data-slug');
      try { history.replaceState(null, '', '#protocol=' + encodeURIComponent(state.selected)); } catch (err) {}
      render();
      var d = document.getElementById('detail');
      if (d) d.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  // Re-render only the table body and the detail panel while typing or sliding, so the
  // search box and the sliders keep focus.
  function renderBoardOnly() {
    if (state.tab !== 'board') { render(); return; }
    var rows = filteredRows();
    var tbody = document.getElementById('rows');
    if (tbody) tbody.innerHTML = rows.length ? rows.map(rowHtml).join('') : '<tr><td colspan="8"><div class="empty">No protocol matches these filters.</div></td></tr>';
    var sel = null;
    if (state.selected) { for (var i = 0; i < DATA.rows.length; i++) if (DATA.rows[i].slug === state.selected) sel = DATA.rows[i]; }
    var detail = document.getElementById('detail');
    if (detail) detail.innerHTML = detailHtml(sel);
    var trs = app.querySelectorAll('#rows tr[data-slug]');
    for (var j = 0; j < trs.length; j++) trs[j].addEventListener('click', function (e) {
      state.selected = e.currentTarget.getAttribute('data-slug');
      try { history.replaceState(null, '', '#protocol=' + encodeURIComponent(state.selected)); } catch (err) {}
      render();
    });
    var line = document.querySelector('.resultline');
    if (line) line.textContent = rows.length + ' of ' + DATA.board_size + ' protocols — click a row for its detail and farm plan.';
  }

  render();
})();
