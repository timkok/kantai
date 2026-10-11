#!/usr/bin/env python3
"""Per-match data fetcher: Transfermarkt public pages -> data/raw/.

Covers: CSL 2025 (30 rounds x 8 = 240 matches) and Guangdong GZ-Power
(Guangzhou Leopards) 2025 China League One home matches (15).

Politeness & honesty rules (see README):
- public pages only, no login/paywall/CAPTCHA bypass
- ~1.5s between requests, disk cache in tools/.cache (never re-fetch)
- on HTTP/parse failure: keep last-good cache, record failure, never fabricate
- every record carries its source URL + fetch time

Usage: python3 tools/fetch_tm.py [--rounds N] [--league csl|cl1|all]
"""
import json, os, re, sys, time, urllib.request, urllib.error
from datetime import datetime, timezone
from html import unescape

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(BASE, "tools", ".cache")
RAW = os.path.join(BASE, "data", "raw")
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")
DELAY = 1.5

# Transfermarkt internal season id = calendar year - 1 (verified 2026-10-11)
TM_SEASON_ID = {"csl2025": 2024, "cl1_2025": 2024}

LEAGUES = {
    "csl2025":   {"tm_slug": "chinese-super-league", "tm_code": "CSL",
                  "rounds": 30, "label": "CSL 2025"},
    "cl1_2025":  {"tm_slug": "china-league-one",     "tm_code": "CLO",
                  "rounds": 30, "label": "China League One 2025"},
}

# TM full title -> our team code (CSL 2025 + GZ-Power)
TITLE2CODE = {
    "Beijing Guoan": "beijing-guoan",
    "Changchun Yatai": "changchun-yatai",
    "Chengdu Rongcheng": "chengdu-rongcheng",
    "Dalian Yingbo": "dalian-yingbo",
    "Henan FC": "henan", "Henan Songshan Longmen": "henan",
    "Meizhou Hakka": "meizhou-hakka",
    "Qingdao Hainiu": "qingdao-hainiu",
    "Qingdao West Coast": "qingdao-west-coast",
    "Shandong Taishan": "shandong-taishan",
    "Shanghai Port": "shanghai-port",
    "Shanghai Shenhua": "shanghai-shenhua",
    "Shenzhen Peng City": "shenzhen-peng-city",
    "Tianjin Jinmen Tiger": "tianjin-jinmen-tiger",
    "Wuhan Three Towns": "wuhan-three-towns",
    "Yunnan Yukun": "yunnan-yukun",
    "Zhejiang FC": "zhejiang",
    "Guangdong GZ-Power": "guangdong-gz-power",
    # China League One 2025 (away opponents, display names only)
    "Chongqing Tonglianglong": "chongqing-tonglianglong",
    "Dalian K'un City": "dalian-kun-city",
    "Dingnan United": "dingnan-united",
    "Foshan Nanshi": "foshan-nanshi",
    "Guangxi Pingguo": "guangxi-pingguo",
    "Liaoning Tieren": "liaoning-tieren",
    "Nanjing City": "nanjing-city",
    "Nantong Zhiyun": "nantong-zhiyun",
    "Qingdao Red Lions": "qingdao-red-lions",
    "Shaanxi Union": "shaanxi-union",
    "Shanghai Jiading Huilong": "shanghai-jiading-huilong",
    "Shenzhen Juniors": "shenzhen-juniors",
    "Shijiazhuang Gongfu": "shijiazhuang-gongfu",
    "Suzhou Dongwu": "suzhou-dongwu",
    "Yanbian Longding": "yanbian-longding",
}

failures = []

def cache_path(name):
    return os.path.join(CACHE, name)

