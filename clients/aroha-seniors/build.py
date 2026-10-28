#!/usr/bin/env python3
"""Build the Aroha Seniors Charitable Trust website.

    python3 build.py

Reads src/ (layout, pages, styles, script) and writes:

  site/     The real website: one HTML file per page, sharing site/assets/.
            Upload this whole folder to any host (Netlify, Lovable, cPanel...).
  preview/  The same pages, each fully self-contained (styles, script and
            images inlined), so any single file can be opened or shared on its own.

Contact details, bank account, form endpoint and the footer credit live in CONFIG.
Photos: put a JPG in site/assets/img/ named after its slot (see README) and rebuild.
Standard library only.
"""
import base64
import datetime
import html
import json
import mimetypes
import re
import shutil
from pathlib import Path

CONFIG = {
    'contact_name': 'Amelia Kolio',
    'contact_role': 'Your first point of contact',      # e.g. 'Founder & Chairperson' once confirmed
    'phone': '022 178 0876',
    'phone_intl': '+64221780876',
    'email': 'amelia_asct@outlook.com',
    'facebook': 'https://www.facebook.com/profile.php?id=61593305327062',
    'kai_name': 'Korina Grace',          # Kai Manager: Meals on Wheels orders
    'kai_role': 'Kai Manager',
    'kai_phone': '022 605 2361',
    'kai_phone_intl': '+64226052361',
    'site_url': 'https://arohaseniorscharitabletrust.com',   # live domain (bought on Cloudflare 27/10/2026)
    'netlify_host': 'aroha-seniors-preview.netlify.app',      # Netlify's own address for the site: 301s to site_url
    'indexnow_key': '7f82489049f8134898653b21c9599bcc',       # IndexNow (Bing etc.): served as /<key>.txt
    'charity_no': 'CC63126',
    'register_url': 'https://register.charities.govt.nz/Charity/CC63126',
    'tagline': 'To serve with Aroha',
    'bank_account': '',          # e.g. '12-3456-0123456-00'. Blank shows "Request our bank details"
    'bank_name': 'Aroha Seniors Charitable Trust',
    'donee_status': False,       # True only once IRD approves donee status (shows the 33.33% tax credit line)
    'netlify_forms': True,       # forms post to Netlify Forms when the site is served from Netlify (see README)
    'form_endpoint': '',         # optional JSON POST URL; overrides Netlify. With neither, forms open the visitor's email app
    'credit': ('Website by LeadHive', 'https://leadhivenz.co'),   # set to None to remove
}

SITE_NAME = 'Aroha Seniors Charitable Trust'
PAGES = [
    # file, nav key, <title> (keep under ~60 characters so Google shows it whole), meta description
    ('index', 'home', 'Aroha Seniors Charitable Trust | Seniors Charity in Auckland',
     'Aroha Seniors Charitable Trust is a registered charity in Flat Bush, Auckland: friendship, outings, Meals on Wheels and support for older people and kaumātua.'),
    ('about', 'about', 'About Aroha Seniors Charitable Trust | Flat Bush, Auckland',
     'Meet Aroha Seniors Charitable Trust, a registered charity (CC63126) in Flat Bush, Auckland. Our story, our values and the people behind our mahi.'),
    ('what-we-do', 'what-we-do', 'Support for Older People in South Auckland | Aroha Seniors',
     'Friendship gatherings, fortnightly Meals on Wheels, outings, companionship, advice and disability support for older people in Flat Bush and South Auckland.'),
    ('get-involved', 'get-involved', f'Volunteer, Donate or Partner | {SITE_NAME}',
     'Volunteer, donate or partner with Aroha Seniors Charitable Trust in Auckland, and help make sure no older person in our community is left alone.'),
    ('contact', 'contact', 'Contact Aroha Seniors Charitable Trust | Flat Bush, Auckland',
     'Contact Aroha Seniors Charitable Trust in Flat Bush, Auckland. Call or text Amelia on 022 178 0876, or Korina on 022 605 2361 for Meals on Wheels.'),
    ('policies', 'policies', f'Our Policies | {SITE_NAME}',
     'Public policies of Aroha Seniors Charitable Trust: privacy, client rights, safeguarding, elder abuse prevention, complaints, and donations and koha.'),
    ('404', '404', f'Page not found | {SITE_NAME}', 'Sorry, we can\'t find that page.'),
]
NOINDEX = {'404'}                       # built for the live site only, kept out of search and the sitemap
CRUMB = {'about': 'About us', 'what-we-do': 'What we do', 'get-involved': 'Get involved',
         'contact': 'Contact', 'policies': 'Our policies'}

ROOT = Path(__file__).resolve().parent
SRC, SITE, PREVIEW = ROOT / 'src', ROOT / 'site', ROOT / 'preview'
IMG = SITE / 'assets' / 'img'
DOCS = SITE / 'assets' / 'docs'    # downloadable files (the trust's policies PDF)


def data_uri(path):
    mime = mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
    return f'data:{mime};base64,{base64.b64encode(path.read_bytes()).decode()}'


