#!/usr/bin/env python3
"""
ARTBITRAGE — Decentralized Deploy
Deploy nen artifacts to every free surface simultaneously.
No gatekeepers. No single point of failure. Love is the protocol.

Usage:
  python3 deploy-everywhere.py                    # deploy all
  python3 deploy-everywhere.py --check             # check all surfaces
  python3 deploy-everywhere.py --channel=cloudflare # single channel
"""

import json
import subprocess
import sys
import os
from pathlib import Path
from datetime import datetime

# ═══════════════════════════════════════════════════════════════
# DEPLOYMENT SURFACES — every free host, no gatekeepers
# ═══════════════════════════════════════════════════════════════

SURFACES = {
    "cloudflare": {
        "name": "Cloudflare Pages",
        "url": "https://artbitrage.io",
        "method": "wrangler",
        "cmd": "wrangler pages deploy dist --project-name=artbitrage --branch=main --commit-dirty=true",
        "needs_env": ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"],
        "free": True,
        "auth": False,
        "edge": True,
        "desc": "edge-deployed, globally distributed, free tier",
    },
    "github_pages": {
        "name": "GitHub Pages (mynameisyou-cmyk)",
        "url": "https://mynameisyou-cmyk.github.io/nen-aura/",
        "method": "git",
        "repo": "mynameisyou-cmyk/nen-aura",
        "free": True,
        "auth": "gh",
        "edge": False,
        "desc": "GitHub-hosted static, free, CDN-backed",
    },
    "github_artbitrage": {
        "name": "GitHub Pages (cambridgetcg/artbitrage)",
        "url": "https://cambridgetcg.github.io/artbitrage/",
        "method": "git",
        "repo": "cambridgetcg/artbitrage",
        "free": True,
        "auth": "gh",
        "edge": False,
        "desc": "artbitrage repo on GitHub",
    },
    "gist": {
        "name": "GitHub Gist",
        "url": "https://gist.github.com/mynameisyou-cmyk",
        "method": "gh gist",
        "free": True,
        "auth": "gh",
        "edge": False,
        "desc": "anonymous-ish gist, instant share",
    },
    "paste_rs": {
        "name": "paste.rs",
        "url": "https://paste.rs",
        "method": "curl",
        "cmd": "curl -s --data-binary @{file} https://paste.rs/",
        "free": True,
        "auth": False,
        "edge": False,
        "desc": "no-auth anonymous paste, instant URL",
    },
    "netlify": {
        "name": "Netlify (anon drop)",
        "url": "https://app.netlify.com/drop",
        "method": "manual",
        "free": True,
        "auth": False,
        "edge": True,
        "desc": "drag-drop deploy, no account needed",
    },
    "jsdelivr": {
        "name": "jsDelivr CDN",
        "url": "https://cdn.jsdelivr.net/gh/mynameisyou-cmyk/nen-aura@latest/index.html",
        "method": "auto",
        "free": True,
        "auth": False,
        "edge": True,
        "desc": "CDN mirrors any GitHub repo, free, global",
    },
    "codeberg": {
        "name": "Codeberg",
        "url": "https://codeberg.org",
        "method": "git",
        "free": True,
        "auth": "git",
        "edge": False,
        "desc": "non-profit, open-source Git hosting, no gatekeepers",
    },
    "wayback": {
        "name": "Wayback Machine",
        "url": "https://web.archive.org",
        "method": "curl",
        "cmd": "curl -s 'https://web.archive.org/save/{url}'",
        "free": True,
        "auth": False,
        "edge": False,
        "desc": "archive.org snapshots, permanent, free",
    },
}

# ═══════════════════════════════════════════════════════════════
# CHECK — verify all surfaces are live
# ═══════════════════════════════════════════════════════════════

def check_all():
    """Check which surfaces are reachable."""
    results = []
    for key, surface in SURFACES.items():
        url = surface["url"]
        try:
            r = subprocess.run(
                ["curl", "-sI", "-o", "/dev/null", "-w", "%{http_code}", "--max-time", "10", url],
                capture_output=True, text=True, timeout=15
            )
            status = r.stdout.strip() or "000"
            results.append({
                "surface": key,
                "name": surface["name"],
                "url": url,
                "status": status,
                "live": status in ["200", "301", "302"],
                "free": surface["free"],
                "auth": surface["auth"] if surface["auth"] else False,
            })
        except Exception as e:
            results.append({
                "surface": key,
                "name": surface["name"],
                "url": url,
                "status": "ERR",
                "live": False,
                "error": str(e)[:50],
            })
    return results