def fetch(url, cache_name):
    """Return html (str) or None. Cached; on failure keeps old cache."""
    p = cache_path(cache_name)
    if os.path.exists(p):
        return open(p, encoding="utf-8").read()
    time.sleep(DELAY)
    req = urllib.request.Request(url, headers={"User-Agent": UA,
        "Accept-Language": "en-US,en;q=0.9"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            html = r.read().decode("utf-8", "replace")
        os.makedirs(CACHE, exist_ok=True)
        open(p, "w", encoding="utf-8").write(html)
        return html
    except Exception as e:
        failures.append({"url": url, "error": f"{type(e).__name__}: {e}"})
        if os.path.exists(p):
            return open(p, encoding="utf-8").read()
        return None

def parse_spieltag(html, round_no):
    """Extract matches from a matchday overview page."""
    matches = []
    seen_reports = set()
    trs = re.findall(r"<tr[^>]*>(.*?)</tr>", html, re.S)
    for tr in trs:
        if "spieltagsansicht-ergebnis" not in tr:
            continue
        m_rep = re.search(r"/spielbericht/index/spielbericht/(\d+)", tr)
        m_score = re.search(r'<span class="matchresult[^"]*">([^<]*)</span>', tr)
        if not m_rep:
            continue
        rep_id = m_rep.group(1)
        if rep_id in seen_reports:
            continue
        seen_reports.add(rep_id)
        # team titles in order: home first, away last (dedup small/large variants)
        titles = re.findall(r'<a title="([^"]+)" href="/[^"]*/spielplan/verein/\d+', tr)
        titles = [unescape(t) for t in dict.fromkeys(titles)]
        if len(titles) < 2:
            continue
        home_t, away_t = titles[0], titles[-1]
        score = (m_score.group(1).strip() if m_score else "")
        matches.append({"round": round_no, "report_id": rep_id,
                        "home_title": home_t, "away_title": away_t,
                        "score_raw": score})
    return matches

def parse_report(html):
    """Extract date/kickoff/attendance/stadium from a match report page."""
    out = {"date": None, "kickoff_raw": None, "attendance": None,
           "stadium": None}
    m = re.search(r'<p class="sb-datum[^"]*">(.*?)</p>', html, re.S)
    if m:
        txt = re.sub(r"<[^>]+>", " ", m.group(1))
        txt = re.sub(r"\s+", " ", txt).strip()
        # e.g. "1. Matchday | Sat, 22/02/25 | 1:00 PM"
        d = re.search(r"(\d{2})/(\d{2})/(\d{2})", txt)
        if d:
            out["date"] = f"20{d.group(3)}-{d.group(2)}-{d.group(1)}"
        k = re.search(r"(\d{1,2}:\d{2}\s*[AP]M)", txt)
        if k:
            out["kickoff_raw"] = k.group(1)
    m = re.search(r"<strong>Attendance:\s*([\d.]+)</strong>", html)
    if m:
        out["attendance"] = int(m.group(1).replace(".", ""))
    m = re.search(r'<a href="/stadion/stadion/verein/\d+/saison_id/\d+">([^<]+)</a>', html)
    if m:
        out["stadium"] = m.group(1).strip()
    return out

def parse_besucher(html):
    """Per-team attendance/capacity table from besucherzahlen overview."""
    rows = []
    m = re.search(r'<table class="items">.*?<tbody>(.*?)</tbody>', html, re.S)
    if not m:
        return rows
    body = m.group(1)
    # replace nested crest tables with their club title (keeps name, avoids truncating rows)
    def _crest2title(mt):
        t = re.search(r'title="([^"]+)"', mt.group(0))
        return f"CLUBTITLE:{t.group(1)}" if t else ""
    body = re.sub(r'<table class="inline-table">.*?</table>', _crest2title, body, flags=re.S)
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", body, re.S):
        tds = re.findall(r"<td[^>]*>(.*?)</td>", tr, re.S)
        if len(tds) < 8:
            continue
        club_m = re.search(r"CLUBTITLE:([^<]+)", tds[1])
        club = club_m.group(1).strip() if club_m else None
        def num(td):
            t = re.sub(r"<[^>]+>", "", td).strip().replace(".", "").replace(",", "")
            t = re.sub(r"[^\d]", "", t)
            return int(t) if t else None
        rows.append({
            "club": club,
            "capacity_tm": num(tds[2]),
            "spectators_total": num(tds[3]),
            "average": num(tds[4]),
            "matches": num(tds[5]),
        })
    return rows

def run_league(key, max_rounds=None, home_only=None):
    cfg = LEAGUES[key]
    sid = TM_SEASON_ID[key]
    all_matches, unmapped = [], set()
    rounds = max_rounds or cfg["rounds"]
    for rnd in range(1, rounds + 1):
        url = (f"https://www.transfermarkt.com/{cfg['tm_slug']}/spieltag/"
               f"wettbewerb/{cfg['tm_code']}/spieltag/{rnd}/saison_id/{sid}")
        html = fetch(url, f"{key}_spieltag_{rnd:02d}.html")
        if not html:
            continue
        for m in parse_spieltag(html, rnd):
            hc = TITLE2CODE.get(m["home_title"])
            ac = TITLE2CODE.get(m["away_title"])
            if not hc:
                unmapped.add(m["home_title"])
            if not ac:
                unmapped.add(m["away_title"])
            m.update({"home": hc, "away": ac, "league_key": key})
            all_matches.append(m)
        print(f"  [{cfg['label']}] round {rnd}: "
              f"{len([x for x in all_matches if x['round']==rnd])} matches", flush=True)

    # fetch reports
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    for i, m in enumerate(all_matches):
        if home_only and m["home"] != home_only:
            m["report"] = None
            continue
        rep_url = f"https://www.transfermarkt.com/spielbericht/index/spielbericht/{m['report_id']}"
        html = fetch(rep_url, f"{key}_report_{m['report_id']}.html")
        if html:
            r = parse_report(html)
            r["source_url"] = rep_url
            r["fetched_at"] = now
            m["report"] = r
        else:
            m["report"] = None
        if (i + 1) % 20 == 0:
            print(f"  [{cfg['label']}] reports {i+1}/{len(all_matches)}", flush=True)

    os.makedirs(RAW, exist_ok=True)
    out_p = os.path.join(RAW, f"{key}.json")
    json.dump({"league": key, "label": cfg["label"],
               "exported_at": now,
               "matches": all_matches,
               "unmapped_titles": sorted(unmapped)},
              open(out_p, "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    print(f"[{cfg['label']}] wrote {out_p} ({len(all_matches)} matches, "
          f"unmapped={sorted(unmapped)})")
    return all_matches

def main():
    leagues = {"csl": "csl2025", "cl1": "cl1_2025"}
    which = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else "all"
    maxr = None
    for a in sys.argv[1:]:
        if a.startswith("--rounds="):
            maxr = int(a.split("=")[1])
    targets = [leagues["csl"], leagues["cl1"]] if which == "all" else [leagues[which]]
    for key in targets:
        home_only = "guangdong-gz-power" if key == "cl1_2025" else None
        run_league(key, max_rounds=maxr, home_only=home_only)
    # TM per-team capacity table (CSL 2025) for conflict surfacing
    html = fetch("https://www.transfermarkt.com/chinese-super-league/besucherzahlen/"
                 "wettbewerb/CSL/plus/1/saison_id/2024", "csl2025_besucher.html")
    if html:
        rows = parse_besucher(html)
        json.dump(rows, open(os.path.join(RAW, "csl2025_tm_capacity.json"),
                             "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(f"[CSL 2025] TM capacity table rows: {len(rows)}")
    if failures:
        json.dump(failures, open(os.path.join(RAW, "_failures.json"),
                                 "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(f"FAILURES: {len(failures)} (see data/raw/_failures.json)")

if __name__ == "__main__":
    main()