def blocks(c):
    e = html.escape
    if c['bank_account']:
        bank = (f'<div class="bank"><b>Account name</b>{e(c["bank_name"])}<br><b style="margin-top:.6rem">Account number</b>'
                f'<code>{e(c["bank_account"])}</code></div>\n          <p>Please use your name as the reference. Email us if you\'d like a receipt.</p>\n'
                f'          <a class="btn btn-light" href="mailto:{e(c["email"])}?subject=Donation">Email us about your gift</a>')
    else:
        bank = ('<p>The simplest way to give. Get in touch and we\'ll send you our bank details, plus a receipt for your records.</p>\n'
                '          <a class="btn btn-light" href="get-involved.html?i=Donate#interest">Request our bank details</a>')
    tax = ('<p class="tax">Donations of $5 or more may be eligible for a 33.33% tax credit from Inland Revenue.</p>'
           if c['donee_status'] else '')
    credit = (f'<span><a href="{e(c["credit"][1])}" target="_blank" rel="noopener">{e(c["credit"][0])}</a></span>'
              if c['credit'] else '')
    return bank, tax, credit


def json_ld(c, page):
    site = c['site_url']
    if page == 'index':
        org = {
            '@type': 'NGO', '@id': site + '/#org', 'name': SITE_NAME,
            'alternateName': ['Aroha Seniors', 'Aroha Seniors Group', 'ASCT'],
            'slogan': c['tagline'],
            'description': 'A registered New Zealand charity in Flat Bush, Auckland, bringing older people, kaumātua, vulnerable adults and adults living with disability together for friendship, outings, Meals on Wheels, companionship, advice and support.',
            'url': site + '/',
            'logo': {'@type': 'ImageObject', 'url': site + '/assets/img/logo-full.jpg', 'width': 760, 'height': 738},
            'image': site + '/assets/img/banner.jpg',
            'telephone': c['phone_intl'], 'email': c['email'],
            'address': {'@type': 'PostalAddress', 'addressLocality': 'Flat Bush', 'addressRegion': 'Auckland', 'addressCountry': 'NZ'},
            'areaServed': [{'@type': 'Place', 'name': n} for n in ('Flat Bush, Auckland', 'South Auckland', 'East Auckland')]
                          + [{'@type': 'City', 'name': 'Auckland'}],
            'contactPoint': [
                {'@type': 'ContactPoint', 'name': c['contact_name'], 'telephone': c['phone_intl'], 'email': c['email'], 'contactType': 'general enquiries', 'areaServed': 'NZ'},
                {'@type': 'ContactPoint', 'name': c['kai_name'], 'telephone': c['kai_phone_intl'], 'contactType': 'Meals on Wheels orders', 'areaServed': 'NZ'},
            ],
            'identifier': {'@type': 'PropertyValue', 'propertyID': 'NZ Charities Register', 'value': c['charity_no']},
            'sameAs': [c['facebook'], c['register_url']],
        }
        website = {'@type': 'WebSite', '@id': site + '/#website', 'url': site + '/', 'name': SITE_NAME,
                   'alternateName': 'Aroha Seniors', 'inLanguage': 'en-NZ', 'publisher': {'@id': site + '/#org'}}
        data = {'@context': 'https://schema.org', '@graph': [website, org]}
    elif page in CRUMB:
        data = {'@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
            {'@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': site + '/'},
            {'@type': 'ListItem', 'position': 2, 'name': CRUMB[page], 'item': page_url(page)}]}
    else:
        return ''
    return '<script type="application/ld+json">\n' + json.dumps(data, indent=2, ensure_ascii=False) + '\n</script>'


def page_url(page):
    return CONFIG['site_url'] + '/' + ('' if page == 'index' else f'{page}.html')


