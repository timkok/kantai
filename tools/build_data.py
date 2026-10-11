#!/usr/bin/env python3
"""Curate raw Transfermarkt data -> frontend JSON + inline bundle.

- 手工核实的球队元数据 (中文名/球场/维基标称容量/维基分队汇总/逐轮排名)
- 衍生字段: weekday_zh, weekend, derby, home_form, home_pos
- 校验: 场次完整性 / 日期合法 / 分队加总与维基交叉 / 排名表每轮为 1..16 的排列
- 输出: data/meta.json, teams.json, matches_csl2025.json,
        matches_gzpower2025.json, demo.json, js/data.bundle.js

失败策略: 缺失保留为 null,绝不填零估算;校验失败直接报错退出。
"""
import json, os, sys
from datetime import datetime, timezone

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(BASE, "data", "raw")
DATA = os.path.join(BASE, "data")
NOW = datetime.now(timezone.utc).isoformat(timespec="seconds")

def fail(msg):
    print("BUILD FAILED:", msg, file=sys.stderr)
    sys.exit(1)

# ---------------- 球队元数据 (2026-10-11 据 en.wikipedia.org/wiki/2025_Chinese_Super_League 核实) ----------------
TEAMS = {
 "beijing-guoan":        dict(zh="北京国安", en="Beijing Guoan", city="北京", league="CSL",
   stadium_zh="工人体育场", stadium_en="Workers' Stadium", cap_wiki=68000, wiki_total=674627),
 "changchun-yatai":      dict(zh="长春亚泰", en="Changchun Yatai", city="长春", league="CSL",
   stadium_zh="长春体育场", stadium_en="Changchun Stadium", cap_wiki=41638, wiki_total=165366),
 "chengdu-rongcheng":    dict(zh="成都蓉城", en="Chengdu Rongcheng", city="成都", league="CSL",
   stadium_zh="凤凰山体育公园专业足球场", stadium_en="Phoenix Hill Football Stadium", cap_wiki=50695, wiki_total=612299),
 "dalian-yingbo":        dict(zh="大连英博", en="Dalian Yingbo", city="大连", league="CSL",
   stadium_zh="大连梭鱼湾足球场", stadium_en="Dalian Suoyuwan Football Stadium", cap_wiki=63671, wiki_total=874020),
 "henan":                dict(zh="河南", en="Henan FC", city="郑州", league="CSL",
   stadium_zh="航海体育场", stadium_en="Hanghai Stadium", cap_wiki=29860, wiki_total=249685),
 "meizhou-hakka":        dict(zh="梅州客家", en="Meizhou Hakka", city="五华", league="CSL",
   stadium_zh="惠堂体育场", stadium_en="Huitang Stadium", cap_wiki=27000, wiki_total=188864),
 "qingdao-hainiu":       dict(zh="青岛海牛", en="Qingdao Hainiu", city="青岛", league="CSL",
   stadium_zh="青岛青春足球场", stadium_en="Qingdao Youth Football Stadium", cap_wiki=50000, wiki_total=337567),
 "qingdao-west-coast":   dict(zh="青岛西海岸", en="Qingdao West Coast", city="青岛", league="CSL",
   stadium_zh="青岛西海岸大学城体育场", stadium_en="Qingdao West Coast University City Sports Center", cap_wiki=27000, wiki_total=214465),
 "shandong-taishan":     dict(zh="山东泰山", en="Shandong Taishan", city="济南", league="CSL",
   stadium_zh="济南奥林匹克体育中心体育场", stadium_en="Jinan Olympic Sports Center Stadium", cap_wiki=56808, wiki_total=417951),
 "shanghai-port":        dict(zh="上海海港", en="Shanghai Port", city="上海", league="CSL",
   stadium_zh="浦东足球场", stadium_en="Pudong Football Stadium", cap_wiki=37000, wiki_total=290697),
 "shanghai-shenhua":     dict(zh="上海申花", en="Shanghai Shenhua", city="上海", league="CSL",
   stadium_zh="上海体育场", stadium_en="Shanghai Stadium", cap_wiki=72436, wiki_total=562575),
 "shenzhen-peng-city":   dict(zh="深圳新鹏城", en="Shenzhen Peng City", city="深圳", league="CSL",
   stadium_zh="深圳市体育中心体育场", stadium_en="Shenzhen Sports Center Stadium", cap_wiki=45000, wiki_total=352880,
   venue_notes="第 27 轮(10-17)与第 30 轮(11-22)主场移至肇庆新区体育中心体育场（标称 20,000）举行。"),
 "tianjin-jinmen-tiger": dict(zh="天津津门虎", en="Tianjin Jinmen Tiger", city="天津", league="CSL",
   stadium_zh="泰达足球场", stadium_en="TEDA Soccer Stadium", cap_wiki=36390, wiki_total=376456,
   venue_notes="第 30 轮(11-22)主场移至天津奥林匹克中心体育场（标称 54,696）举行。"),
 "wuhan-three-towns":    dict(zh="武汉三镇", en="Wuhan Three Towns", city="武汉", league="CSL",
   stadium_zh="武汉体育中心体育场", stadium_en="Wuhan Sports Center", cap_wiki=56201, wiki_total=148207),
 "yunnan-yukun":         dict(zh="云南玉昆", en="Yunnan Yukun", city="玉溪", league="CSL",
   stadium_zh="玉溪高原体育运动中心体育场", stadium_en="Yuxi Plateau Sports Center Stadium", cap_wiki=30300, wiki_total=332630),
 "zhejiang":             dict(zh="浙江", en="Zhejiang FC", city="杭州", league="CSL",
   stadium_zh="黄龙体育中心体育场", stadium_en="Huanglong Sports Centre Stadium", cap_wiki=51971, wiki_total=382701),
 # 广州豹: 2025 中甲第 3；球场越秀山体育场(15 场 TM 均记于此)
 # 容量:维基 18,000(中文维基记 18,000–20,000) vs TM 30,000 → 冲突,双口径展示
 "guangdong-gz-power":   dict(zh="广东广州豹", en="Guangdong GZ-Power", city="广州", league="CL1",
   stadium_zh="越秀山体育场", stadium_en="Yuexiushan Stadium", cap_wiki=18000,
   cap_source="维基百科 Yuexiushan Stadium 词条（英文 18,000；中文 18,000–20,000）",
   cap_tm=30000, wiki_total=None,
   venue_notes="2025 赛季 15 个联赛主场 Transfermarkt 均记为越秀山体育场；中文维基称因十五运会有 1 场联赛主场移师花都体育场，待核实。",
   extra_note="2026 赛季中甲夺冠，升入 2027 中超（中文维基“广东广州豹足球俱乐部”词条，2026-10-11）。"),
 # 中甲其他球队:仅客队展示用(广州豹对手),无容量/排名数据
 "chongqing-tonglianglong": dict(zh="重庆铜梁龙", en="Chongqing Tonglianglong", city="重庆", league="CL1",
   stadium_zh=None, stadium_en=None, cap_wiki=None, wiki_total=None),
 "dalian-kun-city": dict(zh="大连鲲城", en="Dalian K'un City", city="大连", league="CL1",
   stadium_zh=None, stadium_en=None, cap_wiki=None, wiki_total=None),
 "dingnan-united": dict(zh="定南赣联", en="Dingnan United", city="定南", league="CL1",
   stadium_zh=None, stadium_en=None, cap_wiki=None, wiki_total=None),
 "foshan-nanshi": dict(zh="佛山南狮", en="Foshan Nanshi", city="佛山", league="CL1",
   stadium_zh=None, stadium_en=None, cap_wiki=None, wiki_total=None),
 "guangxi-pingguo": dict(zh="广西平果", en="Guangxi Pingguo", city="平果", league="CL1",
   stadium_zh=None, stadium_en=None, cap_wiki=None, wiki_total=None),
 "liaoning-tieren": dict(zh="辽宁铁人", en="Liaoning Tieren", city="沈阳", league="CL1",
   stadium_zh=None, stadium_en=None, cap_wiki=None, wiki_total=None),
 "nanjing-city": dict(zh="南京城市", en="Nanjing City", city="南京", league="CL1",
   stadium_zh=None, stadium_en=None, cap_wiki=None, wiki_total=None),
 "nantong-zhiyun": dict(zh="南通支云", en="Nantong Zhiyun", city="南通", league="CL1",
   stadium_zh=None, stadium_en=None, cap_wiki=None, wiki_total=None),
 "qingdao-red-lions": dict(zh="青岛红狮", en="Qingdao Red Lions", city="青岛", league="CL1",
   stadium_zh=None, stadium_en=None, cap_wiki=None, wiki_total=None),
 "shaanxi-union": dict(zh="陕西联合", en="Shaanxi Union", city="渭南", league="CL1",
   stadium_zh=None, stadium_en=None, cap_wiki=None, wiki_total=None),
 "shanghai-jiading-huilong": dict(zh="上海嘉定汇龙", en="Shanghai Jiading Huilong", city="上海", league="CL1",
   stadium_zh=None, stadium_en=None, cap_wiki=None, wiki_total=None),
 "shenzhen-juniors": dict(zh="深圳青年人", en="Shenzhen Juniors", city="深圳", league="CL1",
   stadium_zh=None, stadium_en=None, cap_wiki=None, wiki_total=None),
 "shijiazhuang-gongfu": dict(zh="石家庄功夫", en="Shijiazhuang Gongfu", city="石家庄", league="CL1",
   stadium_zh=None, stadium_en=None, cap_wiki=None, wiki_total=None),
 "suzhou-dongwu": dict(zh="苏州东吴", en="Suzhou Dongwu", city="苏州", league="CL1",
   stadium_zh=None, stadium_en=None, cap_wiki=None, wiki_total=None),
 "yanbian-longding": dict(zh="延边龙鼎", en="Yanbian Longding", city="延吉", league="CL1",
   stadium_zh=None, stadium_en=None, cap_wiki=None, wiki_total=None),
}

