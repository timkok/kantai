/* 看台 KANTAI — 页面渲染 */
(function () {
  "use strict";
  const K = window.Kantai, C = window.KantaiCharts;
  let D = null, DS = null;

  /* ---------- 数据集 ---------- */
  function datasetFor(teamCode) {
    if (K.demoMode()) return { teams: D.demo.teams, matches: D.demo.matches, meta: D.demo.meta, isDemo: true, key: "demo" };
    if (teamCode === "guangdong-gz-power")
      return { teams: D.teams, matches: D.matches_gzpower2025, meta: D.meta, isDemo: false, key: "cl1" };
    return { teams: D.teams, matches: D.matches_csl2025, meta: D.meta, isDemo: false, key: "csl" };
  }
  const T = (code) => DS.teams[code] || D.teams[code] || { zh: code, en: code };

  function capConflict(t) {
    if (!t || !t.cap_wiki || !t.cap_tm) return false;
    return Math.abs(t.cap_tm - t.cap_wiki) / t.cap_wiki > 0.03;
  }
  function rateRange(att, t) {
    // 返回 {lo, hi, primary} — 容量口径不一致时给出区间
    const r1 = K.capRate(att, t.cap_wiki), r2 = K.capRate(att, t.cap_tm);
    if (r1 == null) return null;
    if (r2 == null || !capConflict(t)) return { lo: r1, hi: r1, primary: r1 };
    return { lo: Math.min(r1, r2), hi: Math.max(r1, r2), primary: r1 };
  }

  /* ---------- 票根卡 ---------- */
  function ticketHTML(m) {
    const t = T(m.home), missing = m.attendance == null;
    const rr = missing ? null : rateRange(m.attendance, t);
    const dt = (m.date || "").slice(5).replace("-", "/");
    const badges = [];
    if (m.derby) badges.push(`<span class="badge derby">${K.esc(m.derby.name)}</span>`);
    badges.push(`<span class="badge">${m.weekend ? "周末" : "周中"}</span>`);
    if (missing) badges.push(`<span class="badge miss">观众数缺失</span>`);
    else {
      badges.push(`<span class="badge tp">第三方数据</span>`);
      if (capConflict(t)) badges.push(`<span class="badge conf">容量口径冲突</span>`);
    }
    const fill = missing
      ? `<div class="fillbar unknown"><i style="width:100%"></i></div>
         <div class="fill-meta"><span>暂无本场观众数据 — 缺失不等于零</span></div>`
      : !rr
      ? `<div class="fillbar unknown"><i style="width:100%"></i></div>
         <div class="fill-meta"><span>球场标称容量未知，无法计算占比 — 不估算分母</span></div>`
      : `<div class="fillbar"><i style="width:${Math.min(100, rr.primary * 100).toFixed(1)}%"></i></div>
         <div class="fill-meta"><span>标称容量占比 <b class="num">${K.pct1(rr.primary)}</b>
         ${rr.lo !== rr.hi ? `（口径不同：${K.pct1(rr.lo)}–${K.pct1(rr.hi)}）` : ``}
         · 分母 ${K.esc(t.stadium_zh || "")}标称 ${K.fmt(t.cap_wiki)}</span></div>`;
    return `<article class="ticket${missing ? " missing" : ""}">
      <a class="cardlink" href="match.html?id=${m.id}" aria-label="查看比赛详情"></a>
      <div class="stub"><div class="round">R${m.round}</div><div class="date">${dt}<br>${K.esc(m.weekday_zh || "")}</div></div>
      <div class="main">
        <div class="match-line"><span class="team">${K.esc(t.zh)}</span>
          <span class="score num">${m.score_h}–${m.score_a}</span>
          <span class="team">${K.esc(T(m.away).zh)}</span></div>
        <div class="att-row"><div class="att-big num">${missing ? "数据缺失" : K.fmt(m.attendance)}${missing ? "" : "<small> 人到场</small>"}</div></div>
        ${fill}
        <div class="badges">${badges.join("")}</div>
      </div></article>`;
  }

  /* ---------- 时间线 ---------- */
  function renderTimeline() {
    DS = datasetFor();
    const app = document.getElementById("app");
    const ms = DS.matches.slice();
    const withAtt = ms.filter((m) => m.attendance != null);
    const total = withAtt.reduce((s, m) => s + m.attendance, 0);
    const maxM = withAtt.reduce((a, b) => (b.attendance > a.attendance ? b : a), withAtt[0]);
    const minM = withAtt.reduce((a, b) => (b.attendance < a.attendance ? b : a), withAtt[0]);

    // 广州豹 spotlight
    const gz = D.teams["guangdong-gz-power"];
    const gzMs = D.matches_gzpower2025.filter((m) => m.attendance != null);
    const gzAvg = gzMs.length ? Math.round(gzMs.reduce((s, m) => s + m.attendance, 0) / gzMs.length) : null;

    app.innerHTML = `
    <div class="pagehead"><div class="kicker">MATCH TIMELINE · 比赛时间线</div>
      <h1>2025 中超 · 每一场比赛，到场多少人</h1>
      <p>240 场比赛，按时间倒序。每个数字都带分母、带来源；缺失就写缺失，冲突就亮出来。</p></div>
    <div class="season-line">
      <div class="stat"><div class="v num">${K.fmt(total)}</div><div class="k">赛季总人次（第三方）</div></div>
      <div class="stat"><div class="v num">${K.fmt(Math.round(total / withAtt.length))}</div><div class="k">场均到场</div></div>
      <div class="stat"><div class="v num">${K.fmt(maxM.attendance)}</div><div class="k">最高单场</div><div class="s">${K.esc(T(maxM.home).zh)} ${maxM.score_h}–${maxM.score_a} ${K.esc(T(maxM.away).zh)}</div></div>
      <div class="stat"><div class="v num">${K.fmt(minM.attendance)}</div><div class="k">最低单场</div><div class="s">${K.esc(T(minM.home).zh)} ${minM.score_h}–${minM.score_a} ${K.esc(T(minM.away).zh)}</div></div>
      <div class="stat"><div class="v num">${withAtt.length}<span style="font-size:14px">/${ms.length}</span></div><div class="k">有观众数据的场次</div></div>
    </div>
    <div class="card"><h2>焦点球队 · 广东广州豹（2025 中甲）</h2>
      <p class="small muted" style="margin:0 0 10px">2025 赛季中甲主场 15 场。若数据可靠，单独建档追踪。</p>
      <div class="att-row"><div class="att-big num">${gzAvg == null ? "数据缺失" : K.fmt(gzAvg)}${gzAvg == null ? "" : "<small> 主场场均</small>"}</div>
      <a class="btn" href="team.html?team=guangdong-gz-power" style="margin-left:auto">进入广州豹档案 →</a></div>
    </div>
    <div class="filters"><div class="wrap"><div class="row">
      <select id="f-team"><option value="">全部球队</option></select>
      <select id="f-round"><option value="">全部轮次</option></select>
      <select id="f-status"><option value="">全部数据状态</option>
        <option value="ok">有观众数据</option><option value="missing">数据缺失</option></select>
      <select id="f-sort"><option value="date-desc">时间倒序</option><option value="date-asc">时间正序</option>
        <option value="att-desc">人数降序</option><option value="rate-desc">占比降序</option></select>
      <span class="count" id="f-count"></span>
    </div></div></div>
    <div id="list" style="margin-top:6px"></div>`;

    const teamSel = document.getElementById("f-team");
    Object.keys(DS.teams).filter((c) => DS.teams[c].league !== "CL1").forEach((c) =>
      teamSel.insertAdjacentHTML("beforeend", `<option value="${c}">${K.esc(DS.teams[c].zh)}</option>`));
    const roundSel = document.getElementById("f-round");
    for (let r = 1; r <= 30; r++) roundSel.insertAdjacentHTML("beforeend", `<option value="${r}">第 ${r} 轮</option>`);

    function apply() {
      const ft = teamSel.value, fr = roundSel.value, fs = document.getElementById("f-status").value,
        sort = document.getElementById("f-sort").value;
      let list = ms.filter((m) =>
        (!ft || m.home === ft || m.away === ft) &&
        (!fr || m.round === +fr) &&
        (!fs || (fs === "ok") === (m.attendance != null)));
      const key = {
        "date-desc": (a, b) => (b.date || "").localeCompare(a.date || ""),
        "date-asc": (a, b) => (a.date || "").localeCompare(b.date || ""),
        "att-desc": (a, b) => (b.attendance || -1) - (a.attendance || -1),
        "rate-desc": (a, b) => {
          const ra = a.attendance == null ? -1 : (K.capRate(a.attendance, T(a.home).cap_wiki) || -1);
          const rb = b.attendance == null ? -1 : (K.capRate(b.attendance, T(b.home).cap_wiki) || -1);
          return rb - ra;
        },
      }[sort];
      list.sort(key);
      document.getElementById("f-count").textContent = `共 ${list.length} 场`;
      document.getElementById("list").innerHTML = list.map(ticketHTML).join("") ||
        `<div class="card muted">没有符合条件的比赛。</div>`;
    }
    [teamSel, roundSel].forEach((s) => s.addEventListener("change", apply));
    document.getElementById("f-status").addEventListener("change", apply);
    document.getElementById("f-sort").addEventListener("change", apply);
    apply();
  }

  /* ---------- 单场比赛 ---------- */
  function insightText(m) {
    const t = T(m.home);
    if (m.attendance == null) return "本场暂无可靠的观众人数记录。缺失不等于零，也不做估算。";
    const rr = rateRange(m.attendance, t);
    if (!rr) return "球场标称容量暂无可靠来源，无法计算占比；原始到场人数如上，开放座位数未知。";
    const parts = [];
    if (capConflict(t))
      parts.push(`注意容量口径：维基标称 ${K.fmt(t.cap_wiki)}，Transfermarkt 用 ${K.fmt(t.cap_tm)}，占比在 ${K.pct1(rr.lo)}–${K.pct1(rr.hi)} 之间。`);
    const r = rr.primary;
    if (r >= 0.95) parts.push("基本满座。");
    else if (r >= 0.7) parts.push("上座热烈，视觉上接近坐满。");
    else if (r >= 0.4) parts.push(`看台约 ${(r * 10).toFixed(0)} 成；${t.cap_wiki >= 50000 ? "球场很大，电视画面可能显得比实际空。" : ""}`);
    else parts.push("看台明显偏空。");
    parts.push("以上均为“标称容量占比”，不是本场开放座位上座率（开放座位数未知）。");
    return parts.join("");
  }

  function renderMatch() {
    const app = document.getElementById("app");
    const id = K.qs("id");
    const m = D.matches_csl2025.find((x) => x.id === id) ||
      D.matches_gzpower2025.find((x) => x.id === id) ||
      (K.demoMode() ? D.demo.matches.find((x) => x.id === id) : null);
    if (!m) {
      app.innerHTML = `<div class="pagehead"><h1>找不到这场比赛</h1>
        <p class="muted">id=${K.esc(id || "")} 不存在。<a href="index.html">回到时间线</a></p></div>`;
      return;
    }
    DS = datasetFor(m.home);
    const t = T(m.home), ta = T(m.away), missing = m.attendance == null;
    const rr = missing ? null : rateRange(m.attendance, t);
    const homeMs = DS.matches.filter((x) => x.home === m.home && x.attendance != null)
      .sort((a, b) => b.attendance - a.attendance);
    const rank = missing ? null : homeMs.findIndex((x) => x.id === m.id) + 1;
    const homeAvg = homeMs.length ? homeMs.reduce((s, x) => s + x.attendance, 0) / homeMs.length : null;
    const roundMs = DS.matches.filter((x) => x.round === m.round && x.attendance != null);
    const roundAvg = roundMs.length ? roundMs.reduce((s, x) => s + x.attendance, 0) / roundMs.length : null;
    const prevH = DS.matches.filter((x) => x.home === m.home && x.date < m.date).sort((a, b) => b.date.localeCompare(a.date))[0];
    const nextH = DS.matches.filter((x) => x.home === m.home && x.date > m.date).sort((a, b) => a.date.localeCompare(b.date))[0];

    const tierCap = missing ? "" : !rr ? `
      <div class="tier unknown"><div class="t">标称容量占比</div><div class="v">未知</div>
        <div class="d">球场标称容量暂无可靠来源，不估算分母。</div></div>
      <div class="tier unknown"><div class="t">开放座位上座率</div><div class="v">未知</div>
        <div class="d">未获得本场实际开放座位数。<b>缺失不计算</b>，不拿标称容量冒充。</div></div>` : `
      <div class="tier"><div class="t">标称容量占比（主口径）</div><div class="v num">${K.pct1(rr.primary)}</div>
        <div class="d">分母：${K.esc(t.stadium_zh || t.stadium_en || "")}标称容量 ${K.fmt(t.cap_wiki)}（${K.esc(t.cap_source || "维基百科")}）
        ${capConflict(t) ? `<br>冲突：Transfermarkt 用 ${K.fmt(t.cap_tm)}，对应占比 ${K.pct1(K.capRate(m.attendance, t.cap_tm))}` : ""}</div></div>
      <div class="tier unknown"><div class="t">开放座位上座率</div><div class="v">未知</div>
        <div class="d">未获得本场实际开放座位数。<b>缺失不计算</b>，不拿标称容量冒充。</div></div>`;

    app.innerHTML = `
    <div class="pagehead"><div class="kicker">SINGLE MATCH · 单场比赛</div>
      <div class="versus"><span class="t">${K.esc(t.zh)}</span>
        <span class="score num">${m.score_h}–${m.score_a}</span>
        <span class="t">${K.esc(ta.zh)}</span></div>
      <p>${DS.isDemo ? "演示赛季" : m.league === "CL1" ? "2025 中甲" : "2025 中超"} · 第 ${m.round} 轮 ·
        ${K.esc(m.date || "")} ${K.esc(m.weekday_zh || "")} ·
        ${m.kickoff_raw ? "开球 " + K.esc(m.kickoff_raw) + "（Transfermarkt 显示时间，时区未核实）" : "开球时间未知"}</p>
      <div class="badges">${m.derby ? `<span class="badge derby">${K.esc(m.derby.name)}</span>` : ""}
        <span class="badge">${m.weekend ? "周末" : "周中"}</span>
        ${missing ? `<span class="badge miss">观众数缺失</span>` : `<span class="badge tp">第三方数据</span>`}
        ${!missing && capConflict(t) ? `<span class="badge conf">容量口径冲突</span>` : ""}</div>
    </div>
    ${missing ? `<div class="card"><div class="hero-att" style="color:var(--gray)">数据缺失</div>
      <p class="muted">本场暂无可靠的观众人数记录。缺失不等于零，也不做估算。</p></div>`
    : `<div class="card"><div class="tiny muted">到场人数</div>
      <div class="hero-att num">${K.fmt(m.attendance)}<span style="font-size:16px;font-weight:400;color:var(--muted)"> 人</span></div>
      <div class="tiers">
        <div class="tier"><div class="t">到场人数（原始值）</div><div class="v num">${K.fmt(m.attendance)}</div>
          <div class="d">来源：Transfermarkt 单场报告（第三方）</div></div>
        ${tierCap}
      </div></div>`}
    <div class="insight">${K.esc(insightText(m))}</div>
    <div class="card"><h2>本场上下文</h2>
      <div class="kv">
        <dt>球场</dt><dd>${K.esc(m.stadium_tm || t.stadium_zh || "—")}<span class="tiny muted">（Transfermarkt 记录）</span></dd>
        <dt>主队赛前排名</dt><dd>${m.home_pos ? `第 ${m.home_pos} 名<span class="tiny muted">（维基百科逐轮排名）</span>` : "—"}</dd>
        <dt>主队此前 5 场</dt><dd>${m.home_form ? `<span class="num" style="letter-spacing:3px;font-weight:700">${K.esc(m.home_form)}</span> <span class="tiny muted">W胜 D平 L负 · 由本季赛果推算</span>` : "—"}</dd>
        <dt>德比/特殊</dt><dd>${m.derby ? K.esc(m.derby.name + " · " + (m.derby.note || "")) : "—"}</dd>
      </div></div>
    ${missing ? "" : `<div class="explore"><div class="grid2">
      <div><b>vs 本队赛季主场均值</b><br><span class="num" style="font-size:20px;font-weight:800">
        ${homeAvg ? ((m.attendance - homeAvg) / homeAvg >= 0 ? "+" : "") + ((m.attendance - homeAvg) / homeAvg * 100).toFixed(1) + "%" : "—"}</span>
        <div class="tiny muted">本场 ${K.fmt(m.attendance)} vs 主场均值 ${K.fmt(Math.round(homeAvg))}</div></div>
      <div><b>vs 本轮联赛场均</b><br><span class="num" style="font-size:20px;font-weight:800">
        ${roundAvg ? ((m.attendance - roundAvg) / roundAvg >= 0 ? "+" : "") + ((m.attendance - roundAvg) / roundAvg * 100).toFixed(1) + "%" : "—"}</span>
        <div class="tiny muted">本轮 ${roundMs.length} 场有数据，场均 ${K.fmt(Math.round(roundAvg))}</div></div>
      </div>
      <div class="tiny muted" style="margin-top:8px">本场上座列${K.esc(t.zh)}赛季 ${homeMs.length} 个主场第 <b>${rank}</b> 高。以上为描述性对比，不构成因果结论。</div>
    </div>`}
    <div class="prov${!missing && capConflict(t) ? " conflict" : ""}"><b>数据血缘 · DATA PROVENANCE</b>
      <div class="kv">
        <dt>观众人数来源</dt><dd>Transfermarkt 单场报告（第三方，非官方）${m.source_url ? ` · <a href="${K.esc(m.source_url)}" target="_blank" rel="noopener">查看原页面</a>` : ""}</dd>
        <dt>抓取时间</dt><dd>${K.esc(m.fetched_at ? m.fetched_at.slice(0, 10) : DS.meta.data_as_of || "—")}（UTC）</dd>
        <dt>交叉验证</dt><dd>${DS.isDemo ? "演示数据，无验证" : "本队 15 场加总与维基百科赛季汇总一致 ✓"}</dd>
        ${!missing && capConflict(t) ? `<dt>容量冲突</dt><dd>维基标称 ${K.fmt(t.cap_wiki)} vs Transfermarkt ${K.fmt(t.cap_tm)}，两个口径同时展示，不静默取舍。</dd>` : ""}
        <dt>官方数据</dt><dd>中足联/俱乐部官方逐场观众数未获得公开结构化来源，标记为缺失。</dd>
      </div></div>
    <div class="card"><div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:space-between">
      ${prevH ? `<a class="btn ghost" href="match.html?id=${prevH.id}">← ${K.esc(T(prevH.home).zh)}上个主场</a>` : "<span></span>"}
      <a class="btn ghost" href="team.html?team=${m.home}">${K.esc(t.zh)}球队档案 →</a>
      ${nextH ? `<a class="btn ghost" href="match.html?id=${nextH.id}">${K.esc(T(nextH.home).zh)}下个主场 →</a>` : "<span></span>"}
    </div></div>`;
  }

  /* ---------- 球队档案 ---------- */
  function renderTeam() {
    const app = document.getElementById("app");
    const code = K.qs("team") || "beijing-guoan";
    const ds = datasetFor(code);
    const t = ds.teams[code];
    if (!t) {
      app.innerHTML = `<div class="pagehead"><h1>找不到这支球队</h1>
        <p><a href="index.html">回到时间线</a></p></div>`;
      return;
    }
    DS = ds; // 切换到该队所在数据集
    const homeMs = DS.matches.filter((m) => m.home === code).sort((a, b) => a.round - b.round);
    const vals = homeMs.map((m) => m.attendance).filter((v) => v != null);
    const sum = vals.reduce((s, v) => s + v, 0);
    const avg = vals.length ? sum / vals.length : null;
    const med = vals.length ? vals.slice().sort((a, b) => a - b)[Math.floor(vals.length / 2)] : null;
    const mx = vals.length ? Math.max(...vals) : null, mn = vals.length ? Math.min(...vals) : null;
    const last5 = vals.slice(-5);
    const last5avg = last5.length ? last5.reduce((s, v) => s + v, 0) / last5.length : null;
    const trend = avg && last5avg ? (last5avg - avg) / avg : null;

    // 直方图(5档)
    let hist = "";
    if (vals.length >= 3) {
      const lo = Math.min(...vals), hi = Math.max(...vals), bins = [0, 0, 0, 0, 0];
      vals.forEach((v) => { const b = Math.min(4, Math.floor(((v - lo) / ((hi - lo) || 1)) * 5)); bins[b]++; });
      const bmax = Math.max(...bins);
      hist = `<div style="display:flex;gap:6px;align-items:flex-end;height:74px;margin-top:6px">` +
        bins.map((b, i) => `<div style="flex:1;background:var(--green);opacity:${0.35 + 0.65 * (b / bmax)};border-radius:4px 4px 0 0;height:${Math.max(6, (b / bmax) * 70)}px" title="${K.fmt(Math.round(lo + (hi - lo) * i / 5))}–${K.fmt(Math.round(lo + (hi - lo) * (i + 1) / 5))}：${b}场"></div>`).join("") +
        `</div><div class="tiny muted">主场上座分布（5 档，${vals.length} 场）</div>`;
    }

    app.innerHTML = `
    <div class="pagehead"><div class="kicker">TEAM PROFILE · 球队档案</div>
      <h1>${K.esc(t.zh)} <span class="muted" style="font-size:15px;font-weight:400">${K.esc(t.en || "")} · ${K.esc(t.city || "")}</span></h1>
      <p>${t.league === "CL1" ? "2025 中甲" : t.league === "DEMO" ? "演示" : "2025 中超"} · 主场 ${homeMs.length} 场</p>
      ${t.extra_note ? `<p class="small" style="background:var(--green-soft);border-radius:8px;padding:8px 12px;display:inline-block">⚽ ${K.esc(t.extra_note)}</p>` : ""}</div>
    <div class="card"><h2>球场与容量口径</h2>
      <div class="kv">
        <dt>球场</dt><dd>${K.esc(t.stadium_zh || t.stadium_en || "—")}</dd>
        <dt>标称容量（主）</dt><dd class="num"><b>${K.fmt(t.cap_wiki)}</b> <span class="tiny muted">来源：${K.esc(t.cap_source || "维基百科")}</span></dd>
        ${t.cap_tm ? `<dt>标称容量（副）</dt><dd class="num">${K.fmt(t.cap_tm)} <span class="tiny muted">来源：Transfermarkt</span>
          ${capConflict(t) ? ` <span class="badge conf">口径冲突</span>` : ` <span class="badge ok">基本一致</span>`}</dd>` : ""}
        ${t.venue_notes ? `<dt>场地备注</dt><dd class="small">${K.esc(t.venue_notes)}</dd>` : ""}
        <dt>开放座位数</dt><dd><span class="badge miss">未知</span> <span class="tiny muted">无公开来源，不计算开放座位上座率</span></dd>
      </div></div>
    <div class="season-line" style="grid-template-columns:repeat(4,1fr)">
      <div class="stat"><div class="v num">${vals.length ? K.fmt(sum) : "—"}</div><div class="k">主场总人次</div>
        ${t.wiki2025 ? `<div class="s">维基汇总 ${K.fmt(t.wiki2025.total)} ${Math.abs(t.wiki2025.total - sum) < 2 ? "✓ 一致" : "⚠ 差异"}</div>` : ""}</div>
      <div class="stat"><div class="v num">${avg ? K.fmt(Math.round(avg)) : "—"}</div><div class="k">主场场均</div></div>
      <div class="stat"><div class="v num">${mx ? K.fmt(mx) : "—"}</div><div class="k">最高单场</div></div>
      <div class="stat"><div class="v num">${mn ? K.fmt(mn) : "—"}</div><div class="k">最低单场</div></div>
    </div>
    <div class="card"><h2>赛季主场走势 <span class="tiny muted">（按轮次；空心点=数据缺失）</span></h2>
      <div id="trend"></div>
      <div class="chart-note">中位数 ${med ? K.fmt(med) : "—"} · 均值 ${avg ? K.fmt(Math.round(avg)) : "—"}</div>
      ${hist}</div>
    <div class="card"><h2>球市温度计</h2>
      ${trend == null ? `<p class="muted">数据不足，无法判断趋势。</p>` : `
      <div class="att-row"><div class="att-big num">${trend >= 0.05 ? "升温 ↑" : trend <= -0.05 ? "降温 ↓" : "持平 →"}</div></div>
      <p class="small muted" style="margin:4px 0">最近 5 个主场均值 ${K.fmt(Math.round(last5avg))}，${trend >= 0 ? "高于" : "低于"}赛季均值 ${K.fmt(Math.round(avg))} ${K.pct1(Math.abs(trend))}。
      样本仅 5 场，属描述性观察，不做趋势断言。</p>`}</div>
    <div class="card"><h2>全部主场</h2>${homeMs.map(ticketHTML).join("")}</div>`;
    document.getElementById("trend").innerHTML = C.trendSVG(
      homeMs.map((m) => ({ x: m.round, y: m.attendance, label: `第${m.round}轮 vs ${T(m.away).zh}`, url: "match.html?id=" + m.id })),
      { avg });
  }

  /* ---------- 对比 ---------- */
  function renderCompare() {
    DS = datasetFor();
    const app = document.getElementById("app");
    const codes = Object.keys(DS.teams).filter((c) => DS.teams[c].league !== "CL1");
    const opt = (sel) => codes.map((c) => `<option value="${c}"${c === sel ? " selected" : ""}>${K.esc(DS.teams[c].zh)}</option>`).join("");
    app.innerHTML = `
    <div class="pagehead"><div class="kicker">COMPARE · 球市对比</div>
      <h1>两队主场上座 · 面对面</h1>
      <p>按轮次叠加两队主场走势。只比“主场吸引力”，不掺客场。</p></div>
    <div class="card"><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      <select id="ca" class="team-pick">${opt("dalian-yingbo")}</select>
      <b>vs</b>
      <select id="cb" class="team-pick">${opt("beijing-guoan")}</select>
    </div></div>
    <div class="card"><div id="cmp-chart"></div><div class="chart-note">x 轴为轮次，只在各自主场轮次有点；空缺=该轮为客场。</div></div>
    <div class="card"><h2>汇总</h2><div id="cmp-table"></div></div>`;
    function draw() {
      const ca = document.getElementById("ca").value, cb = document.getElementById("cb").value;
      const pts = (code) => DS.matches.filter((m) => m.home === code)
        .map((m) => ({ x: m.round, y: m.attendance }));
      document.getElementById("cmp-chart").innerHTML =
        C.compareSVG(pts(ca), pts(cb), T(ca).zh, T(cb).zh);
      const row = (code) => {
        const v = pts(code).map((p) => p.y).filter((x) => x != null);
        const t = T(code);
        const rr = v.map((x) => K.capRate(x, t.cap_wiki)).filter((x) => x != null);
        return `<tr><td><b>${K.esc(t.zh)}</b></td><td class="num">${v.length ? K.fmt(Math.round(v.reduce((s, x) => s + x, 0) / v.length)) : "—"}</td>
          <td class="num">${v.length ? K.fmt(Math.max(...v)) : "—"}</td><td class="num">${v.length ? K.fmt(Math.min(...v)) : "—"}</td>
          <td class="num">${rr.length ? K.pct1(rr.reduce((s, x) => s + x, 0) / rr.length) : "—"}</td></tr>`;
      };
      document.getElementById("cmp-table").innerHTML =
        `<table class="data"><tr><th>球队</th><th>主场场均</th><th>最高</th><th>最低</th><th>平均标称容量占比</th></tr>${row(ca)}${row(cb)}</table>
         <p class="tiny muted">占比分母为各队球场标称容量（${K.esc(T(ca).cap_source || "")}口径）；容量口径冲突的球队见<a href="data.html">数据说明</a>。</p>`;
    }
    document.getElementById("ca").addEventListener("change", draw);
    document.getElementById("cb").addEventListener("change", draw);
    draw();
  }

  /* ---------- 数据说明 ---------- */
  function renderDataGuide() {
    DS = datasetFor();
    const app = document.getElementById("app");
    const meta = DS.meta;
    const cells = DS.matches.map((m) => ({
      id: m.id, url: "match.html?id=" + m.id,
      status: m.attendance == null ? "miss" : "ok",
      title: `R${m.round} ${T(m.home).zh} ${m.score_h}-${m.score_a} ${T(m.away).zh} · ${m.attendance == null ? "缺失" : K.fmt(m.attendance) + "人"}`,
    }));
    const conflicts = Object.keys(DS.teams)
      .map((c) => DS.teams[c]).filter((t) => t.cap_tm && capConflict(t));
    app.innerHTML = `
    <div class="pagehead"><div class="kicker">METHODOLOGY · 数据说明</div>
      <h1>口径、来源与诚实清单</h1>
      <p>这个产品能相信什么、不能相信什么，都写在这里。</p></div>
    <div class="card"><h2>口径三原则</h2>
      <div class="grid2">
      <div><b>1. 标称容量占比 ≠ 上座率</b><p class="small muted">页面上所有百分比都是“到场人数 ÷ 球场标称容量”，明确叫“标称容量占比”。球场标称容量不等于本场实际开放座位数。</p></div>
      <div><b>2. 开放座位上座率：未知就不算</b><p class="small muted">没有公开的本场开放座位数，就明确显示“未知”，绝不拿标称容量冒充分母。</p></div>
      <div><b>3. 缺失 ≠ 零；场均 ≠ 单场</b><p class="small muted">缺失的比赛不估算、不填零；球队场均永远不写成单场人数。</p></div>
      <div><b>4. 冲突展示，不静默修正</b><p class="small muted">同一球场两个来源容量不同时，两个数字、两个占比都摆出来。</p></div>
      </div></div>
    <div class="card"><h2>来源</h2>
      <table class="data"><tr><th>来源</th><th>属性</th><th>提供内容</th><th>获取时间</th></tr>
      <tr><td>Transfermarkt 单场报告</td><td><span class="badge tp">第三方</span></td><td>逐场观众数、球场、日期 <a href="https://www.transfermarkt.com" target="_blank" rel="noopener">transfermarkt.com</a></td><td>${K.esc((meta.data_as_of || ""))}</td></tr>
      <tr><td>维基百科 2025 CSL 词条</td><td><span class="badge tp">第三方汇总</span></td><td>分队赛季总人次、球场标称容量、逐轮排名 <a href="https://en.wikipedia.org/wiki/2025_Chinese_Super_League" target="_blank" rel="noopener">词条</a></td><td>2026-10-11</td></tr>
      <tr><td>中足联 / 俱乐部官方</td><td><span class="badge miss">缺失</span></td><td>官方逐场观众数无公开结构化来源</td><td>—</td></tr>
      </table>
      <p class="tiny muted">交叉验证：Transfermarkt 16 队逐场加总与维基百科分队汇总<b>完全一致</b>（总量 6,180,990），说明两者同源（官方轮次公告），第三方逐场数字可信度较高，但仍非官方口径。</p></div>
    <div class="card"><h2>覆盖率矩阵 <span class="tiny muted">（每格一场，点击进单场页）</span></h2>
      <div id="cov"></div>
      <div class="legend"><span><i style="background:var(--green)"></i>有数据（第三方）</span>
      <span><i style="background:#d8d6c9;border:1px dashed #b9b6a4"></i>缺失</span></div></div>
    <div class="card"><h2>容量口径冲突清单</h2>
      ${conflicts.length ? `<table class="data"><tr><th>球队</th><th>球场</th><th>维基标称</th><th>Transfermarkt</th><th>差异</th></tr>` +
        conflicts.map((t) => `<tr><td>${K.esc(t.zh)}</td><td class="small">${K.esc(t.stadium_zh || "")}</td>
          <td class="num">${K.fmt(t.cap_wiki)}</td><td class="num">${K.fmt(t.cap_tm)}</td>
          <td class="num">${(((t.cap_tm - t.cap_wiki) / t.cap_wiki) * 100).toFixed(1)}%</td></tr>`).join("") + `</table>
        <p class="tiny muted">差异超过 3% 即列入。单场页与球队页会同时展示两个口径。</p>`
      : `<p class="muted">无显著冲突。</p>`}</div>
    <div class="card"><h2>更新与待办</h2>
      <div class="kv"><dt>数据版本</dt><dd>${K.esc(meta.generated_at || "")} 生成 · 数据截至 ${K.esc(meta.data_as_of || "")}</dd>
      <dt>抓取失败</dt><dd>${(meta.failures || []).length ? K.esc(JSON.stringify(meta.failures)) : "无（全部成功；失败会保留上次成功数据并在此公示）"}</dd>
      <dt>待核实</dt><dd class="small">① 官方逐场观众数（中足联/俱乐部公告）② 各场实际开放座位数 ③ Transfermarkt 显示的开球时间时区 ④ 广州豹 2025 主场球场中文名以俱乐部公告为准</dd></div>
      <p><button class="btn ghost" id="demo-btn">进入演示模式（虚构数据，明确标识）</button></p>
      <p class="tiny muted">演示模式用明显虚构的球队与数字，仅用于体验交互，不与真实数据混合，可随时退出。</p></div>`;
    document.getElementById("cov").innerHTML = C.coverageGrid(cells, 30);
    document.getElementById("demo-btn").addEventListener("click", () => {
      K.setDemo(true); location.href = "index.html";
    });
  }

  /* ---------- 页脚 ---------- */
  function renderFooter() {
    const demo = K.demoMode();
    document.querySelector("footer .wrap").innerHTML = `
      <span>看台 KANTAI · 中国职业足球上座观察（独立产品）</span>
      <span>数据：Transfermarkt（第三方）· 维基百科（交叉）· 官方逐场暂缺 · 截至 ${K.esc(DS.meta.data_as_of || "")}</span>
      <span>${demo ? `<a href="#" id="exit-demo">退出演示模式</a>` : `<a href="data.html">数据说明</a>`}</span>`;
    const ex = document.getElementById("exit-demo");
    if (ex) ex.addEventListener("click", (e) => { e.preventDefault(); K.setDemo(false); location.href = "index.html"; });
  }

  /* ---------- 启动 ---------- */
  async function boot() {
    const app = document.getElementById("app");
    try {
      D = await K.loadData();
    } catch (e) {
      app.innerHTML = `<div class="errbox">数据加载失败：${K.esc(e.message)}<br>
        <span class="skip">请用本地服务器打开（<span class="num">python3 -m http.server</span>），或确认 data/*.json 存在。</span></div>`;
      return;
    }
    const page = document.body.dataset.page;
    const fn = { timeline: renderTimeline, match: renderMatch, team: renderTeam,
                 compare: renderCompare, dataguide: renderDataGuide }[page];
    if (fn) fn();
    renderFooter();
  }

  document.addEventListener("DOMContentLoaded", () => {
    K.setDemo(K.demoMode());
    const topExit = document.getElementById("exit-demo-top");
    if (topExit) topExit.addEventListener("click", (e) => {
      e.preventDefault(); K.setDemo(false); location.reload();
    });
    boot();
  });
})();