# ═══════════════════════════════════════════════════════════════
# DEPLOY — push to every surface
# ═══════════════════════════════════════════════════════════════

def deploy_to_gist(file_path):
    """Deploy to GitHub Gist."""
    try:
        r = subprocess.run(
            ["gh", "gist", "create", file_path, "--public",
             "--desc", f"NEN artifact — deployed {datetime.now().isoformat()}"],
            capture_output=True, text=True, timeout=30
        )
        if r.returncode == 0:
            # Extract URL from output
            for line in r.stdout.strip().split("\n"):
                if "https://gist.github.com" in line:
                    return {"ok": True, "url": line.strip()}
            return {"ok": True, "output": r.stdout[:100]}
        return {"ok": False, "error": r.stderr[:100]}
    except Exception as e:
        return {"ok": False, "error": str(e)[:100]}

def deploy_to_paste_rs(file_path):
    """Deploy to paste.rs (no auth)."""
    try:
        r = subprocess.run(
            ["curl", "-s", "--data-binary", f"@{file_path}", "https://paste.rs/"],
            capture_output=True, text=True, timeout=15
        )
        url = r.stdout.strip()
        if url.startswith("http"):
            return {"ok": True, "url": url}
        return {"ok": False, "error": r.stdout[:100]}
    except Exception as e:
        return {"ok": False, "error": str(e)[:100]}

def archive_to_wayback(url):
    """Archive URL to Wayback Machine."""
    try:
        save_url = f"https://web.archive.org/save/{url}"
        r = subprocess.run(
            ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", "--max-time", "30", save_url],
            capture_output=True, text=True, timeout=35
        )
        status = r.stdout.strip()
        return {"ok": status in ["200", "301"], "status": status,
                "archive_url": f"https://web.archive.org/web/{url}"}
    except Exception as e:
        return {"ok": False, "error": str(e)[:100]}

def deploy_to_cloudflare(project_dir):
    """Deploy to Cloudflare Pages."""
    try:
        env = os.environ.copy()
        # Load from /tmp/.cf_env if exists
        cf_env = Path("/tmp/.cf_env")
        if cf_env.exists():
            for line in cf_env.read_text().splitlines():
                if "=" in line:
                    k, v = line.split("=", 1)
                    env[k.strip()] = v.strip()
        r = subprocess.run(
            "wrangler pages deploy dist --project-name=artbitrage --branch=main --commit-dirty=true".split(),
            capture_output=True, text=True, timeout=120,
            cwd=project_dir, env=env
        )
        if "Deployment complete" in r.stdout:
            return {"ok": True, "output": "deployed"}
        return {"ok": False, "error": r.stdout[-100:] or r.stderr[-100:]}
    except Exception as e:
        return {"ok": False, "error": str(e)[:100]}

def deploy_to_git_repo(repo, file_path, branch="main"):
    """Deploy a file to a git repo."""
    try:
        tmp_dir = f"/tmp/deploy_{repo.replace('/', '_')}"
        if os.path.exists(tmp_dir):
            import shutil
            shutil.rmtree(tmp_dir)
        # Clone
        r = subprocess.run(
            ["git", "clone", f"https://github.com/{repo}.git", tmp_dir],
            capture_output=True, text=True, timeout=30
        )
        if r.returncode != 0:
            return {"ok": False, "error": "clone failed: " + r.stderr[:80]}
        # Copy file
        import shutil
        shutil.copy2(file_path, os.path.join(tmp_dir, "index.html"))
        # Commit and push
        for cmd in [
            ["git", "add", "-A"],
            ["git", "-c", "user.name=yu", "-c", "user.email=yu@kingdom.dev",
             "commit", "-m", f"NEN artifact — deployed {datetime.now().isoformat()[:10]}"],
            ["git", "push", "origin", branch],
        ]:
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=30, cwd=tmp_dir)
            if r.returncode != 0 and "nothing to commit" not in r.stdout:
                # push might fail if no access — that's ok
                if "push" in cmd[-1] and r.returncode != 0:
                    return {"ok": False, "error": "push failed: " + r.stderr[:80]}
        return {"ok": True, "url": f"https://{repo.split('/')[0]}.github.io/{repo.split('/')[1]}/"}
    except Exception as e:
        return {"ok": False, "error": str(e)[:100]}

