#!/usr/bin/env python3
"""Living Colour Ltd - tiny static site generator (Python 3 stdlib only).

  python3 build.py          build src/ -> dist/ and check every internal link
  python3 build.py --zip    ...and write living-colour-site.zip (index.html at zip root)

Pages live in src/pages/*.html. Each starts with a front-matter comment:
  <!--
  title: Page title (<=60 chars)       description: meta description
  path: services/interior-painting/   (empty = home, 404.html = error page)
  h1 / eyebrow / lead / hero: inner-page hero (omit h1 for a custom hero)
  crumbs: Services|services/          (parents; the page itself is added from `crumb`)
  -->
Template tags: {{root}} relative path to site root, {{> partial}}, {{reviews:1,2}},
{{projects:1-9}}, {{projectlist:10-22}}, plus any front-matter key as {{key}}.
"""
import hashlib, html, json, os, re, shutil, sys, zipfile
from datetime import date

SITE = "https://www.livingcolourltd.co.nz"  # client to confirm final domain
BASE = os.path.dirname(os.path.abspath(__file__))
SRC, DIST = os.path.join(BASE, "src"), os.path.join(BASE, "dist")
DATA = {k: json.load(open(os.path.join(SRC, "data", k + ".json"), encoding="utf-8")) for k in ("reviews", "projects")}
REVIEWS = {r["id"]: r for r in DATA["reviews"]}
esc = html.escape
VER = hashlib.md5(b"".join(open(os.path.join(SRC, d, f), "rb").read() for d, f in (("css", "site.css"), ("js", "site.js")))).hexdigest()[:8]


def read(*p):
    return open(os.path.join(SRC, *p), encoding="utf-8").read()


def parse(fn):
    txt = read("pages", fn)
    m = re.match(r"\s*<!--(.*?)-->\s*", txt, re.S)
    meta = {}
    for line in m.group(1).strip().splitlines():
        k, _, v = line.partition(":")
        meta[k.strip()] = v.strip()
    meta.setdefault("path", "")
    return meta, txt[m.end():]


def ids(spec):
    out = []
    for part in spec.split(","):
        a, _, b = part.partition("-")
        out += range(int(a), int(b or a) + 1)
    return out


def review_card(r):
    return (f'<article class="review" id="review-{r["id"]}"><div class="stars" role="img" aria-label="5 out of 5 stars">'
            + '<svg class="ic"><use href="#i-star"/></svg>' * 5
            + f'</div><blockquote><p>{esc(r["text"])}</p></blockquote><footer><span class="avatar" aria-hidden="true">{r["name"][0]}</span>'
            f'<span class="who"><strong>{esc(r["name"])}</strong><small>{esc(r["suburb"])} &middot; {esc(r["job"])}</small></span>'
            f'<span class="src">Builderscrack<br>{esc(r["date"])}</span></footer></article>')


def short(text, n=120):
    s = re.split(r"(?<=[.!])\s", text)[0]
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + "..."


def project_card(p, photo=True):
    r = REVIEWS.get(p["review"])
    quote = (f'<a class="pquote" href="{{{{root}}}}reviews/#review-{r["id"]}">&ldquo;{esc(short(r["text"]))}&rdquo; '
             f'<span>{esc(r["name"])}, {esc(r["suburb"])}</span></a>') if r else ""
    media = (f'<div class="media"><img src="{{{{root}}}}img/{p["img"]}" alt="{esc(p["type"])} by Living Colour in {esc(p["suburb"])}" '
             f'loading="lazy" width="1200" height="900"><span class="tag">{esc(p["region"])}</span></div>') if photo else ""
    cls = "project" if photo else "project project-text"
    return (f'<article class="{cls}">{media}<div class="body"><p class="kicker">{esc(p["suburb"])}</p>'
            f'<h3>{esc(p["type"])}</h3><p>{esc(p["line"])}</p>{quote}</div></article>')


def expand(body, meta):
    for _ in range(4):
        body = re.sub(r"\{\{>\s*([\w-]+)\s*\}\}", lambda m: read("partials", m.group(1) + ".html"), body)
    body = re.sub(r"\{\{reviews:([\d,\-]+)\}\}", lambda m: "\n".join(review_card(REVIEWS[i]) for i in ids(m.group(1))), body)
    body = re.sub(r"\{\{projects:([\d,\-]+)\}\}", lambda m: "\n".join(project_card(DATA["projects"][i - 1]) for i in ids(m.group(1))), body)
    body = re.sub(r"\{\{projectlist:([\d,\-]+)\}\}", lambda m: "\n".join(project_card(DATA["projects"][i - 1], False) for i in ids(m.group(1))), body)
    return re.sub(r"\{\{(\w+)\}\}", lambda m: meta.get(m.group(1), m.group(0)), body)


def crumbs(meta):
    items = [("Home", "")]
    for c in filter(None, meta.get("crumbs", "").split(">")):
        label, _, path = c.strip().partition("|")
        items.append((label, path))
    items.append((meta.get("crumb") or meta.get("h1", ""), meta["path"]))
    return items


