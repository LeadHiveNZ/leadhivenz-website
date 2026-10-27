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
  aroha-seniors/                Aroha Seniors Charitable Trust (CC63126), Flat Bush, Auckland
    build.py                    builds site/ and preview/ from src/ (run after any edit)
    src/                        layout, six pages (incl. policies), styles and script
    site/                       the website to upload: six pages + assets/ (incl. policies PDF)
    preview/                    the same pages, each self-contained for previewing alone
    README.md                   content sources, items to confirm, photo slots, launch checklist
    screens/                    rendered previews of each page, desktop and mobile
```

Preview any client file directly in a browser; add `?page=<key>` to view a service page.
In Lovable each `CONFIG.services[key].path` becomes its own route.
