/* 看台 KANTAI — 手工 SVG 图表 (零依赖) */
(function () {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const K = window.Kantai;

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function text(parent, x, y, s, attrs) {
    const t = el("text", Object.assign({ x, y, "font-size": 10, fill: "#6f7468" }, attrs || {}), parent);
    t.textContent = s;
    return t;
  }

  /* 主场走势: points=[{x:轮次, y:人数|null, label, url}] */
  function trendSVG(points, opts) {
    opts = opts || {};
    const W = 680, H = 240, P = { l: 46, r: 10, t: 14, b: 26 };
    const vals = points.map((p) => p.y).filter((v) => v != null);
    if (!vals.length) return '<div class="muted small">暂无数据</div>';
    const max = Math.max(...vals) * 1.08, min = 0;
    const X = (x) => P.l + ((x - 1) / 29) * (W - P.l - P.r);
    const Y = (v) => P.t + (1 - (v - min) / (max - min)) * (H - P.t - P.b);
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, class: "chart", role: "img" });
    // 网格
    [0.25, 0.5, 0.75, 1].forEach((f) => {
      const v = max * f;
      el("line", { x1: P.l, x2: W - P.r, y1: Y(v), y2: Y(v), stroke: "#e9e2cf", "stroke-width": 1 }, svg);
      text(svg, 4, Y(v) + 3, K.fmt(Math.round(v)));
    });
    // 均值线
    if (opts.avg != null) {
      el("line", { x1: P.l, x2: W - P.r, y1: Y(opts.avg), y2: Y(opts.avg),
        stroke: "#9a6a06", "stroke-width": 1.2, "stroke-dasharray": "5 4" }, svg);
      text(svg, W - P.r - 64, Y(opts.avg) - 5, "均值 " + K.fmt(Math.round(opts.avg)), { fill: "#9a6a06" });
    }
    // 折线(只连非缺失点)
    let d = "";
    points.forEach((p) => {
      if (p.y == null) return;
      d += (d ? "L" : "M") + X(p.x).toFixed(1) + " " + Y(p.y).toFixed(1) + " ";
    });
    el("path", { d: d.trim(), fill: "none", stroke: "#0c6b3f", "stroke-width": 2 }, svg);
    // 点
    points.forEach((p) => {
      const c = el("circle", { cx: X(p.x), cy: p.y == null ? Y(max * 0.04) : Y(p.y), r: 4.6,
        fill: p.y == null ? "#fffdf7" : "#0c6b3f",
        stroke: "#0c6b3f", "stroke-width": 2,
        style: p.url ? "cursor:pointer" : "" }, svg);
      const tt = el("title", {}, c);
      tt.textContent = (p.label || ("第" + p.x + "轮")) + (p.y == null ? " · 数据缺失" : " · " + K.fmt(p.y) + "人");
      if (p.url) c.addEventListener("click", () => (location.href = p.url));
    });
    // x 轴
    [1, 5, 10, 15, 20, 25, 30].forEach((r) => text(svg, X(r) - 8, H - 8, "R" + r));
    const wrap = document.createElement("div");
    wrap.appendChild(svg);
    return wrap.innerHTML;
  }

  /* 双队对比 */
  function compareSVG(aPts, bPts, aName, bName) {
    const W = 680, H = 260, P = { l: 46, r: 10, t: 14, b: 26 };
    const vals = aPts.concat(bPts).map((p) => p.y).filter((v) => v != null);
    if (!vals.length) return '<div class="muted small">暂无数据</div>';
    const max = Math.max(...vals) * 1.08;
    const X = (x) => P.l + ((x - 1) / 29) * (W - P.l - P.r);
    const Y = (v) => P.t + (1 - v / max) * (H - P.t - P.b);
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, class: "chart", role: "img" });
    [0.25, 0.5, 0.75, 1].forEach((f) => {
      const v = max * f;
      el("line", { x1: P.l, x2: W - P.r, y1: Y(v), y2: Y(v), stroke: "#e9e2cf" }, svg);
      text(svg, 4, Y(v) + 3, K.fmt(Math.round(v)));
    });
    const series = [
      { pts: aPts, color: "#0c6b3f", name: aName },
      { pts: bPts, color: "#8a5a00", name: bName },
    ];
    series.forEach((s) => {
      let d = "";
      s.pts.forEach((p) => { if (p.y != null) d += (d ? "L" : "M") + X(p.x).toFixed(1) + " " + Y(p.y).toFixed(1) + " "; });
      el("path", { d: d.trim(), fill: "none", stroke: s.color, "stroke-width": 2.2 }, svg);
      s.pts.forEach((p) => {
        if (p.y == null) return;
        const c = el("circle", { cx: X(p.x), cy: Y(p.y), r: 3.6, fill: s.color }, svg);
        const tt = el("title", {}, c);
        tt.textContent = s.name + " 第" + p.x + "轮 · " + K.fmt(p.y) + "人";
      });
    });
    [1, 5, 10, 15, 20, 25, 30].forEach((r) => text(svg, X(r) - 8, H - 8, "R" + r));
    const wrap = document.createElement("div");
    wrap.appendChild(svg);
    return wrap.innerHTML;
  }

  /* 覆盖率矩阵 cells=[{id,status}] */
  function coverageGrid(cells, cols) {
    const g = document.createElement("div");
    g.className = "covgrid";
    g.style.gridTemplateColumns = `repeat(${cols},1fr)`;
    cells.forEach((c) => {
      const d = document.createElement("div");
      d.className = "cell s-" + c.status;
      d.title = c.title || c.id;
      if (c.url) { d.style.cursor = "pointer"; d.addEventListener("click", () => (location.href = c.url)); }
      g.appendChild(d);
    });
    return g.outerHTML;
  }

  window.KantaiCharts = { trendSVG, compareSVG, coverageGrid };
})();