def render(page, key, title, desc, inline):
    c = CONFIG
    out = (SRC / 'layout.html').read_text(encoding='utf-8')
    out = out.replace('{{CONTENT}}', (SRC / 'pages' / f'{page}.html').read_text(encoding='utf-8').rstrip('\n'))
    bank, tax, credit = blocks(c)
    first = c['contact_name'].split()[0]
    local, _, domain = c['email'].partition('@')
    if inline:
        css = '<style>\n' + (SRC / 'styles.css').read_text(encoding='utf-8') + '</style>'
        js = '<script>\n' + (SRC / 'site.js').read_text(encoding='utf-8') + '</script>'
    else:
        css = '<link rel="stylesheet" href="assets/styles.css">'
        js = '<script src="assets/site.js"></script>'
    tokens = {
        'TITLE': html.escape(title), 'DESCRIPTION': html.escape(desc),
        'CSS': css, 'JS': js, 'HEAD_EXTRA': json_ld(c, page),
        'URL_TAGS': ('<meta name="robots" content="noindex">' if page in NOINDEX else
                     f'<meta property="og:url" content="{page_url(page)}">\n<link rel="canonical" href="{page_url(page)}">'),
        'PHONE': f'<span class="nw">{c["phone"]}</span>', 'TEL': 'tel:' + c['phone_intl'],   # phone numbers never split across lines
        'EMAIL': c['email'], 'EMAIL_WBR': f'{local}<wbr>@{domain}', 'MAILTO': 'mailto:' + c['email'],
        'FACEBOOK': c['facebook'], 'CHARITY_NO': c['charity_no'], 'REGISTER_URL': c['register_url'],
        'CONTACT_NAME': c['contact_name'], 'CONTACT_FIRST': first, 'CONTACT_ROLE': c['contact_role'],
        'CONTACT_INITIALS': ''.join(w[0] for w in c['contact_name'].split())[:2].upper(),
        'KAI_NAME': c['kai_name'], 'KAI_FIRST': c['kai_name'].split()[0], 'KAI_ROLE': c['kai_role'],
        'KAI_PHONE': f'<span class="nw">{c["kai_phone"]}</span>', 'KAI_TEL': 'tel:' + c['kai_phone_intl'],
        'KAI_INITIALS': ''.join(w[0] for w in c['kai_name'].split())[:2].upper(),
        'TAGLINE': c['tagline'], 'YEAR': str(datetime.date.today().year),
        'SITE_URL': c['site_url'],
        'BANK_BLOCK': bank, 'TAX_BLOCK': tax, 'CREDIT_BLOCK': credit,
        'JS_CONFIG': json.dumps({'formEndpoint': c['form_endpoint'], 'netlifyForms': c['netlify_forms'], 'email': c['email'], 'phone': c['phone']}),
    }
    for k, v in tokens.items():
        out = out.replace('{{' + k + '}}', v)

    def img(m):
        path = IMG / m.group(1)
        if not path.exists():
            raise SystemExit(f'missing image: {path}')
        return data_uri(path) if inline else f'assets/img/{m.group(1)}'

    def photo(m):
        path = IMG / f'{m.group(1)}.jpg'
        if not path.exists():
            return ''
        return f'<img src="{data_uri(path) if inline else "assets/img/" + path.name}" alt="" loading="lazy">'

    def doc(m):
        path = DOCS / m.group(2)
        if not path.exists():
            raise SystemExit(f'missing document: {path}')
        if m.group(1) == 'DOC_SIZE':
            return f'{path.suffix[1:].upper()}, {max(1, round(path.stat().st_size / 1024))} KB'
        return f'assets/docs/{path.name}'

    out = re.sub(r'\{\{IMG:([\w.-]+)\}\}', img, out)
    out = re.sub(r'\{\{(DOC|DOC_SIZE):([\w.-]+)\}\}', doc, out)
    out = re.sub(r'\{\{PHOTO:([\w-]+)\}\}', photo, out)
    out = re.sub(r'\{\{CUR:([\w-]+)\}\}', lambda m: ' aria-current="page"' if m.group(1) == key else '', out)
    left = re.findall(r'\{\{[^}]*\}\}', out)
    if left:
        raise SystemExit(f'{page}: unreplaced tokens {sorted(set(left))}')
    return out


def main():
    (SITE / 'assets').mkdir(parents=True, exist_ok=True)
    PREVIEW.mkdir(exist_ok=True)
    shutil.copyfile(SRC / 'styles.css', SITE / 'assets' / 'styles.css')
    shutil.copyfile(SRC / 'site.js', SITE / 'assets' / 'site.js')
    if DOCS.exists():                      # preview pages link to the same files, so copy them alongside
        shutil.copytree(DOCS, PREVIEW / 'assets' / 'docs', dirs_exist_ok=True)
    for page, key, title, desc in PAGES:
        out = render(page, key, title, desc, inline=False)
        if page == '404':
            # Netlify serves this at whatever address was mistyped (e.g. /old/page), so every
            # link and asset must start from the site root
            out = re.sub(r'(href|src)="(?!https?:|mailto:|tel:|sms:|data:|#|/)', r'\1="/', out)
            (SITE / '404.html').write_text(out, encoding='utf-8')
            print('built 404.html')
            continue
        (SITE / f'{page}.html').write_text(out, encoding='utf-8')
        (PREVIEW / f'{page}.html').write_text(render(page, key, title, desc, inline=True), encoding='utf-8')
        print(f'built {page}.html  (preview {(PREVIEW / f"{page}.html").stat().st_size // 1024} KB)')
    # search engines: where the pages are, and that they may be crawled
    today = datetime.date.today().isoformat()
    urls = ''.join(f'  <url><loc>{page_url(p)}</loc><lastmod>{today}</lastmod></url>\n' for p, *_ in PAGES if p not in NOINDEX)
    (SITE / 'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n'
                                      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls + '</urlset>\n')
    (SITE / 'robots.txt').write_text(f"User-agent: *\nAllow: /\n\nSitemap: {CONFIG['site_url']}/sitemap.xml\n")
    # Netlify: send its own .netlify.app address to the real domain, so Google sees one site, not two
    (SITE / '_redirects').write_text(f"https://{CONFIG['netlify_host']}/* {CONFIG['site_url']}/:splat 301!\n")
    # IndexNow (Bing, Yandex, Seznam...): the key file proves we own the site when we ping new pages
    (SITE / f"{CONFIG['indexnow_key']}.txt").write_text(CONFIG['indexnow_key'])


if __name__ == '__main__':
    main()
