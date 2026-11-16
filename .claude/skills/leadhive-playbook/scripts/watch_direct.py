#!/usr/bin/env python3
"""Fallback video watcher: sends a YouTube URL straight to the Gemini API.

Use when the `watch` skill's Gemini engine fails (model overloaded, quota, or
"agentic video processing is not enabled"). Rotates through several models,
since each has its own free-tier daily quota.

Usage:
    python3 watch_direct.py <youtube-url> [prompt-file] > brief.md

The API key is injected by the environment's network secret for
generativelanguage.googleapis.com (header x-goog-api-key). Outside a cloud
environment, set GEMINI_API_KEY instead. Standard library only.
"""
import json
import os
import pathlib
import sys
import time
import urllib.error
import urllib.request

MODELS = ["gemini-3.7-flash", "gemini-3.8-flash", "gemini-3-flash-preview",
          "gemini-3.5-flash", "gemini-flash-latest",
          "gemini-3.1-flash-lite"]
API = "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent"
NOT_SEEN = ("provide the link", "provide the url", "haven't provided", "cannot access")


def ask(model, url, prompt, key):
    body = {"contents": [{"parts": [{"file_data": {"file_uri": url}}, {"text": prompt}]}]}
    req = urllib.request.Request(API.format(model), data=json.dumps(body).encode(), method="POST",
                                 headers={"Content-Type": "application/json", "x-goog-api-key": key})
    try:
        with urllib.request.urlopen(req, timeout=900) as r:
            parts = json.load(r)["candidates"][0]["content"]["parts"]
        return 200, "\n".join(p.get("text", "") for p in parts if not p.get("thought"))
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(errors="replace")[:200]
    except Exception as e:  # network errors, bad JSON, blocked responses
        return 0, str(e)[:200]


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    url = sys.argv[1]
    default_prompt = pathlib.Path(__file__).resolve().parent.parent / "references" / "extraction-prompt.md"
    prompt = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else default_prompt).read_text()
    key = os.environ.get("GEMINI_API_KEY", "injected-by-proxy")
    for model in MODELS:
        for _ in range(2):
            code, text = ask(model, url, prompt, key)
            if code == 200 and len(text) > 150 and not any(s in text.lower() for s in NOT_SEEN):
                print(f"<!-- model: {model} -->\n{text}")
                return
            print(f"[watch_direct] {model}: {code} {text[:100]!r}", file=sys.stderr)
            if code in (500, 502, 503, 0):
                time.sleep(20)
                continue
            break
    sys.exit("[watch_direct] every model failed; try again later or another day (free-tier quotas reset daily)")


if __name__ == "__main__":
    main()