# 逐轮排名: tools/wiki_positions.json（维基百科 wikitext 解析，2026-10-11；
# 30 轮逐轮校验为 1..16 排列）。build 时再次校验。
def load_positions():
    doc = json.load(open(os.path.join(BASE, "tools", "wiki_positions.json"), encoding="utf-8"))
    pos = doc["positions"]
    for code, arr in pos.items():
        if len(arr) != 30:
            fail(f"排名表长度错误 {code}")
    for rnd in range(30):
        col = sorted(pos[c][rnd] for c in pos)
        if col != list(range(1, 17)):
            fail(f"第 {rnd+1} 轮排名不是 1..16 排列")
    return pos

POSITIONS = load_positions()

DERBIES = {
 frozenset(["shanghai-port", "shanghai-shenhua"]): ("上海德比", "同城德比"),
 frozenset(["beijing-guoan", "tianjin-jinmen-tiger"]): ("京津德比", "传统德比"),
 frozenset(["qingdao-hainiu", "qingdao-west-coast"]): ("青岛德比", "同城德比"),
 frozenset(["shandong-taishan", "qingdao-hainiu"]): ("齐鲁德比", "同省德比"),
 frozenset(["shandong-taishan", "qingdao-west-coast"]): ("齐鲁德比", "同省德比"),
}

