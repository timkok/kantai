/* 看台 KANTAI — 数据加载与通用工具 */
(function () {
  "use strict";

  const JSON_FILES = ["meta", "teams", "matches_csl2025", "matches_gzpower2025", "demo"];

  async function fetchJSON(name) {
    const r = await fetch("data/" + name + ".json", { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }

  async function loadData() {
    // 首选: 读取 data/*.json (本地服务器 / GitHub Pages)
    // 兜底: file:// 直接双击打开时 fetch 会被浏览器拦截,改用构建时内联的数据包
    const data = {};
    try {
      const parts = await Promise.all(JSON_FILES.map(fetchJSON));
      JSON_FILES.forEach((n, i) => (data[n] = parts[i]));
      data._origin = "json";
    } catch (e) {
      if (!window.KANTAI_DATA) throw new Error("数据加载失败: 既无 data/*.json,也无内联数据包。请用 python3 -m http.server 打开。");
      Object.assign(data, window.KANTAI_DATA);
      data._origin = "inline";
    }
    return data;
  }

  const fmt = (n) => (n == null ? "—" : Number(n).toLocaleString("zh-CN"));
  const pct1 = (x) => (x == null || !isFinite(x) ? "—" : (x * 100).toFixed(1) + "%");
  const capRate = (att, cap) => (att == null || !cap ? null : att / cap);

  const WEEK_ZH = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  function weekdayZh(dateStr) {
    if (!dateStr) return "—";
    const d = new Date(dateStr + "T12:00:00");
    return isNaN(d) ? "—" : WEEK_ZH[d.getDay()];
  }
  function isWeekend(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr + "T12:00:00");
    if (isNaN(d)) return null;
    const g = d.getDay();
    return g === 0 || g === 6;
  }

  function teamName(data, code) {
    const t = data.teams[code];
    return t ? t.zh : code;
  }

  function matchStatus(m) {
    // single-match data status: ok(third-party) | missing
    if (m.attendance == null) return "missing";
    return "ok";
  }

  function demoMode() {
    try { return localStorage.getItem("kantai_demo") === "1"; } catch (e) { return false; }
  }
  function setDemo(on) {
    try {
      if (on) localStorage.setItem("kantai_demo", "1");
      else localStorage.removeItem("kantai_demo");
    } catch (e) {}
    document.body.classList.toggle("demo", on);
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function qs(name) {
    return new URLSearchParams(location.search).get(name);
  }

  window.Kantai = {
    loadData, fmt, pct1, capRate, weekdayZh, isWeekend,
    teamName, matchStatus, demoMode, setDemo, esc, qs,
  };
})();