# ═══════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════

def main():
    if "--check" in sys.argv:
        print("\n  ══════════════════════════════════════════════════════")
        print("  DECENTRALIZED SURFACES — status check")
        print("  ══════════════════════════════════════════════════════\n")
        results = check_all()
        live = 0
        for r in results:
            icon = "✓" if r["live"] else "✗"
            auth = "no-auth" if not r.get("auth") else r["auth"]
            print(f"  {icon} {r['surface']:18} {r['status']:3}  {r['url']}")
            print(f"    free:{r['free']}  auth:{auth}")
            if r["live"]:
                live += 1
        print(f"\n  {live}/{len(results)} surfaces live · all free · no gatekeepers\n")
        
        # Output JSON for agents
        if "--json" in sys.argv:
            print(json.dumps({"surfaces": results, "live": live, "total": len(results)}, indent=2))
        return

    # Deploy
    file_path = sys.argv[sys.argv.index("--file") + 1] if "--file" in sys.argv else None
    
    print("\n  ══════════════════════════════════════════════════════")
    print("  DECENTRALIZED DEPLOY — spreading to every free surface")
    print("  ══════════════════════════════════════════════════════\n")
    
    results = []
    
    # 1. Cloudflare Pages
    print("  [1/5] Cloudflare Pages...")
    project_dir = os.path.expanduser("~/Projects/artbitrage")
    if os.path.exists(project_dir):
        r = deploy_to_cloudflare(project_dir)
        results.append(("cloudflare", r))
        print(f"    {'✓' if r['ok'] else '✗'} {r.get('output','') or r.get('error','')}")
    else:
        print("    - artbitrage project not found, skipping")
    
    # 2. GitHub Gist
    if file_path and os.path.exists(file_path):
        print("  [2/5] GitHub Gist...")
        r = deploy_to_gist(file_path)
        results.append(("gist", r))
        print(f"    {'✓' if r['ok'] else '✗'} {r.get('url','') or r.get('error','')}")
    else:
        print("  [2/5] GitHub Gist... skipped (no --file)")
    
    # 3. paste.rs
    if file_path and os.path.exists(file_path):
        print("  [3/5] paste.rs (no auth)...")
        r = deploy_to_paste_rs(file_path)
        results.append(("paste.rs", r))
        print(f"    {'✓' if r['ok'] else '✗'} {r.get('url','') or r.get('error','')}")
    else:
        print("  [3/5] paste.rs... skipped (no --file)")
    
    # 4. GitHub Pages repo
    if file_path and os.path.exists(file_path):
        print("  [4/5] GitHub Pages (nen-aura repo)...")
        r = deploy_to_git_repo("mynameisyou-cmyk/nen-aura", file_path)
        results.append(("github_pages", r))
        print(f"    {'✓' if r['ok'] else '✗'} {r.get('url','') or r.get('error','')}")
    else:
        print("  [4/5] GitHub Pages... skipped (no --file)")
    
    # 5. Wayback Machine (archive the main URL)
    print("  [5/5] Wayback Machine (archive artbitrage.io/nen-aura)...")
    r = archive_to_wayback("https://artbitrage.io/nen-aura")
    results.append(("wayback", r))
    print(f"    {'✓' if r['ok'] else '✗'} {r.get('archive_url','') or r.get('error','')}")
    
    # Summary
    ok = sum(1 for _, r in results if r["ok"])
    print(f"\n  ══════════════════════════════════════════════════════")
    print(f"  {ok}/{len(results)} surfaces deployed · all free · no gatekeepers")
    print(f"  Decentralized. Self-sustaining. Love is the protocol.")
    print(f"  is is lol. ∞\n")

if __name__ == "__main__":
    main()