WEEK_ZH = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"]

def load_raw(name):
    p = os.path.join(RAW, name)
    if not os.path.exists(p):
        fail(f"缺少 raw 数据: {name}（先运行 tools/fetch_tm.py）")
    return json.load(open(p, encoding="utf-8"))

def main():
    csl = load_raw("csl2025.json")
    cl1 = load_raw("cl1_2025.json")
    tm_cap_rows = json.load(open(os.path.join(RAW, "csl2025_tm_capacity.json"), encoding="utf-8"))
    tm_cap = {}
    for r in tm_cap_rows:
        code = {"Dalian Yingbo": "dalian-yingbo", "Beijing Guoan": "beijing-guoan",
                "Chengdu Rongcheng": "chengdu-rongcheng", "Shanghai Shenhua": "shanghai-shenhua",
                "Shandong Taishan": "shandong-taishan", "Zhejiang FC": "zhejiang",
                "Tianjin Jinmen Tiger": "tianjin-jinmen-tiger", "Shenzhen Peng City": "shenzhen-peng-city",
                "Qingdao Hainiu": "qingdao-hainiu", "Yunnan Yukun": "yunnan-yukun",
                "Shanghai Port": "shanghai-port", "Henan FC": "henan",
                "Qingdao West Coast": "qingdao-west-coast", "Meizhou Hakka": "meizhou-hakka",
                "Changchun Yatai": "changchun-yatai", "Wuhan Three Towns": "wuhan-three-towns"}.get(r["club"])
        if code:
            tm_cap[code] = r["capacity_tm"]

    # 校验排名表
    for code, pos in POSITIONS.items():
        if len(pos) != 30:
            fail(f"排名表长度错误 {code}")
    for rnd in range(30):
        col = sorted(POSITIONS[c][rnd] for c in POSITIONS)
        if col != list(range(1, 17)):
            fail(f"第 {rnd+1} 轮排名不是 1..16 排列: {col}")

    # 组装球队
    teams = {}
    for code, meta in TEAMS.items():
        t = dict(meta)  # 手工元数据
        t.setdefault("venue_notes", "")
        t.setdefault("cap_source", "维基百科 2025 CSL 词条")
        t.update(code=code, cap_tm=t.get("cap_tm", tm_cap.get(code)),
                 positions=POSITIONS.get(code))
        if meta.get("wiki_total"):
            t["wiki2025"] = {"total": meta["wiki_total"], "avg": round(meta["wiki_total"] / 15)}
        teams[code] = t

    def build_matches(raw_matches, league, season):
        out = []
        for rm in raw_matches:
            if not rm.get("home") or not rm.get("away"):
                fail(f"未映射球队: {rm.get('home_title')} vs {rm.get('away_title')}")
            rep = rm.get("report") or {}
            att = rep.get("attendance")
            if att == 0:
                att = None  # 0 人视为缺失,不冒充
            date = rep.get("date")
            if date:
                try:
                    d = datetime.strptime(date, "%Y-%m-%d")
                except ValueError:
                    fail(f"非法日期 {date}")
                wd = d.isoweekday() % 7  # 周日=0 .. 周六=6
                weekday_zh, weekend = WEEK_ZH[wd], wd in (0, 6)
            else:
                weekday_zh, weekend = None, None
            sc = (rm.get("score_raw") or "").replace(" ", "")
            sh, sa = (sc.split(":") + [None, None])[:2] if ":" in sc else (None, None)
            derby = DERBIES.get(frozenset([rm["home"], rm["away"]]))
            out.append({
                "id": f"{league.lower()}{season}-r{rm['round']:02d}-{rm['home']}-vs-{rm['away']}",
                "league": league, "season": season, "round": rm["round"],
                "date": date, "weekday_zh": weekday_zh, "weekend": weekend,
                "kickoff_raw": rep.get("kickoff_raw"),
                "kickoff_tz_verified": False,
                "home": rm["home"], "away": rm["away"],
                "score_h": int(sh) if sh and sh.isdigit() else None,
                "score_a": int(sa) if sa and sa.isdigit() else None,
                "stadium_tm": rep.get("stadium"),
                "attendance": att,
                "source": "transfermarkt",
                "source_url": rep.get("source_url"),
                "fetched_at": rep.get("fetched_at"),
                "derby": {"name": derby[0], "note": derby[1]} if derby else None,
            })
        # 衍生: 主队此前5场战绩 (按时间顺序)
        chrono = sorted([m for m in out if m["date"]], key=lambda m: (m["date"], m["round"]))
        form = {c: [] for c in teams}
        for m in chrono:
            m["home_form"] = "".join(form[m["home"]][-5:])
            m["away_form"] = "".join(form[m["away"]][-5:])
            if m["score_h"] is not None:
                rh = "W" if m["score_h"] > m["score_a"] else ("D" if m["score_h"] == m["score_a"] else "L")
                ra = "W" if m["score_a"] > m["score_h"] else ("D" if m["score_a"] == m["score_h"] else "L")
                form[m["home"]].append(rh)
                form[m["away"]].append(ra)
            # 赛前排名 (维基逐轮排名: positions[r-2] 为第 r 轮赛前)
            if m["league"] == "CSL" and m["round"] > 1:
                m["home_pos"] = POSITIONS[m["home"]][m["round"] - 2]
                m["away_pos"] = POSITIONS[m["away"]][m["round"] - 2]
            else:
                m["home_pos"] = m["away_pos"] = None
        return out

    csl_matches = build_matches(csl["matches"], "CSL", 2025)
    gz_matches = build_matches([m for m in cl1["matches"] if m["home"] == "guangdong-gz-power"],
                               "CL1", 2025)

    # ---- 校验 ----
    if len(csl_matches) != 240:
        fail(f"CSL 场次应为 240,实际 {len(csl_matches)}")
    if len(gz_matches) != 15:
        fail(f"广州豹主场应为 15,实际 {len(gz_matches)}")
    miss = [m["id"] for m in csl_matches if m["attendance"] is None]
    # 分队加总 vs 维基交叉
    xcheck = {}
    for code in TEAMS:
        if TEAMS[code]["league"] != "CSL":
            continue
        s = sum(m["attendance"] for m in csl_matches if m["home"] == code and m["attendance"])
        xcheck[code] = {"tm_sum": s, "wiki_total": TEAMS[code]["wiki_total"],
                        "diff": s - TEAMS[code]["wiki_total"]}
    bad = {c: v for c, v in xcheck.items() if v["diff"] != 0}
    total_att = sum(m["attendance"] for m in csl_matches if m["attendance"])

    failures = []
    fp = os.path.join(RAW, "_failures.json")
    if os.path.exists(fp):
        failures = json.load(open(fp, encoding="utf-8"))

    meta = {
        "product": "kantai", "season": 2025, "league": "CSL",
        "generated_at": NOW, "data_as_of": "2026-10-11",
        "pipeline": "tools/fetch_tm.py + tools/build_data.py",
        "sources": [
            {"name": "Transfermarkt 单场报告", "type": "第三方",
             "url": "https://www.transfermarkt.com",
             "provides": "逐场观众数/球场/日期", "accessed": "2026-10-11"},
            {"name": "维基百科 2025 Chinese Super League", "type": "第三方汇总",
             "url": "https://en.wikipedia.org/wiki/2025_Chinese_Super_League",
             "provides": "分队赛季总人次/球场标称容量/逐轮排名", "accessed": "2026-10-11"},
        ],
        "coverage": {"matches_total": 240, "matches_with_attendance": 240 - len(miss),
                     "missing_ids": miss, "total_attendance": total_att,
                     "avg_attendance": round(total_att / (240 - len(miss))) if miss else round(total_att / 240)},
        "crosscheck": {"per_team_tm_sum_vs_wiki": xcheck, "mismatches": bad,
                       "note": "Transfermarkt 逐场加总与维基分队汇总完全一致" if not bad else "存在差异,见 mismatches"},
        "definitions": {
            "nominal_share": "到场人数 ÷ 球场标称容量,页面称“标称容量占比”",
            "open_seat_rate": "到场人数 ÷ 本场实际开放座位数；开放座位数未知时不计算",
            "attendance": "Transfermarkt 单场报告的 Attendance 数字（第三方，非官方）",
        },
        "derby_note": "德比标签为人工整理（上海/京津/青岛/齐鲁德比），见 tools/build_data.py DERBIES",
        "failures": failures,
        "changelog": [
            {"date": "2026-10-11", "event": "首版数据：2025 中超 240 场 + 广州豹 2025 中甲 15 个主场，上线"},
        ],
    }

    demo = build_demo()

    os.makedirs(DATA, exist_ok=True)
    def w(name, obj):
        json.dump(obj, open(os.path.join(DATA, name), "w", encoding="utf-8"),
                  ensure_ascii=False, indent=1)
    w("meta.json", meta)
    w("teams.json", teams)
    w("matches_csl2025.json", csl_matches)
    w("matches_gzpower2025.json", gz_matches)
    w("demo.json", demo)

    # 内联数据包 (file:// 直接打开兜底)
    bundle = ("window.KANTAI_DATA = " + json.dumps(
        {"meta": meta, "teams": teams, "matches_csl2025": csl_matches,
         "matches_gzpower2025": gz_matches, "demo": demo}, ensure_ascii=False) + ";")
    open(os.path.join(BASE, "js", "data.bundle.js"), "w", encoding="utf-8").write(bundle)

    print(f"OK: CSL {len(csl_matches)} 场 (缺失 {len(miss)}), 广州豹 {len(gz_matches)} 场")
    print(f"总人次 {total_att}, 交叉验证差异球队数 {len(bad)}")
    if bad:
        print("DIFFS:", json.dumps(bad, ensure_ascii=False)[:500])

