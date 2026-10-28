# LeadHive client landing pages

Mobile-first landing pages for LeadHive NZ / AU trade partners. Each client is a copy of a
master template with only the `CONFIG` block changed; template logic, markup and CSS stay
locked so every site behaves the same (hours-aware status line, Nimbata phone swap, lead form).

```
crew-app/                       Crew app (phase 1): installable PWA for a tradie crew — today's jobs,
                                photos, hours, offline sync, office board. Next.js + Supabase. See crew-app/README.md
templates/                      master templates (edit CONFIG only in client copies)
  handyman-master.html          handyman / building maintenance, "planned intent" variant
clients/
  northland-handyman/           Northland Building Maintenance (Brian Redwood), Northland NZ
    northland-handyman-master.html
    README.md                   routes, data sources, pre-launch checks
    screens/                    rendered previews of each page
```

Preview any client file directly in a browser; add `?page=<key>` to view a service page.
In Lovable each `CONFIG.services[key].path` becomes its own route.
