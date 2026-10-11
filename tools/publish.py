#!/usr/bin/env python3
"""发布 kantai 到全新的 GitHub 仓库 timkok/kantai 并启用 Pages。

全新仓库，不触碰 timkok/china-football-dashboard
与 timkok/china-football-dashboard-codex-export。
文件通过 Contents API 逐个创建（仓库新建空仓，无需 SHA）。

用法: python3 tools/publish.py [--dry-run]
"""
import json, os, subprocess, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GHAPI = os.path.expanduser("~/workspace/skills/github/bin/ghapi.py")
OWNER, REPO = "timkok", "kantai"

FILES = [
    "index.html", "match.html", "team.html", "compare.html", "data.html",
    "css/style.css",
    "js/store.js", "js/charts.js", "js/app.js", "js/data.bundle.js",
    "data/meta.json", "data/teams.json", "data/matches_csl2025.json",
    "data/matches_gzpower2025.json", "data/demo.json",
    "tools/fetch_tm.py", "tools/build_data.py", "tools/publish.py",
    "tools/wiki_positions.json",
    "tests/check_data.py",
    ".github/workflows/update-data.yml",
    ".nojekyll",
    "README.md", ".gitignore",
]

def api(method, path, body=None, file_path=None, message=None, sha=None, full=False):
    cmd = ["python3", GHAPI, method, path]
    if full:
        cmd.append("--no-truncate")
    if file_path:
        cmd += ["--file", file_path, "--message", message or f"add {file_path}"]
        if sha:
            cmd += ["--sha", sha]
    elif body is not None:
        cmd += [json.dumps(body, ensure_ascii=False)]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=90)
    lines = r.stdout.strip().split("\n", 1)
    status = int(lines[0].split()[1])
    payload = {}
    if len(lines) > 1:
        try:
            payload = json.loads(lines[1])  # ghapi 默认截断长响应,解析失败则忽略
        except json.JSONDecodeError:
            payload = {"_truncated": True}
    return status, payload

def get_sha(f):
    s, r = api("GET", f"/repos/{OWNER}/{REPO}/contents/{f}?ref=main", full=True)
    if s == 200 and isinstance(r, dict) and r.get("sha"):
        return r["sha"]
    return None

def put_file(f, p):
    sha = get_sha(f)
    return api("PUT", f"/repos/{OWNER}/{REPO}/contents/{f}",
               file_path=p, message=f"site: {f}", sha=sha)

def main():
    dry = "--dry-run" in sys.argv
    # 1. 仓库是否存在
    s, _ = api("GET", f"/repos/{OWNER}/{REPO}")
    if s == 404:
        print(f"仓库 {OWNER}/{REPO} 不存在，准备新建")
        if not dry:
            s, r = api("POST", "/user/repos", {
                "name": REPO,
                "description": "看台 KANTAI · 中国职业足球上座观察（独立产品）",
                "private": False, "auto_init": False})
            if s not in (200, 201):
                sys.exit(f"建仓失败: {s} {r}")
            print("建仓成功")
    elif s == 200:
        print(f"仓库 {OWNER}/{REPO} 已存在（应为本脚本此前创建），继续增量推送")
    else:
        sys.exit(f"检查仓库失败: {s}")

    # 2. 推送文件
    for f in FILES:
        p = os.path.join(BASE, f)
        if not os.path.exists(p):
            print(f"  跳过缺失文件: {f}")
            continue
        if dry:
            print(f"  [dry] {f}")
            continue
        s, r = put_file(f, p)
        if s == 404 and f.startswith(".github/workflows/"):
            print(f"  跳过 {f}: 凭证缺少 workflow 权限 (404)，后续可手动添加")
            continue
        if s not in (200, 201):
            sys.exit(f"推送失败 {f}: {s} {r}")
        print(f"  已推送 {f}")

    # 3. 启用 Pages
    if not dry:
        s, r = api("POST", f"/repos/{OWNER}/{REPO}/pages",
                   {"build_type": "legacy", "source": {"branch": "main", "path": "/"}})
        if s in (200, 201):
            print("Pages 已启用")
        else:
            # 可能已启用
            s2, r2 = api("GET", f"/repos/{OWNER}/{REPO}/pages")
            print(f"Pages 状态查询: {s2} {json.dumps(r2, ensure_ascii=False)[:200]}")
    print(f"完成: https://{OWNER}.github.io/{REPO}/")

if __name__ == "__main__":
    main()