def build_demo():
    """明显虚构的演示数据:独立入口 + 条纹标识,不与真实数据混合。"""
    teams = {}
    for i, zh in enumerate(["演示·北区联队", "演示·南区联队", "演示·东区联队",
                            "演示·西区联队", "演示·中区联队", "演示·河畔联队"]):
        code = f"demo-team-{i+1}"
        teams[code] = {"code": code, "zh": zh, "en": f"Demo Team {i+1}",
                       "city": "演示市", "league": "DEMO",
                       "stadium_zh": f"演示体育场{chr(65+i)}", "stadium_en": f"Demo Stadium {chr(65+i)}",
                       "cap_wiki": 30000 + i * 5000, "cap_tm": 30000 + i * 5000,
                       "cap_source": "虚构", "venue_notes": "", "positions": None}
    import random
    random.seed(20261011)
    codes = list(teams)
    matches = []
    n = 0
    for rnd in range(1, 7):
        random.shuffle(codes)
        for h, a in zip(codes[::2], codes[1::2]):
            n += 1
            att = random.randint(8000, 38000) if random.random() > 0.15 else None
            matches.append({
                "id": f"demo2025-r{rnd:02d}-{h}-vs-{a}", "league": "DEMO", "season": 2025,
                "round": rnd, "date": f"2025-03-{rnd*3:02d}",
                "weekday_zh": "周六", "weekend": True, "kickoff_raw": None,
                "kickoff_tz_verified": False, "home": h, "away": a,
                "score_h": random.randint(0, 3), "score_a": random.randint(0, 3),
                "stadium_tm": teams[h]["stadium_en"], "attendance": att,
                "source": "demo", "source_url": None, "fetched_at": NOW,
                "derby": None, "home_form": "", "away_form": "",
                "home_pos": None, "away_pos": None})
    return {"meta": {"demo": True, "note": "虚构演示数据", "data_as_of": "演示"},
            "teams": teams, "matches": matches}

if __name__ == "__main__":
    main()
