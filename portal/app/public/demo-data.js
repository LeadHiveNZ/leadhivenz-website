/* LeadHive Partner Portal — demo data generator.
   Used when the app runs with ?demo (or before config.js has Supabase keys), and by
   scripts/make-seed.js to produce supabase/seed-demo.sql. Rows use the real DB column names. */
(function (root) {
  "use strict";
  const MONTHS_BACK = 4;
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  const pad = (n) => String(n).padStart(2, "0");
  const ymAdd = (ym, n) => { let [y, m] = ym.split("-").map(Number); m += n; while (m > 12) { m -= 12; y++; } while (m < 1) { m += 12; y--; } return `${y}-${pad(m)}`; };
  const daysIn = (ym) => { const [y, m] = ym.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };

  // local wall time in an IANA zone → UTC Date
  function tzParts(ms, tz) {
    const f = new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    const o = {}; for (const p of f.formatToParts(new Date(ms))) if (p.type !== "literal") o[p.type] = p.value; if (o.hour === "24") o.hour = "00"; return o;
  }
  function tzOffsetMs(utcMs, tz) { const p = tzParts(utcMs, tz); return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - utcMs; }
  function zonedToUtc(y, m, d, hh, mi, ss, tz) { const guess = Date.UTC(y, m - 1, d, hh, mi, ss || 0); let utc = guess - tzOffsetMs(guess, tz); const off2 = tzOffsetMs(utc, tz); if (guess - off2 !== utc) utc = guess - off2; return new Date(utc); }
  const ymOfNow = (now, tz) => { const p = tzParts(now.getTime(), tz); return `${p.year}-${p.month}`; };

  const KW_PL = ["emergency plumber auckland", "plumber near me", "blocked drain auckland", "hot water cylinder repair", "burst pipe plumber", "leaking tap repair", "toilet not flushing", "24 hour plumber"];
  const KW_EL = ["emergency electrician gold coast", "electrician near me", "power outage electrician", "switchboard upgrade", "ceiling fan installation", "smoke alarm installer"];
  const SUB_AK = ["Mt Eden", "Ponsonby", "Howick", "Takapuna", "Manukau", "Henderson", "Glenfield", "Remuera", "Papakura", "Botany", "Onehunga", "Albany"];
  const SUB_GC = ["Southport", "Robina", "Burleigh Heads", "Nerang", "Coomera", "Helensvale", "Varsity Lakes", "Palm Beach"];
  const SUM_PL = ["Caller has a blocked kitchen drain, water backing up into the sink. Wants someone today. Visit agreed for this afternoon, callout fee explained.", "Hot water cylinder leaking from the base, no hot water since this morning. Landlord calling for a tenant. Asked for a replacement quote, inspection booked.", "Burst pipe under the house, water running since last night. Mains turned off on the call. Emergency visit arranged within the hour.", "Toilet cistern keeps running. Asked for a rough price, happy with the range given, will confirm a time by text.", "Dripping kitchen tap. Not urgent, next week is fine. Address and best time taken.", "New dishwasher to plumb in after a kitchen reno. Wants a quote, photos to be sent through.", "Low water pressure across the whole house since the weekend. Visit booked for tomorrow morning.", "Gas hob disconnect and reconnect for a kitchen renovation. Needs a certified gasfitter, date pencilled in."];
  const SUM_EL = ["Half the house lost power after the storm. Switchboard tripping. Urgent visit arranged for today.", "Switchboard upgrade for a 1970s home with ceramic fuses. Wants a quote, site visit booked.", "Smoke alarms for a rental, needs a compliance certificate. Price range given, booked for Thursday.", "Three ceiling fans to install, fans already purchased. Flexible on timing, quote sent by text.", "Outdoor power point for a new spa pool. Needs an RCD, quote requested.", "Flickering lights in the kitchen, possibly a loose neutral. Visit booked."];
  const NOTES_PL = ["Blocked kitchen drain, wanted same day.", "Hot water cylinder leaking, landlord calling for tenant.", "Burst pipe under house, urgent.", "Toilet cistern running, asked for a price.", "Tap dripping, flexible on timing.", "New dishwasher install, quote request.", "Water pressure drop, whole house.", "Gas hob disconnect for kitchen reno."];
  const NOTES_EL = ["Half the house lost power, urgent.", "Switchboard upgrade quote for a 1970s home.", "Smoke alarms for rental compliance.", "Ceiling fans x3, flexible.", "Outdoor power point for a spa.", "Flickering lights in kitchen."];
  const NAMES = ["Sarah M.", "Dave Henderson", "Priya K.", "Tom Walker", "Aroha N.", "Chris B.", "Mel Tui", "Jordan P.", "Liam O'Connor", "Hine R."];
  const MSG_PL = ["Blocked drain in the kitchen, water backing up into the sink.", "Hot water cylinder is leaking from the bottom, no hot water this morning.", "Toilet keeps running, can you give me a rough price?", "Need a dishwasher plumbed in, kitchen is done next week."];
  const MSG_EL = ["Lost power to half the house after the storm, can someone come today?", "Need a quote for a switchboard upgrade, old ceramic fuses.", "Smoke alarms for a rental, need compliance cert.", "Install 3 ceiling fans, already have the fans."];
  const nzMobile = (r) => `0${[21, 22, 27][Math.floor(r() * 3)]} ${Math.floor(r() * 900 + 100)} ${Math.floor(r() * 9000 + 1000)}`;
  const auMobile = (r) => `04${Math.floor(r() * 90 + 10)} ${Math.floor(r() * 900 + 100)} ${Math.floor(r() * 900 + 100)}`;
  let idc = 0;
  const uuid = (r) => { // deterministic v4-looking uuid
    const h = () => Math.floor(r() * 16).toString(16);
    let s = ""; for (let i = 0; i < 32; i++) s += h();
    return `${s.slice(0, 8)}-${s.slice(8, 12)}-4${s.slice(13, 16)}-a${s.slice(17, 20)}-${s.slice(20, 32)}`;
  };

  function genCalls(r, c, ym, n, opts) {
    const au = c.country === "AU", kw = au ? KW_EL : KW_PL, notes = au ? NOTES_EL : NOTES_PL, subs = au ? SUB_GC : SUB_AK;
    const [y, m] = ym.split("-").map(Number); const days = Math.min(daysIn(ym), opts.maxDay || 31);
    const out = [];
    for (let i = 0; i < n; i++) {
      const day = 1 + Math.floor(r() * days), hr = 7 + Math.floor(r() * 12), mi = Math.floor(r() * 60);
      const rr = r(); const outcome = rr < opts.missRate ? "missed" : rr < opts.missRate + 0.06 ? "voicemail" : "answered";
      const duration_sec = outcome === "answered" ? 45 + Math.floor(r() * 400) : outcome === "voicemail" ? 20 + Math.floor(r() * 40) : 0;
      const ests = au ? [320, 480, 750, 1200, 2900] : [280, 350, 450, 650, 900, 1800];
      const sums = au ? SUM_EL : SUM_PL;
      out.push({ id: uuid(r), client_id: c.id, ym, called_at: zonedToUtc(y, m, day, hr, mi, 0, c.timezone).toISOString(), caller_number: au ? auMobile(r) : nzMobile(r), duration_sec, outcome, estimated_value: r() < 0.6 ? ests[Math.floor(r() * ests.length)] : null, summary: outcome === "answered" ? sums[Math.floor(r() * sums.length)] : "",
        tracking_number: au ? "07 5600 1122" : "09 801 2201", source: "Google Ads", campaign: au ? "GC Electrician · Search" : "AKL Plumber · Search", keyword: kw[Math.floor(r() * kw.length)],
        city: subs[Math.floor(r() * subs.length)], recording_url: outcome === "answered" ? "demo" : null, recording_path: null, nimbata_call_id: "nb" + (++idc),
        admin_note: outcome === "answered" && r() < 0.6 ? notes[Math.floor(r() * notes.length)] : "", client_status: "new", job_value: 0, client_note: "", raw: null });
    }
    return out.sort((a, b) => (a.called_at < b.called_at ? -1 : 1));
  }
  function genEnquiries(r, c, ym, n, opts) {
    const au = c.country === "AU", msgs = au ? MSG_EL : MSG_PL, subs = au ? SUB_GC : SUB_AK;
    const [y, m] = ym.split("-").map(Number); const days = Math.min(daysIn(ym), opts.maxDay || 31); const out = [];
    for (let i = 0; i < n; i++) {
      const day = 1 + Math.floor(r() * days);
      out.push({ id: uuid(r), client_id: c.id, ym, received_at: zonedToUtc(y, m, day, 8 + Math.floor(r() * 11), Math.floor(r() * 60), 0, c.timezone).toISOString(), name: NAMES[Math.floor(r() * NAMES.length)],
        phone: au ? auMobile(r) : nzMobile(r), suburb: subs[Math.floor(r() * subs.length)], message: msgs[Math.floor(r() * msgs.length)], is_urgent: r() < 0.5, page: "/", source: "website", estimated_value: null, client_status: "new", job_value: 0, client_note: "" });
    }
    return out.sort((a, b) => (a.received_at < b.received_at ? -1 : 1));
  }
  // first n calls become missed/voicemail (optionally moved into the 12–2pm slot), the rest answered
  function forceOutcomes(calls, nMissed, nVoice, lunch, tz) {
    calls.forEach((c, i) => {
      if (i < nMissed + nVoice) {
        c.outcome = i < nMissed ? "missed" : "voicemail"; c.duration_sec = c.outcome === "voicemail" ? 25 + i * 7 : 0; c.recording_url = null; c.admin_note = ""; c.summary = "";
        if (lunch) { const p = tzParts(new Date(c.called_at).getTime(), tz); c.called_at = zonedToUtc(+p.year, +p.month, +p.day, 12 + (i % 2), 5 + i * 11, 0, tz).toISOString(); }
      } else { c.outcome = "answered"; if (c.duration_sec < 45) c.duration_sec = 60 + i * 9; c.recording_url = "demo"; }
    });
    calls.sort((a, b) => (a.called_at < b.called_at ? -1 : 1));
  }
  function applyTags(calls, spec) {
    const ans = calls.filter((c) => c.outcome === "answered");
    spec.forEach(([st, v], i) => { if (ans[i]) { ans[i].client_status = st; ans[i].job_value = v || 0; } });
    if (spec.spam) { const m = calls.find((c) => c.outcome !== "answered"); if (m) m.client_status = "spam"; }
  }

  function build(now) {
    now = now || new Date();
    const r = rng(20261002);
    const NZ = "Pacific/Auckland", AU = "Australia/Brisbane";
    const cur = ymOfNow(now, NZ);
    const m1 = ymAdd(cur, -1), m2 = ymAdd(cur, -2), m3 = ymAdd(cur, -3), m4 = ymAdd(cur, -4);
    const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const label = (ym) => MONTHS[+ym.split("-")[1] - 1];
    const clients = [
      { id: "11111111-1111-4111-a111-111111111111", business_name: "Mike's Plumbing", initials: "MP", contact_name: "Mike", email: "demo@leadhivenz.com", phone: "021 555 0192", niche: "Emergency plumber", region: "Auckland", country: "NZ", timezone: NZ, package_name: "Starter", monthly_fee: 1500, lead_target_min: 15, lead_target_max: 25, started_on: m4 + "-01", billing_day: 1, show_cost_per_lead: true, show_ad_spend: false, avg_job_value: 450, active: true },
      { id: "22222222-2222-4222-a222-222222222222", business_name: "Bayside Electrical", initials: "BE", contact_name: "Sam", email: "sam@baysideelectrical.com.au", phone: "0412 338 901", niche: "Emergency electrician", region: "Gold Coast", country: "AU", timezone: AU, package_name: "Growth", monthly_fee: 2200, lead_target_min: 25, lead_target_max: 35, started_on: m2 + "-01", billing_day: 1, show_cost_per_lead: true, show_ad_spend: false, avg_job_value: 520, active: true },
      { id: "33333333-3333-4333-a333-333333333333", business_name: "Northland Building Maintenance", initials: "NH", contact_name: "Brian", email: "nbm.br001@gmail.com", phone: "022 322 1137", niche: "Handyman", region: "Northland", country: "NZ", timezone: NZ, package_name: "Starter (trial)", monthly_fee: 1500, lead_target_min: 15, lead_target_max: 25, started_on: m1 + "-28", billing_day: 28, show_cost_per_lead: true, show_ad_spend: false, avg_job_value: 380, active: true },
    ];
    const [mike, bay, nth] = clients;
    let calls = [], enquiries = [], months = [], secrets = {};
    clients.forEach((c) => (secrets[c.id] = "lh_demo_" + c.initials.toLowerCase() + "_0123456789abcdef"));

    const plan = [[m4, 16, 2], [m3, 19, 3], [m2, 24, 3], [m1, 18, 4]];
    for (const [ym, nc, ne] of plan) { calls = calls.concat(genCalls(r, mike, ym, nc, { missRate: 0.2 })); enquiries = enquiries.concat(genEnquiries(r, mike, ym, ne, {})); }
    const pick = (c, ym) => calls.filter((x) => x.client_id === c.id && x.ym === ym);
    forceOutcomes(pick(mike, m1), 2, 2, true, NZ); applyTags(pick(mike, m1), [["won", 1850], ["lost"], ["won", 3200], ["ongoing"], ["ongoing"], ["won", 420], ["lost"], ["won", 280], ["ongoing"]]);
    forceOutcomes(pick(mike, m2), 4, 2, false, NZ); applyTags(pick(mike, m2), [["won", 650], ["won", 2400], ["lost"], ["won", 380], ["ongoing"], ["won", 1200], ["lost"], ["won", 540], ["ongoing"], ["won", 900]]);
    forceOutcomes(pick(mike, m3), 3, 1, false, NZ); applyTags(pick(mike, m3), [["won", 420], ["ongoing"], ["won", 1600], ["won", 260]]);
    forceOutcomes(pick(mike, m4), 2, 0, false, NZ);
    // this month so far
    const todayDay = +tzParts(now.getTime(), NZ).day;
    const live = genCalls(r, mike, cur, Math.max(1, Math.round(todayDay * 0.6)), { missRate: 0.15, maxDay: todayDay });
    live.forEach((c) => (c.admin_note = ""));
    calls = calls.concat(live);
    const liveEnq = genEnquiries(r, mike, cur, Math.max(1, Math.round(todayDay * 0.12)), { maxDay: todayDay });
    liveEnq[liveEnq.length - 1].name = "Kelly Shaw"; liveEnq[liveEnq.length - 1].message = "Water coming through the ceiling under the upstairs bathroom. Need someone this morning if possible."; liveEnq[liveEnq.length - 1].is_urgent = true; liveEnq[liveEnq.length - 1].page = "/burst-pipes";
    enquiries = enquiries.concat(liveEnq);

    for (const [ym, nc, ne] of [[m2, 26, 4], [m1, 31, 5]]) { calls = calls.concat(genCalls(r, bay, ym, nc, { missRate: 0.12 })); enquiries = enquiries.concat(genEnquiries(r, bay, ym, ne, {})); }
    forceOutcomes(pick(bay, m1), 3, 1, false, AU); const bs = [["won", 2900], ["won", 640], ["ongoing"], ["won", 4200], ["ongoing"], ["won", 380], ["ongoing"], ["won", 1150], ["ongoing"], ["won", 760]]; applyTags(pick(bay, m1), bs);
    forceOutcomes(pick(bay, m2), 4, 1, false, AU); applyTags(pick(bay, m2), [["won", 1800], ["ongoing"], ["won", 520], ["won", 3100], ["ongoing"], ["won", 690]]);
    // Brian's first call since launch
    const [ly, lm] = m1.split("-").map(Number);
    calls.push({ id: uuid(r), client_id: nth.id, ym: m1, called_at: zonedToUtc(ly, lm, 30, 14, 5, 0, NZ).toISOString(), caller_number: "021 884 0022", duration_sec: 168, outcome: "answered", estimated_value: 6500, summary: "Wants an old deck pulled out and rebuilt in Kamo, about 25 square metres. Asked for a quote next week, happy to send photos.", tracking_number: "09 801 3300", source: "Google Ads", campaign: "Northland Handyman · Search", keyword: "deck builder whangarei", city: "Whangārei", recording_url: "demo", recording_path: null, nimbata_call_id: "nb9001", admin_note: "Deck rebuild, Kamo. Wants a quote next week.", client_status: "new", job_value: 0, client_note: "", raw: null });

    const mk = (c, ym, status, ad_spend, summary, points) => ({ id: uuid(r), client_id: c.id, ym, status, summary, points, pdf_path: null, published_at: status === "published" ? zonedToUtc(+ymAdd(ym, 1).split("-")[0], +ymAdd(ym, 1).split("-")[1], 2, 18, 0, 0, c.timezone).toISOString() : null, ad_spend });
    months.push(mk(mike, m4, "published", 612, "First month in and we're already inside the target range. The campaign is still learning, so expect leads to climb from here as Google works out which searches turn into calls for you.",
      [{ title: "Keyword refinement", body: "Adding negative keywords for DIY and price-shopping searches so the budget only goes to people who need a plumber now." }, { title: "Ad copy testing", body: "Running two headline variants to see whether 'same day' or '24/7' pulls more calls." }, { title: "Call hours", body: "Tightening the ad schedule to the hours you answer best." }]));
    months.push(mk(mike, m3, "published", 688, `Up on ${label(m4)}, with more calls landing in the afternoon. Missed calls crept up a little; the ones you did answer were strong, mostly blocked drains and hot water.`,
      [{ title: "Missed call follow-up", body: "4 of 19 calls went unanswered. Each one is a job that probably went to the next plumber on Google. Even a text back within 10 minutes recovers a lot of these." }, { title: "Scaling what's working", body: "'Blocked drain' searches are converting best, so I'm moving more of the budget there." }, { title: "Keyword refinement", body: "Weekly search term review, more negatives added." }]));
    months.push(mk(mike, m2, "published", 741, "Best month yet: 27 leads against a 15 to 25 plan. Hot water cylinder searches picked up with the cold snap and the ads were there for it.",
      [{ title: "Scaling what's working", body: "We cleared the top of the target range, so I'm pushing bids on the hot water and burst pipe terms to hold this volume." }, { title: "Keyword refinement", body: "Added 14 negatives after the search term review. 'Plumbing course' and 'plumber salary' were burning clicks." }, { title: "Landing page", body: "Added a hot water cylinder page so those searches land on a page about hot water, not the generic one." }]));
    months.push(mk(mike, m1, "published", 702, "A steady month. 22 leads, inside the plan. The one thing to work on is answering: 4 calls went to voicemail or rang out, all between 12 and 2pm. The jobs you tagged as won this month came to $5,750, from a $1,500 plan.",
      [{ title: "Missed call follow-up", body: "22% of calls weren't answered. I've shifted the ad schedule so fewer calls land over lunch, but a quick call-back on the missed ones is the easiest money in this report." }, { title: "Scaling what's working", body: "'Emergency plumber Auckland' and 'blocked drain' are still the winners. More budget there, less on the broad 'plumber near me' term." }, { title: "Keyword refinement", body: "Search term review done weekly. 9 new negatives this month." }]));
    months.push(mk(bay, m2, "published", 1180, "Strong start on the Gold Coast. 30 leads in month one with a low missed rate, which is exactly what we want to see from an emergency sparky campaign.",
      [{ title: "Scaling what's working", body: "Storm week drove the 'power outage' searches. Budget is weighted there for the storm season." }, { title: "Keyword refinement", body: "Negatives added for solar and 'electrician jobs' searches." }, { title: "Ad copy testing", body: "Testing 'licensed, insured, 60 min response' as the lead headline." }]));
    months.push(mk(bay, m1, "published", 1240, "35 leads after pulling out one spam call, above the top of the Growth plan. Missed calls stayed low at 13%, nice work. Smoke alarm compliance searches are a growing stream worth talking about.",
      [{ title: "Scaling what's working", body: "We're past the 35 lead ceiling on Growth. Worth a chat about the Dominator plan if you have the capacity to take 40 to 60 a month." }, { title: "Keyword refinement", body: "Search term review weekly. Negatives for 'free' and 'DIY' searches." }, { title: "New service page", body: "Added a smoke alarm page to catch the compliance searches." }]));
    months.push(mk(nth, m1, "draft", 48, "", []));

    const users = [
      { id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa", email: "hello@leadhivenz.com", password: "admin", role: "admin", client_id: null },
      { id: "bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb", email: "mike@mikesplumbing.co.nz", password: "demo", role: "client", client_id: mike.id },
      { id: "cccccccc-cccc-4ccc-accc-cccccccccccc", email: "sam@baysideelectrical.com.au", password: "demo", role: "client", client_id: bay.id },
      { id: "dddddddd-dddd-4ddd-addd-dddddddddddd", email: "nbm.br001@gmail.com", password: "demo", role: "client", client_id: nth.id },
    ];
    return { clients, months, calls, enquiries, secrets, users };
  }

  root.LEADHIVE_DEMO = { build, zonedToUtc, tzParts };
})(typeof window !== "undefined" ? window : globalThis);
