# LeadHive client landing pages

Mobile-first landing pages for LeadHive NZ / AU trade partners. Each client is a copy of a
master template with only the `CONFIG` block changed; template logic, markup and CSS stay
locked so every site behaves the same (hours-aware status line, Nimbata phone swap, lead form).

```
templates/                      master templates (edit CONFIG only in client copies)
  handyman-master.html          handyman / building maintenance, "planned intent" variant
clients/
  northland-handyman/           Northland Building Maintenance (Brian Redwood), Northland NZ
    northland-handyman-master.html
    README.md                   routes, data sources, pre-launch checks
    screens/                    rendered previews of each page
  porirua-hardscapes/           Porirua Hardscapes (Adam Martin), Whitby / Wellington — full 11-page client website
    index.html, about.html, projects.html, contact.html, services/*.html
    assets/css/site.css         shared design system; assets/js/site.js injects header/footer/call bar
    AUDIT.md, README.md         old-site audit + rebuild rationale; launch checklist and photo drop-in map
```

`porirua-hardscapes/` is a standalone multi-page website rather than a CONFIG-driven landing page:
preview with `http-server clients/porirua-hardscapes` (or open `index.html` directly).

Preview any client file directly in a browser; add `?page=<key>` to view a service page.
In Lovable each `CONFIG.services[key].path` becomes its own route.
