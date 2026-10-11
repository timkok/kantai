#!/usr/bin/env python3
"""数据成品校验:独立于构建脚本,断言发布前的数据契约。

用法: python3 tests/check_data.py
失败时非零退出 (供 GitHub Actions 使用)。
"""
import json, os, sys
from datetime import datetime

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(BASE, "data")
errors = []

def check(cond, msg):
    if not cond:
        errors.append(msg)

def load(name):
    p = os.path.join(DATA, name)
    if not os.path.exists(p):
        check(False, f"缺少文件 {name}")
        return None
    return json.load(open(p, encoding="utf-8"))

meta = load("meta.json")
teams = load("teams.json")
csl = load("matches_csl2025.json")
gz = load("matches_gzpower2025.json")
demo = load("demo.json")

if csl is not None:
    check(len(csl) == 240, f"CSL 场次应为 240,实际 {len(csl) if csl else 0}")
    ids = [m["id"] for m in csl]
    check(len(set(ids)) == len(ids), "比赛 id 重复")
    for m in csl:
        if m["attendance"] is not None:
            check(m["attendance"] > 0, f"{m['id']} 观众数为 0(应记为缺失)")
            check(m["source_url"] and m["source_url"].startswith("http"),
                  f"{m['id']} 缺少来源链接")
            check(m["fetched_at"], f"{m['id']} 缺少抓取时间")
        if m["date"]:
            try:
                datetime.strptime(m["date"], "%Y-%m-%d")
            except ValueError:
                check(False, f"{m['id']} 非法日期 {m['date']}")
        check(m["home"] in teams and m["away"] in teams, f"{m['id']} 球队未收录")
        check(m["kickoff_tz_verified"] is False or m["kickoff_raw"] is None,
              f"{m['id']} 开球时间时区不应标记为已核实")
    # 每队主场 15 场
    from collections import Counter
    hc = Counter(m["home"] for m in csl)
    for code, n in hc.items():
        check(n == 15, f"{code} 主场 {n} 场(应为 15)")

if gz is not None:
    check(len(gz) == 15, f"广州豹主场应为 15,实际 {len(gz) if gz else 0}")
    check(all(m["home"] == "guangdong-gz-power" for m in gz), "广州豹数据混入非主场")

if teams is not None:
    for code, t in teams.items():
        if t.get("cap_wiki") is not None:
            check(t["cap_wiki"] > 5000, f"{code} 标称容量异常小")

if demo is not None:
    check(demo["meta"].get("demo") is True, "演示数据未标记 demo:true")
    check(all(m["league"] == "DEMO" for m in demo["matches"]), "演示数据联赛标记错误")

# 内联包存在且可解析
bp = os.path.join(BASE, "js", "data.bundle.js")
check(os.path.exists(bp) and os.path.getsize(bp) > 1000, "js/data.bundle.js 缺失或过小")

if errors:
    print("CHECKS FAILED:")
    for e in errors:
        print(" -", e)
    sys.exit(1)
print(f"checks passed: CSL {len(csl)} 场, 广州豹 {len(gz)} 场, 球队 {len(teams)} 支")
