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
  straight-line-landscaping/    Straight Line Landscaping (Matt), Tauranga: multi-page brochure
                                preview site built from his Facebook photos (not the ads template)
    index.html + 10 pages, assets/, photos/, screens/, README.md
```

Preview any client file directly in a browser; add `?page=<key>` to view a service page.
In Lovable each `CONFIG.services[key].path` becomes its own route.
