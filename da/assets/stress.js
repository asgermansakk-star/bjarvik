// Bjarvik · stress test for the fictional portfolio: eight real crashes, hidden risks and fixes.
// Runs in the browser on assets/stressdata.js (built by skabeloner/py/stresstest_data.py); nothing is sent anywhere.
(function () {
  const root = document.getElementById('st'); if (!root || !window.BjarvikPF) return;
  const IDX = window.VANTA_INDEX || [], P = window.VANTA_P || [], PF = window.BjarvikPF;
  const ver = ((document.currentScript && document.currentScript.src.match(/\?v=(\w+)/)) || [])[1] || '';
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pct = (v, d = 0) => (v * 100).toFixed(d) + '%';
  const spct = (v, d = 0) => (v > 0.0005 ? '+' : v < -0.0005 ? '−' : '') + Math.abs(v * 100).toFixed(d) + '%';
  const dkk = v => Math.round(v).toLocaleString('en-GB') + ' DKK';
  const band = v => v >= 70 ? 'hi' : v >= 50 ? 'mid' : 'lo';
  const S = new Map();
  IDX.forEach((r, i) => { const p = P[i] || []; S.set(r[1], { name: r[0], slug: r[1], score: r[2], ind: r[3], ctry: r[4], penny: !!r[5], fpe: p[7], na: ['USD', 'CAD'].includes(String(p[9] || '').toUpperCase()) }); });

  let D = null, sel = -1, last = null, pending = null;
  // filters for the suggestions: what may come in, which changes are allowed, and what the visitor said no to
  const NORDIC = ['Danmark', 'Sverige', 'Norge', 'Finland'], NA = ['USA', 'Canada'], APAC = ['Japan', 'Australien', 'Sydkorea'];
  const region = c => NORDIC.includes(c) ? 'Norden' : NA.includes(c) ? 'Nordamerika' : APAC.includes(c) ? 'Asia-Pacific' : 'Resten af Europa';
  const FKEY = 'bjarvik-stress-filters';
  let F = { reg: '', min: 70, pe: '', swap: true, add: true, share: true, keep: [], no: [] };
  try { F = Object.assign(F, JSON.parse(localStorage.getItem(FKEY) || '{}')); } catch (e) { /* storage off */ }
  const saveF = () => { try { localStorage.setItem(FKEY, JSON.stringify(F)); } catch (e) { /* storage off */ } };
  const allowed = a => a && F[a.t] && !F.keep.includes(a.t === 'swap' ? a.a : a.slug) && !(a.b && F.no.includes(a.b)) && !(a.t === 'add' && F.no.includes(a.slug));
  const data = s => D && D.s[s.name];
  const ok = s => { const d = data(s); return d && d[4].length; };

  // ---------- numbers ----------
  function corr(a, b) {
    let n = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
    for (let i = 0; i < a.length && i < b.length; i++) {
      const x = a[i], y = b[i]; if (x === null || y === null) continue;
      n++; sa += x; sb += y; saa += x * x; sbb += y * y; sab += x * y;
    }
    if (n < 26) return null;
    const v = (n * saa - sa * sa) * (n * sbb - sb * sb);
    return v > 0 ? (n * sab - sa * sb) / Math.sqrt(v) : null;
  }
  const RHO = new Map();
  const rho = (a, b) => {
    const k = a.slug < b.slug ? a.slug + '|' + b.slug : b.slug + '|' + a.slug;
    if (!RHO.has(k)) { const r = ok(a) && ok(b) ? corr(data(a)[4], data(b)[4]) : null; RHO.set(k, r === null ? 0.35 : r); }
    return RHO.get(k);
  };
  function measure(H) {
    const n = H.length, scen = D.scen.map((sc, i) => {
      let loss = 0, mkt = 0, est = 0; const parts = [];
      H.forEach(x => { const d = data(x.s), r = d ? d[2][i] : (sc.stoxx ?? sc.spx), e = !d || (d[3] >> i & 1);
        loss += x.w * r; mkt += x.w * (x.s.na || sc.stoxx === null ? sc.spx : sc.stoxx); if (e) est += x.w; parts.push({ x, r, c: x.w * r, e }); });
      return { sc, loss, mkt, est, parts: parts.sort((a, b) => a.c - b.c) };
    });
    const vol = x => (data(x.s) && data(x.s)[1]) || 0.35, beta = H.reduce((a, x) => a + x.w * ((data(x.s) && data(x.s)[0]) || 1), 0);
    let varp = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) varp += H[i].w * H[j].w * vol(H[i]) * vol(H[j]) * (i === j ? 1 : rho(H[i].s, H[j].s));
    const sd = Math.sqrt(Math.max(varp, 1e-9)), bets = Math.pow(H.reduce((a, x) => a + x.w * vol(x), 0), 2) / (sd * sd);
    const worst = scen.reduce((a, b) => b.loss < a.loss ? b : a, scen[0]);
    return { scen, beta, sd, bets: Math.min(n, bets), worst };
  }
  // the best stock to bring in instead: score 70+, not a penny stock, low correlation with what stays, holds up in the crash
  let taken = new Set();  // a stock already offered in one risk is not offered again in the next
  function candidate(H, out, i, why) {
    const stay = H.filter(x => x !== out), have = new Set(H.map(x => x.s.slug));
    let best = null;
    for (const s of S.values()) {
      if (have.has(s.slug) || taken.has(s.slug) || s.penny || s.score < Math.max(+F.min, out ? Math.min(85, out.s.score - 10) : 70) || !ok(s)) continue;
      if ((F.reg && region(s.ctry) !== F.reg) || (F.pe && !(s.fpe > 0 && s.fpe <= +F.pe)) || F.no.includes(s.slug)) continue;
      const d = data(s); if (d[3] >> i & 1) continue;
      if (why === 'cheap' && !(s.fpe > 0 && s.fpe < 25)) continue;
      if (why === 'calm' && !(d[0] && d[0] < 1)) continue;
      const mc = stay.reduce((a, x) => Math.max(a, rho(s, x.s)), 0); if (mc > 0.5) continue;
      const crash = d[2][i], avg = d[2].reduce((a, v) => a + v, 0) / d[2].length;
      if (why !== 'loose' && out && data(out.s) && crash <= data(out.s)[2][i]) continue;
      const v = s.score / 100 + Math.min(0, crash) + Math.min(0, avg) * 0.5 - mc * 0.3;  // gains do not count extra: holding up is enough
      if (!best || v > best.v) best = { s, v, crash, mc };
    }
    if (best) taken.add(best.s.slug);
    return best;
  }

  // ---------- hidden risks with a fix each ----------
  function risks(H, M) {
    const R = [], n = H.length, W = M.worst, i = M.scen.indexOf(W);
    taken = new Set();
    const swap = (out, c, j = i) => c && { label: `Swap ${out.s.name} for ${c.s.name}`, text: `${c.s.name} scores ${c.s.score} and moved ${spct(c.crash)} in the ${D.scen[j].name}.`, act: { t: 'swap', a: out.s.slug, b: c.s.slug } };
    const share = (x, f, label, text = '') => ({ label, text, act: { t: 'share', slug: x.s.slug, f } });
    // twins: holdings that move as one
    const parent = H.map((_, k) => k), find = k => parent[k] === k ? k : (parent[k] = find(parent[k]));
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) if (ok(H[a].s) && ok(H[b].s) && rho(H[a].s, H[b].s) > 0.7) parent[find(a)] = find(b);
    const groups = {}; H.forEach((x, k) => (groups[find(k)] = groups[find(k)] || []).push(x));
    Object.values(groups).filter(g => g.length > 1).sort((a, b) => b.reduce((s, x) => s + x.w, 0) - a.reduce((s, x) => s + x.w, 0)).slice(0, 2).forEach(g => {
      const w = g.reduce((s, x) => s + x.w, 0); if (w < 0.15) return;
      const names = g.slice(0, 4).map(x => x.s.name), gb = g.filter(x => x.w >= 0.04), out = (gb.length ? gb : g).slice().sort((a, b) => a.s.score - b.s.score)[0];
      R.push({ lvl: 'warn', t: `${names.length > 3 ? names.slice(0, 3).join(', ') + ' og flere' : names.join(' og ').replace(/ and (?=.* and )/g, ', ')} move as one`,
        why: `Their weekly prices moved almost in step this past year, so together they are one ${pct(w)} bet.`,
        fix: swap(out, candidate(H, out, i)) || swap(out, candidate(H, out, i, 'loose')) || (out.w >= 0.04 && share(out, out.w / 2, `Halve ${out.s.name}`, 'Den har den laveste score i gruppen.')) });
    });
    // falls harder than the market
    if (W.loss < W.mkt - 0.08 && W.loss < -0.25) {
      const drag = W.parts[0], c = candidate(H, drag.x, i);
      R.push({ lvl: 'warn', t: `Falls harder than the market`, why: `In the ${W.sc.name} it would have lost ${pct(-W.loss)}, against ${pct(-W.mkt)} for the market. ${drag.x.s.name} pulled hardest at ${drag.e ? '≈' : ''}${spct(drag.r)}.`, fix: swap(drag.x, c) });
    } else if (M.beta > 1.25) {
      // the holding that adds the most swing (weight × beta), among those big enough to matter
      const bw = x => x.w * (((data(x.s) || [1])[0]) || 1), big = H.filter(x => x.w >= 0.04), hi = (big.length ? big : H).slice().sort((a, b) => bw(b) - bw(a))[0];
      R.push({ lvl: 'warn', t: `Swings ${M.beta.toFixed(1)} times the market`, why: `When markets drop 10%, this mix has typically dropped about ${(M.beta * 10).toFixed(0)}%. ${hi.s.name} adds the most swing.`,
        fix: swap(hi, candidate(H, hi, i, 'calm')) || (hi.w >= 0.04 && share(hi, hi.w / 2, `Halve ${hi.s.name}`)) });
    }
    // one stock carries the crash
    const lossSum = W.parts.reduce((a, p) => a + Math.min(0, p.c), 0), top = W.parts[0];
    if (n >= 3 && lossSum < 0 && top.c / lossSum > 0.35 && top.x.w > 1 / n + 0.02) {
      R.push({ lvl: 'warn', t: `${top.x.s.name} carries the crash`, why: `It is ${pct(top.x.w)} of the money but ${pct(top.c / lossSum)} of the loss in the ${W.sc.name}.`,
        fix: share(top.x, 1 / n, `Trim ${top.x.s.name} to ${pct(1 / n)}`) });
    }
    // few independent bets
    if (n >= 6 && M.bets < n / 2.5) {
      const c = candidate(H, null, i);
      R.push({ lvl: 'warn', t: `${n} holdings, about ${Math.max(1, Math.round(M.bets))} independent bets`, why: `The holdings rise and fall together, so the spread is smaller than the count suggests.`,
        fix: c && { label: `Add ${c.s.name}`, text: `Score ${c.s.score}, low correlation with your holdings (${c.mc.toFixed(2)}).`, act: { t: 'add', slug: c.s.slug } } });
    }
    // priced for perfection
    const rich = H.filter(x => x.s.fpe > 40), wr = rich.reduce((a, x) => a + x.w, 0);
    if (wr > 0.25) {
      const k0 = D.scen.findIndex(sc => sc.id === 'rates22'), k = k0 < 0 ? i : k0, out = rich.slice().sort((a, b) => b.s.fpe - a.s.fpe)[0];
      R.push({ lvl: 'warn', t: `${pct(wr)} priced above 40× earnings`, why: `Expensive stocks fell the most in the dot-com crash and in 2022. ${out.s.name} trades at ${out.s.fpe > 200 ? 'mere end 200' : out.s.fpe.toFixed(0)}× next year's earnings.`, fix: swap(out, candidate(H, out, k, 'cheap'), k) });
    }
    // numbers that are estimates
    const fresh = H.filter(x => !data(x.s) || [...Array(D.scen.length).keys()].filter(j => data(x.s)[3] >> j & 1).length >= D.scen.length / 2), wf = fresh.reduce((a, x) => a + x.w, 0);
    if (wf > 0.3) R.push({ lvl: 'info', t: `${pct(wf)} has never been through most of these crashes`, why: `${fresh.length > 2 ? fresh.slice(0, 2).map(x => x.s.name).join(', ') + ' og andre' : fresh.map(x => x.s.name).join(' og ')} listed later, so their crash numbers (≈) are estimates from peers.` });
    if (!R.some(r => r.lvl === 'warn')) R.push({ lvl: 'ok', t: 'Ingen skjult risiko skiller sig ud', why: `No cluster of look-alikes, and the worst crash (${pct(-W.loss)}) is in line with the market.` });
    return R;
  }

  // ---------- one suggested change: try the fixes on a copy and keep the ones that help ----------
  function applySim(H, a) {
    if (a.t === 'swap') return H.map(x => x.s.slug === a.a ? { s: S.get(a.b), w: x.w } : x);
    if (a.t === 'add') { const f = 1 / (H.length + 1); return H.map(x => ({ s: x.s, w: x.w * (1 - f) })).concat([{ s: S.get(a.slug), w: f }]); }
    const h = H.find(x => x.s.slug === a.slug), rest = 1 - h.w;
    return H.map(x => ({ s: x.s, w: x === h ? a.f : rest > 0 ? x.w * (1 - a.f) / rest : x.w }));
  }
  function applyReal(a) {
    if (a.t === 'swap') PF.swap(a.a, a.b);
    else if (a.t === 'add') { const n = PF.get().length; PF.add(a.slug); PF.setShare(a.slug, 1 / (n + 1)); }
    else PF.setShare(a.slug, a.f);
  }
  const wscore = H => H.reduce((a, x) => a + x.w * x.s.score, 0);
  const goal = (H, M) => M.worst.loss + 0.02 * M.bets - 0.05 * Math.max(0, M.beta - 1) + 0.003 * (wscore(H) - 70);
  function propose(H, M) {
    let cur = H, cm = M, g = goal(H, M);
    const steps = [], touched = new Set();
    for (let k = 0; k < 4; k++) {
      let done = false;
      for (const r of risks(cur, cm)) {
        const a = r.fix && r.fix.act; if (!allowed(a)) continue;
        const key = a.t === 'swap' ? a.a : a.slug; if (touched.has(key)) continue;
        const next = applySim(cur, a), nm = measure(next), ng = goal(next, nm);
        if (ng > g + 0.005) { steps.push({ label: r.fix.label, why: r.fix.text || r.t, act: a }); touched.add(key); if (a.b) touched.add(a.b); cur = next; cm = nm; g = ng; done = true; break; }
      }
      if (!done) break;
    }
    return { steps, H: cur, M: cm };
  }

  // ---------- render ----------
  const yr = sc => { const a = sc.from.slice(0, 4), b = sc.to.slice(0, 4); return a === b ? a : `${a}–${b.slice(2)}`; };
  function render() {
    pending = null;
    const h = PF.get(), H = h.map(x => ({ s: S.get(x.slug), w: x.w })).filter(x => x.s);
    root.classList.toggle('is-empty', !H.length);
    if (!H.length) { $('st-out').hidden = true; $('st-empty').hidden = false; last = null; return; }
    $('st-empty').hidden = true;
    if (!D) { load(); return; }
    $('st-out').hidden = false;
    const M = measure(H), cap = PF.cap();
    if (sel < 0 || sel >= M.scen.length) sel = M.scen.indexOf(M.worst);
    if (last && (Math.abs(last.worst - M.worst.loss) > 0.004 || Math.abs(last.bets - M.bets) > 0.05)) {
      $('st-live').textContent = `Worst crash ${spct(last.worst)} → ${spct(M.worst.loss)} · independent bets ${last.bets.toFixed(1)} → ${M.bets.toFixed(1)}`;
    }
    last = { worst: M.worst.loss, bets: M.bets };
    $('st-facts').innerHTML = [
      ['Værste fald', spct(M.worst.loss), M.worst.sc.name],
      ['Markedssvingning', M.beta.toFixed(2) + '×', 'beta, seneste to år'],
      ['Årlig udsvingning', '±' + pct(M.sd), 'én standardafvigelse'],
      ['Uafhængige satsninger', M.bets.toFixed(1), `of ${H.length} holding${H.length === 1 ? '' : 's'}`]
    ].map(f => `<div><dt>${f[0]}</dt><dd class="num">${f[1]}</dd><small>${esc(f[2])}</small></div>`).join('');
    $('st-scen').innerHTML = M.scen.map((r, k) => `<button type="button" class="st-c${k === sel ? ' on' : ''}" data-k="${k}" aria-pressed="${k === sel}"><span class="st-n">${esc(r.sc.name)}<small>${yr(r.sc)}</small></span><b class="num ${r.loss < r.mkt - 0.03 ? 'neg' : r.loss > r.mkt + 0.03 ? 'pos' : ''}">${r.est > 0.5 ? '≈' : ''}${spct(r.loss)}</b><small class="num">Market ${spct(r.mkt)}</small></button>`).join('');
    const r = M.scen[sel], mx = Math.max(0.01, ...r.parts.map(p => Math.abs(p.r)));
    $('st-det').innerHTML = `<div class="st-dh"><div><h3>${esc(r.sc.name)}</h3><p class="mut">${esc(r.sc.what)} · ${esc(r.sc.from)} to ${esc(r.sc.to)}</p></div><div class="st-big"><b class="num">${spct(r.loss)}</b><small class="num">${cap ? dkk(r.loss * cap) : ''}</small></div></div>`
      + `<ul class="st-bars">${r.parts.slice(0, 10).map(p => `<li><a href="stocks/${p.x.s.slug}.html">${esc(p.x.s.name)}</a><span class="track ${p.r < 0 ? 'neg' : 'pos'}"><i style="width:${(Math.abs(p.r) / mx * 100).toFixed(1)}%"></i></span><span class="num ${p.r < 0 ? 'neg' : 'pos'}">${p.e ? '≈' : ''}${spct(p.r)}</span></li>`).join('')}</ul>`
      + (r.parts.length > 10 ? `<p class="note">${r.parts.length - 10} more holdings not shown.</p>` : '');
    const P = propose(H, M), cmp = (k, a, b) => `<div><dt>${k}</dt><dd class="num">${a} <span class="mut">→</span> ${b}</dd></div>`;
    const name = slug => (S.get(slug) || { name: slug }).name;
    const skipped = F.keep.map(x => ['keep', x, `Keeping ${name(x)}`]).concat(F.no.map(x => ['no', x, `Not ${name(x)}`]));
    $('st-apply').hidden = !P.steps.length;
    $('st-prop').innerHTML = (P.steps.length
      ? `<ol class="st-steps">${P.steps.map((x, k) => `<li><span><b>${esc(x.label)}</b><small>${esc(x.why)}</small></span><button type="button" class="linkbtn" data-skip="${k}">${x.act.t === 'add' ? 'Spring over' : 'Behold ' + esc(name(x.act.t === 'swap' ? x.act.a : x.act.slug))}</button></li>`).join('')}</ol>`
      + `<dl class="st-cmp">${cmp('Værste fald', spct(M.worst.loss), spct(P.M.worst.loss))}${cmp('Markedssvingning', M.beta.toFixed(2) + '×', P.M.beta.toFixed(2) + '×')}${cmp('Uafhængige satsninger', M.bets.toFixed(1), P.M.bets.toFixed(1))}${cmp('Bjarvik score', wscore(H).toFixed(1), wscore(P.H).toFixed(1))}</dl>`
      : `<p class="mut st-none">No change within these filters makes the portfolio sturdier.</p>`)
      + (skipped.length ? `<p class="st-skipped">${skipped.map(x => `<button type="button" class="chip" data-unskip="${x[0]}:${x[1]}">${esc(x[2])} <span aria-hidden="true">×</span><span class="sr">, undo</span></button>`).join('')}</p>` : '');
    $('st-apply').onclick = () => P.steps.forEach(x => applyReal(x.act));
    $('st-prop').onclick = e => {
      const b = e.target.closest('[data-skip],[data-unskip]'); if (!b) return;
      if (b.dataset.skip !== undefined) { const a = P.steps[+b.dataset.skip].act; if (a.t === 'add') F.no.push(a.slug); else F.keep.push(a.t === 'swap' ? a.a : a.slug); }
      else { const [k, v] = b.dataset.unskip.split(':'); F[k] = F[k].filter(x => x !== v); }
      saveF(); render();
    };
    const R = risks(H, M);
    $('st-risks').innerHTML = R.map((x, k) => `<li class="${x.lvl}"><b>${esc(x.t)}</b><span>${esc(x.why)}</span>${x.fix && !F.keep.includes(x.fix.act.t === 'swap' ? x.fix.act.a : x.fix.act.slug) ? `<span class="st-fix"><button type="button" class="btn" data-fix="${k}">${esc(x.fix.label)}</button>${x.fix.text ? `<small>${esc(x.fix.text)}</small>` : ''}</span>` : ''}</li>`).join('');
    $('st-risks').onclick = e => { const b = e.target.closest('[data-fix]'); if (b && R[+b.dataset.fix].fix) applyReal(R[+b.dataset.fix].fix.act); };
  }
  function load() {
    if (load.busy) return; load.busy = true;
    $('st-wait').hidden = false;
    const sc = Object.assign(document.createElement('script'), { src: `assets/stressdata.js${ver ? '?v=' + ver : ''}`, async: true });
    sc.onload = () => { D = window.BJARVIK_STRESS; $('st-wait').hidden = true; if (D) render(); else $('st-wait').textContent = 'Data om kursfald mangler.'; };
    sc.onerror = () => { $('st-wait').textContent = 'Kunne ikke indlæse crash-dataene.'; };
    document.head.append(sc);
  }
  $('sf-reg').value = F.reg; $('sf-min').value = String(F.min); $('sf-pe').value = F.pe;
  ['reg', 'min', 'pe'].forEach(k => $('sf-' + k).addEventListener('change', e => { F[k] = e.target.value; saveF(); render(); }));
  root.querySelectorAll('[data-sf]').forEach(b => {
    b.setAttribute('aria-pressed', String(!!F[b.dataset.sf]));
    b.addEventListener('click', () => { F[b.dataset.sf] = !F[b.dataset.sf]; b.setAttribute('aria-pressed', String(F[b.dataset.sf])); saveF(); render(); });
  });
  $('st-scen').addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) { sel = +b.dataset.k; render(); } });
  document.addEventListener('pf:change', () => { if (!pending) pending = setTimeout(render, 0); });
  render();
})();