def schema(meta, body):
    out, url = [], SITE + "/" + meta["path"]
    if meta["path"] == "":
        out.append(json.loads(read("data", "business.json")))
    elif meta["path"] != "404.html":
        out.append({"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "name": n, "item": SITE + "/" + p} for i, (n, p) in enumerate(crumbs(meta))]})
    if meta.get("service"):
        out.append({"@context": "https://schema.org", "@type": "Service", "serviceType": meta["service"], "name": meta["service"],
                    "description": meta["description"], "url": url, "areaServed": ["Auckland", "Wellington"],
                    "provider": {"@type": "HousePainter", "name": "Living Colour Ltd", "telephone": "+64212668689", "url": SITE + "/"}})
    if meta.get("faqschema"):
        qa = re.findall(r'<details class="faq[^"]*">\s*<summary>(.*?)</summary>\s*<div class="faq-a">(.*?)</div>', body, re.S)
        strip = lambda s: re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", s)).strip()
        out.append({"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
            {"@type": "Question", "name": html.unescape(strip(q)), "acceptedAnswer": {"@type": "Answer", "text": html.unescape(strip(a))}} for q, a in qa]})
    return "\n".join(f'<script type="application/ld+json">{json.dumps(o, ensure_ascii=False)}</script>' for o in out)


def render(meta, body):
    path = meta["path"]
    depth = path.count("/")
    meta["root"] = "/" if path == "404.html" else ("../" * depth or "./")
    meta["canonical"] = SITE + "/" + ("" if path == "404.html" else path)
    meta["robots"] = "noindex, follow" if meta.get("noindex") else "index, follow"
    meta["ver"] = VER
    meta["section"] = path.split("/")[0] or "home"
    meta.setdefault("hero_alt", "")
    hero = ""
    if meta.get("h1"):
        cr = crumbs(meta)
        lis = "".join(f'<li><a href="{{{{root}}}}{p}">{esc(n)}</a></li>' for n, p in cr[:-1])
        meta["breadcrumb"] = lis + f'<li aria-current="page">{esc(cr[-1][0])}</li>'
        hero = read("partials", "page-hero.html")
    content = hero + body + ("" if meta.get("cta") == "no" else "{{> cta}}")
    page = read("partials", "layout.html").replace("{{content}}", content)
    page = expand(page, meta)
    page = page.replace("{{schema}}", schema(meta, page))
    page = page.replace(f'href="{meta["root"]}{path}" class="nav-link"', f'href="{meta["root"]}{path}" class="nav-link" aria-current="page"')
    return expand(page, meta)


def check_links():
    bad = 0
    for dp, _, fs in os.walk(DIST):
        for f in fs:
            if not f.endswith(".html"):
                continue
            fp = os.path.join(dp, f)
            src = open(fp, encoding="utf-8").read()
            for ref in re.findall(r'(?:href|src)="([^"]+)"', src):
                if re.match(r"^(https?:|mailto:|tel:|data:|#)", ref) or f == "404.html":
                    continue
                target, _, frag = ref.partition("#")
                target = target.split("?")[0]
                t = os.path.normpath(os.path.join(DIST, target.lstrip("/")) if target.startswith("/") else os.path.join(dp, target))
                if os.path.isdir(t):
                    t = os.path.join(t, "index.html")
                if not os.path.exists(t):
                    bad += 1; print(f"  BROKEN {os.path.relpath(fp, DIST)} -> {ref}")
                elif frag and f'id="{frag}"' not in open(t, encoding="utf-8", errors="ignore").read():
                    bad += 1; print(f"  MISSING #{frag} {os.path.relpath(fp, DIST)} -> {ref}")
            for tag in ("section", "div", "article", "ul", "nav", "details", "form", "a", "p"):
                o, c = len(re.findall(rf"<{tag}[\s>]", src)), src.count(f"</{tag}>")
                if o != c:
                    bad += 1; print(f"  UNBALANCED <{tag}> {o}/{c} in {os.path.relpath(fp, DIST)}")
    return bad


def main():
    shutil.rmtree(DIST, ignore_errors=True)
    os.makedirs(DIST)
    for d in ("css", "js", "img"):
        shutil.copytree(os.path.join(SRC, d), os.path.join(DIST, d))
    for f in os.listdir(os.path.join(SRC, "static")):
        shutil.copy(os.path.join(SRC, "static", f), DIST)
    urls = []
    for fn in sorted(os.listdir(os.path.join(SRC, "pages"))):
        meta, body = parse(fn)
        out = os.path.join(DIST, meta["path"] if meta["path"].endswith(".html") else os.path.join(meta["path"], "index.html"))
        os.makedirs(os.path.dirname(out), exist_ok=True)
        open(out, "w", encoding="utf-8").write(render(meta, body))
        if not meta.get("noindex"):
            urls.append((meta["path"], meta.get("priority", "0.7")))
        print(f"  built /{meta['path']}")
    today = date.today().isoformat()
    sm = "".join(f"<url><loc>{SITE}/{p}</loc><lastmod>{today}</lastmod><priority>{pr}</priority></url>\n" for p, pr in urls)
    open(os.path.join(DIST, "sitemap.xml"), "w").write(
        f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{sm}</urlset>\n')
    open(os.path.join(DIST, "robots.txt"), "w").write(f"User-agent: *\nAllow: /\nDisallow: /thanks/\n\nSitemap: {SITE}/sitemap.xml\n")
    bad = check_links()
    print(f"{len(urls)} indexable pages, {'no broken links' if not bad else str(bad) + ' problems'}")
    if "--zip" in sys.argv:
        zp = os.path.join(BASE, "living-colour-site.zip")
        with zipfile.ZipFile(zp, "w", zipfile.ZIP_DEFLATED) as z:
            for dp, _, fs in os.walk(DIST):
                for f in fs:
                    z.write(os.path.join(dp, f), os.path.relpath(os.path.join(dp, f), DIST))
        print("wrote", zp)
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
