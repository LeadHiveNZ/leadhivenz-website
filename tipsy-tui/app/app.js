/* The Tipsy Tui — Bookings
   One file, no build step. Reads config.js; with no Supabase keys it runs in Demo mode on this device. */
(() => {
  "use strict";

  const CFG = window.TIPSY_CONFIG || {};
  const TEAM = CFG.TEAM || ["Joe", "Kieran"];
  const BASE = CFG.BASE || "Christchurch";
  const DEMO = !(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);
  const ASSIGN = Object.assign({ admin: TEAM[0], ops: TEAM[1] || TEAM[0] }, CFG.ASSIGN || {});
  const AUTO_BOOK = CFG.AUTO_BOOK !== false;

  const PKG = {
    dry_hire: { label: "Dry Hire", alt: "Classic Tui" },
    byo: { label: "BYO Bar", alt: "Tui Experience" },
    fully_catered: { label: "Fully Catered", alt: "Premium Tui" },
  };
  const STATUS = { enquiry: "Enquiry", quoted: "Quoted", confirmed: "Confirmed", completed: "Done", cancelled: "Cancelled" };
  const PHASES = [["booking", "Lock it in"], ["prep", "Lead-up"], ["week_of", "Week of"], ["day_before", "Day before"], ["day_of", "On the day"], ["after", "After the job"]];
  const EVENT_TYPES = [["wedding", "Wedding"], ["birthday", "Birthday"], ["corporate", "Corporate"], ["reunion", "Reunion"], ["festival", "Festival / market"], ["other", "Other"]];
  const BOND_DEFAULT = 300, DEPOSIT_PCT = 0.25, BARTENDER_RATE = 50;

  // ============================================================ dates
  const pad = (n) => String(n).padStart(2, "0");
  const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const parseISO = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };
  const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (iso, n) => { const d = parseISO(iso); d.setDate(d.getDate() + n); return toISO(d); };
  const daysUntil = (iso) => Math.round((parseISO(iso) - parseISO(todayISO())) / 86400000);
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const MONTH_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const fmtDate = (iso) => { if (!iso) return "Date TBC"; const d = parseISO(iso); return `${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`; };
  const fmtShort = (iso) => { if (!iso) return "TBC"; const d = parseISO(iso); return `${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`; };
  const fmt12 = (hhmm) => { if (!hhmm) return "TBC"; const [h, m] = hhmm.split(":").map(Number); const hr = h % 12 === 0 ? 12 : h % 12; return `${hr}${m ? ":" + pad(m) : ""}${h >= 12 ? "pm" : "am"}`; };
  const shiftTime = (hhmm, hours) => { const [h, m] = hhmm.split(":").map(Number); let mins = h * 60 + m + Math.round(hours * 60); mins = ((mins % 1440) + 1440) % 1440; return `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`; };
  const hoursBetween = (s, f) => { if (!s || !f) return null; const [sh, sm] = s.split(":").map(Number); const [fh, fm] = f.split(":").map(Number); let mins = (fh * 60 + fm) - (sh * 60 + sm); if (mins <= 0) mins += 1440; return mins / 60; };
  const relDay = (iso) => { const n = daysUntil(iso); if (n === 0) return "Today"; if (n === 1) return "Tomorrow"; if (n === -1) return "Yesterday"; return n > 0 ? `in ${n} days` : `${-n} days ago`; };
  const money = (n) => n == null || n === "" || isNaN(n) ? "—" : "$" + Number(n).toLocaleString("en-NZ", { maximumFractionDigits: 0 });
  const hm = (hhmm) => hhmm ? String(hhmm).slice(0, 5) : "";

  // ============================================================ business rules
  const bartendersFor = (b) => { if (b.package === "dry_hire") return 0; if (b.bartender_count != null && b.bartender_count !== "") return Number(b.bartender_count); const g = Number(b.guest_count) || 0; return g <= 0 ? 1 : Math.max(1, Math.ceil(g / 50)); };
  const serviceHours = (b) => hoursBetween(hm(b.start_time), hm(b.finish_time));
  const travelFee = (min) => Math.ceil((Number(min) || 0) / 45) * 50;
  const depositFor = (b) => b.deposit_amount != null && b.deposit_amount !== "" ? Number(b.deposit_amount) : (b.total ? Math.round(Number(b.total) * DEPOSIT_PCT) : null);

  function runSheet(b, crewNames) {
    const setup = Number(b.setup_hours ?? 1), pack = Number(b.packdown_hours ?? 1), travel = Number(b.travel_minutes) || 0;
    const hours = serviceHours(b), guests = Number(b.guest_count) || 0, bartenders = bartendersFor(b);
    const start = hm(b.start_time), finish = hm(b.finish_time);
    const t = {};
    if (start) { t.arrive = shiftTime(start, -setup); if (travel) t.depart = shiftTime(t.arrive, -travel / 60); t.open = start; }
    if (finish) { t.last = finish; t.packed = shiftTime(finish, pack); if (travel) t.home = shiftTime(t.packed, travel / 60); }
    const staffHours = hours != null ? hours + setup + pack : null;
    const perGuest = hours != null ? Math.min(8, Math.max(2, 1 + 0.75 * hours)) : 5.5;
    const drinks = guests ? Math.round(guests * perGuest / 10) * 10 : null;
    const kegs = drinks ? Math.max(1, Math.ceil((drinks * 0.4) / 100)) : null;
    const iceBags = guests ? Math.ceil(guests / 5) : null;
    const cups = guests ? guests * 2 : null;
    const wages = staffHours != null ? bartenders * BARTENDER_RATE * staffHours : null;
    const deposit = depositFor(b);
    const total = b.total != null && b.total !== "" ? Number(b.total) : null;
    const balance = total != null && deposit != null ? total - deposit : total;
    const bond = b.package === "dry_hire" ? (Number(b.bond_amount) || BOND_DEFAULT) : 0;
    const weBring = ["The caravan: 3 keg taps, bar fridge, lights", "Delivery, set-up and pack-down"];
    const clientSorts = [];
    if (b.package === "dry_hire") {
      clientSorts.push("All drinks, served by their own people", "Bar staff (none from us)", "Liquor licence / permit if the venue needs one", money(bond) + " bond, refunded within 7 business days");
      weBring.push(b.glassware ? "Glassware (plastic)" : "No glassware (they BYO or add ours)");
    } else {
      weBring.push(`${bartenders} bartender${bartenders === 1 ? "" : "s"} for ${staffHours != null ? staffHours.toFixed(1).replace(/\.0$/, "") + " hrs" : "the shift"}`, "Bar tools, ice bins, napkins, straws, water station", b.glassware ? "Plastic glassware (no breakages)" : "No glassware supplied");
      if (b.package === "byo") clientSorts.push("All the alcohol (kegs, bottles, cans, wine)", "Liquor licence / permit if the venue needs one");
      else { weBring.push("All drinks: sourced, chilled, served", "Buy-back of unopened stock"); clientSorts.push("Their drinks wish list (we price it)", "Liquor licence / permit if the venue needs one"); }
    }
    if (b.cocktails) weBring.push("Pre-made signature cocktails");
    if (b.generator) weBring.push("Generator for off-grid power");
    if (b.fairy_lights) weBring.push("Fairy lights and styling");
    if (b.accommodation) weBring.push("Staff accommodation (booked by us)");
    if (travel) weBring.push(`Travel: ${travel} min each way (${money(travelFee(travel))} travel fee)`);
    return { t, hours, setup, pack, travel, guests, bartenders, staffHours, drinks, kegs, iceBags, cups, wages, deposit, total, balance, bond, balanceDue: b.event_date ? addDays(b.event_date, -7) : null, bondRefundDue: b.event_date ? addDays(b.event_date, 10) : null, weBring, clientSorts, crewNames: crewNames || [] };
  }

  // Checklist template. Short titles; "who" decides the default owner.
  function generateTasks(b) {
    const d = b.event_date; const T = [];
    const add = (phase, title, offset, who = "admin") => T.push({ phase, title, due_date: d ? addDays(d, offset) : null, sort: T.length, assigned_to: who === "both" ? null : ASSIGN[who] || null });
    const pkg = b.package, staffed = pkg !== "dry_hire", dep = depositFor(b), rs = runSheet(b), n = bartendersFor(b);
    const lead = Math.max(0, daysUntil(d) || 0);
    add("booking", "Send booking agreement", -lead);
    add("booking", `Collect ${dep != null ? money(dep) + " " : ""}deposit`, -Math.max(7, lead - 7));
    add("booking", "Check it's on the shared calendar", -Math.max(7, lead - 1));
    if (pkg === "byo") add("booking", "Send Local Pour Guide", -Math.max(14, lead - 3));
    if (pkg === "fully_catered") add("booking", "Send Drinks List guide", -Math.max(14, lead - 3));
    if (staffed) add("prep", `Roster ${n} bartender${n === 1 ? "" : "s"}`, -28, "ops");
    add("prep", "Confirm access, parking & power with client", -28);
    add("prep", "Check liquor licence / permit", -28);
    if (b.accommodation || Number(b.travel_minutes) >= 120) add("prep", "Book staff accommodation", -28, "ops");
    if (pkg === "fully_catered") { add("prep", "Price drinks list & get it approved", -21); add("prep", "Order stock", -14, "ops"); }
    if (pkg === "byo") add("prep", "Check client has ordered kegs & drinks", -14);
    add("prep", "Confirm final numbers & bar hours", -14);
    add("week_of", `Chase balance${rs.balance != null ? " (" + money(rs.balance) + ")" : ""}`, -7);
    if (pkg === "dry_hire") add("week_of", `Collect ${money(rs.bond)} bond`, -7);
    add("week_of", "Send run sheet to crew", -3, "ops");
    if (pkg === "fully_catered") add("week_of", "Pick up stock & chill", -2, "ops");
    add("week_of", "Check CO2, couplers & tap lines", -2, "ops");
    if (b.generator) add("week_of", "Fuel & test generator", -2, "ops");
    if (b.fairy_lights) add("week_of", "Charge & test lights", -2, "ops");
    add("day_before", "Buy ice", -1, "ops");
    add("day_before", "Clean & stock the caravan", -1, "ops");
    if (b.glassware || staffed) add("day_before", "Pack glassware & ice bins", -1, "ops");
    add("day_before", "Hitch up & road check", -1, "ops");
    add("day_before", "Confirm times with client & crew", -1);
    add("day_of", "Depart base", 0, "both");
    add("day_of", "Set up & pour test", 0, "both");
    add("day_of", "Bar service", 0, "both");
    add("day_of", "Pack down & photos", 0, "both");
    if (pkg === "fully_catered") add("after", "Settle unopened stock", 1, "ops");
    add("after", "Thank-you + ask for review", 2);
    if (pkg === "dry_hire") add("after", "Inspect & refund bond", 3);
    add("after", "Mark balance paid, close job", 7);
    return T;
  }
  const normTitle = (s) => String(s || "").toLowerCase().replace(/\$?[\d,.]+/g, "#").replace(/\s+/g, " ").trim();
  // Every title the template can produce, so we know which tasks are ours to retire when a job changes.
  const TEMPLATE_TITLES = (() => {
    const set = new Set();
    for (const pkg of Object.keys(PKG)) generateTasks({ package: pkg, event_date: todayISO(), guest_count: 120, total: 1000, generator: true, fairy_lights: true, glassware: true, accommodation: true, travel_minutes: 200 }).forEach((t) => set.add(normTitle(t.title)));
    return set;
  })();

  // Titles from the previous checklist template, so existing jobs migrate cleanly to the short names.
  const OLD_TEMPLATE_TITLES = new Set([
    "send the booking agreement for signing", "collect the # deposit (#%) to secure the date", "collect the deposit (#%) to secure the date", "add to the shared calendar and tell kieran", "check the job is on the shared calendar and tell kieran", "send the local pour guide (kegs, local beer and wine partners)", "send the drinks list guide and ask for their wish list",
    "roster # bartender and confirm they're keen", "roster # bartenders and confirm they're keen", "confirm with client: site access, power, where the caravan parks", "check whether the venue needs a liquor licence or permit (client's job, but chase it)", "book staff accommodation", "price the drinks list and get it approved", "order stock from suppliers", "check the client has ordered their kegs and drinks", "confirm final guest count and bar hours with the client",
    "chase the balance (#): due # days out", "chase the balance: due # days out", "collect the # bond", "send the run sheet to the crew", "pick up stock and get it chilling", "check co# bottle, keg couplers and tap lines", "fuel and test the generator", "charge and test the lights",
    "buy ice", "clean the caravan, stock bar tools, napkins, straws, water station", "pack glassware and ice bins", "hitch up and road check: tyres, lights, hitch, gas off", "text the client and the crew to confirm times",
    "depart base with the caravan", "set up on site and run a pour test on every tap", "bar service", "pack down, final clean, photos for socials",
    "settle unopened stock: buy back at cost or leave with client", "thank-you message, ask for a google review and tag us in photos", "inspect for damage, then refund the bond within # business days", "mark the balance paid and close the job",
  ].map(normTitle));

  const ICONS = {
    clock: '<path d="M12 6v6l4 2"/><circle cx="12" cy="12" r="9"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    dollar: '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/>',
    truck: '<path d="M1 3h15v13H1zM16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
    beer: '<path d="M17 11h1a3 3 0 0 1 0 6h-1M9 12v5M13 12v5M5 8v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8H5z"/><path d="M5 8a3 3 0 0 1 3-5 3 3 0 0 1 5-1 3 3 0 0 1 4 6"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.6a2 2 0 0 1-.5 2.1L8.1 9.6a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.8.3 1.7.6 2.6.7A2 2 0 0 1 22 16.9z"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="M5 12l5 5L20 7"/>',
    note: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>',
    dot: '<circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/>',
    mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v4M8 21h8"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>',
  };
  const ic = (name, cls = "") => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ""}</svg>`;

  function runSheetText(b, rs) {
    const L = [`THE TIPSY TUI — RUN SHEET`, `${b.event_name || b.client_name} · ${PKG[b.package].label}`, `${fmtDate(b.event_date)} · ${[b.venue, b.address].filter(Boolean).join(", ") || "Venue TBC"}`, `${rs.guests || "?"} guests · ${rs.bartenders} bartender${rs.bartenders === 1 ? "" : "s"}${rs.crewNames.length ? " (" + rs.crewNames.join(", ") + ")" : " (not rostered yet)"}`, "", "TIMES"];
    if (rs.t.depart) L.push(`${fmt12(rs.t.depart).padEnd(8)} leave ${BASE}${rs.travel ? " (" + rs.travel + " min drive)" : ""}`);
    if (rs.t.arrive) L.push(`${fmt12(rs.t.arrive).padEnd(8)} on site, set up`);
    if (rs.t.open) L.push(`${fmt12(rs.t.open).padEnd(8)} bar opens`);
    if (rs.t.last) L.push(`${fmt12(rs.t.last).padEnd(8)} last drinks`);
    if (rs.t.packed) L.push(`${fmt12(rs.t.packed).padEnd(8)} packed down`);
    if (rs.t.home) L.push(`${fmt12(rs.t.home).padEnd(8)} home`);
    if (!rs.t.open) L.push("Times TBC");
    L.push("", "WE BRING"); rs.weBring.forEach((x) => L.push("- " + x));
    L.push("", "CLIENT SORTS"); rs.clientSorts.forEach((x) => L.push("- " + x));
    if (b.kegs_on_tap) L.push("", "ON TAP: " + b.kegs_on_tap);
    if (b.drinks_notes) L.push("DRINKS: " + b.drinks_notes);
    L.push("", "ESTIMATES", `~${rs.drinks ?? "?"} drinks · ${rs.kegs ?? "?"} keg${rs.kegs === 1 ? "" : "s"} if beer-heavy · ${rs.iceBags ?? "?"} bags of ice · ${rs.cups ?? "?"} cups`);
    L.push("", "MONEY", `Total ${money(rs.total)} · deposit ${money(rs.deposit)} ${b.deposit_paid ? "PAID" : "NOT PAID"} · balance ${money(rs.balance)} ${b.balance_paid ? "PAID" : "due " + fmtShort(rs.balanceDue)}`);
    if (rs.bond) L.push(`Bond ${money(rs.bond)} ${b.bond_paid ? "held" : "not yet paid"}${b.bond_refunded ? ", refunded" : ""}`);
    if (b.notes) L.push("", "NOTES", b.notes);
    if (b.contact_name || b.phone || b.email) L.push("", "CONTACT", [b.contact_name, b.phone, b.email].filter(Boolean).join(" · "));
    return L.join("\n");
  }
  const icsStamp = (iso, hhmm) => iso.replace(/-/g, "") + "T" + hhmm.replace(":", "") + "00";
  function eventWindow(b) { const rs = runSheet(b); if (!rs.t.arrive || !rs.t.packed) return null; const endDate = rs.t.packed < rs.t.arrive ? addDays(b.event_date, 1) : b.event_date; return { start: icsStamp(b.event_date, rs.t.arrive), end: icsStamp(endDate, rs.t.packed) }; }
  function gcalUrl(b) {
    const w = eventWindow(b);
    const dates = w ? `${w.start}/${w.end}` : `${b.event_date.replace(/-/g, "")}/${addDays(b.event_date, 1).replace(/-/g, "")}`;
    return "https://calendar.google.com/calendar/render?" + new URLSearchParams({ action: "TEMPLATE", text: `${b.client_name} — ${PKG[b.package].label} (Tipsy Tui)`, dates, ctz: "Pacific/Auckland", details: runSheetText(b, runSheet(b)), location: [b.venue, b.address].filter(Boolean).join(", ") }).toString();
  }
  function icsForBooking(b) {
    const w = eventWindow(b); const esc = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//The Tipsy Tui//Bookings//EN", "BEGIN:VEVENT", `UID:${b.id}@thetipsytui`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z")}`];
    if (w) lines.push(`DTSTART;TZID=Pacific/Auckland:${w.start}`, `DTEND;TZID=Pacific/Auckland:${w.end}`); else lines.push(`DTSTART;VALUE=DATE:${b.event_date.replace(/-/g, "")}`, `DTEND;VALUE=DATE:${addDays(b.event_date, 1).replace(/-/g, "")}`);
    lines.push(`SUMMARY:${esc(b.client_name + " — " + PKG[b.package].label + " (Tipsy Tui)")}`, `LOCATION:${esc([b.venue, b.address].filter(Boolean).join(", "))}`, `DESCRIPTION:${esc(runSheetText(b, runSheet(b)))}`, "END:VEVENT", "END:VCALENDAR");
    return lines.join("\r\n");
  }

  // ============================================================ local parser (no AI needed)
  const MONTHS_RX = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
  function parseDateText(s) {
    if (!s) return null;
    let m = s.match(new RegExp(`(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTHS_RX})\\s+(\\d{4})`, "i"));
    if (m) { const mi = MON.findIndex((x) => m[2].toLowerCase().startsWith(x.toLowerCase())); return `${m[3]}-${pad(mi + 1)}-${pad(+m[1])}`; }
    m = s.match(/(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})/); if (m) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
    m = s.match(/(\d{4})-(\d{2})-(\d{2})/); return m ? m[0] : null;
  }
  function parseTime(s) {
    if (!s) return null; const m = s.match(/(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m/i);
    if (!m) { const n = s.match(/\b(\d{2}):(\d{2})\b/); return n ? `${n[1]}:${n[2]}` : null; }
    let h = +m[1]; const mins = m[2] ? +m[2] : 0; if (m[3].toLowerCase() === "p" && h < 12) h += 12; if (m[3].toLowerCase() === "a" && h === 12) h = 0;
    return `${pad(h)}:${pad(mins)}`;
  }
  const TRAVEL_GUESS = [["hanmer", 110], ["akaroa", 85], ["tekapo", 190], ["ashburton", 60], ["timaru", 120], ["temuka", 110], ["geraldine", 100], ["methven", 70], ["kaikoura", 150], ["rolleston", 25], ["west melton", 25], ["darfield", 40], ["rangiora", 30], ["oxford", 45], ["amberley", 45], ["waipara", 55], ["lincoln", 25], ["leeston", 35], ["ohoka", 25], ["southland", 480], ["dunedin", 300], ["queenstown", 420], ["wanaka", 400], ["oamaru", 200]];
  function localParse(text) {
    const t = text.replace(/\r/g, "").replace(/\bmidnight\b/gi, "12am").replace(/\b(?:midday|noon)\b/gi, "12pm"); const line = (rx) => { const m = t.match(rx); return m ? m[1].trim() : null; };
    const b = { package: "byo", status: "quoted", glassware: false, generator: false, fairy_lights: false, cocktails: false, accommodation: false, deposit_paid: false, travel_minutes: 0 }; const flags = [];
    if (/dry hire|classic tui|self-serve|supplying all beverages and bar staff/i.test(t)) b.package = "dry_hire"; else if (/fully catered|premium tui/i.test(t)) b.package = "fully_catered"; else if (/byo|tui experience|you supply the alcohol/i.test(t)) b.package = "byo";
    if (/agreement|signed|locked in|booked in|confirmed|deposit (?:paid|received)/i.test(t)) b.status = "confirmed";
    b.client_name = line(/^\s*Client\s*[:\-]?\s*(.+)$/im) || line(/between The Tipsy Tui Limited.*?and\s+(.+?)\s*\(the\s*[“"]Hirer/is) || null;
    if (b.client_name) b.client_name = b.client_name.replace(/\[.*?\]/g, "").replace(/\s{2,}/g, " ").trim();
    b.event_name = line(/^\s*EVENT\s*[:\-]?\s+(.+)$/m) || null;
    b.event_date = parseDateText(line(/Event Date\s*[:\-]?\s*(.+)/i) || line(/^\s*DATE\s*[:\-]?\s+(.+)$/m) || line(/Hire Date\(s\):\s*(.+)/i) || t);
    b.venue = line(/^\s*Venue\s*[:\-]?\s*(.+)$/im) || line(/^\s*LOCATION\s*[:\-]?\s+(.+)$/m) || line(/Event Location:\s*(.+)/i) || line(/\bat\s+(?:the\s+)?([A-Z][\w'’]+(?:\s+[A-Z][\w'’]+){0,4})(?:\s+in\s+[A-Z]\w+)?/) || null;
    const g = t.match(/Guest(?:s| Count| numbers)?\s*[:\-]?\s*(?:Approximately|approx\.?|about)?\s*(\d{1,4})/i) || t.match(/(?:about|around|approx\.?|roughly)?\s*(\d{2,4})\s*(?:people|pax|guests|heads|ppl)/i); if (g) b.guest_count = +g[1];
    const times = t.match(/(\d{1,2}(?::\d{2})?\s*[ap]\.?m)\s*(?:–|-|—|to|till|until)\s*(\d{1,2}(?::\d{2})?\s*[ap]\.?m)/i);
    if (times) { b.start_time = parseTime(times[1]); b.finish_time = parseTime(times[2]); }
    else { const one = t.match(/(?:from|at|start(?:ing)?|kick(?:s|ing)? off)\s*(\d{1,2}(?::\d{2})?\s*[ap]\.?m)/i) || t.match(/(\d{1,2}(?::\d{2})?\s*[ap]\.?m)\s*(?:till|until|-|–)\s*late/i); if (one) { b.start_time = parseTime(one[1]); flags.push("Only a start time found. Confirm when the bar closes."); } else flags.push("No bar hours found. Confirm start and finish times."); }
    if (!b.client_name) { const signoff = t.match(/(?:cheers|thanks|thank you|regards|kind regards|ta|ngā mihi),?\s*\n?\s*([A-Z][a-z]+(?:\s+(?:&|and)\s+[A-Z][a-z]+)?(?:\s+[A-Z][a-z]+)?)\s*$/im); if (signoff) { b.client_name = signoff[1].trim(); flags.push("Client name taken from the email sign-off. Check it."); } }
    const bt = t.match(/Bartenders?\s*[:\-]?\s*(\d+)/i); if (bt) b.bartender_count = +bt[1];
    const total = t.match(/TOTAL\s*(?:NZ)?\$\s*([\d,]+(?:\.\d{1,2})?)/i) || t.match(/HIRE FEE\s*(?:NZ)?\$\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (total) b.total = Number(total[1].replace(/,/g, "")); else flags.push("No total found. Add the price.");
    const bond = t.match(/Bond\s*(?:of)?\s*\$?\s*(\d+)/i); if (bond) b.bond_amount = +bond[1];
    const depPct = t.match(/deposit\s*(?:of)?\s*(\d{1,2})\s*%/i); const depAmt = t.match(/deposit\s*(?:of)?\s*\$\s*([\d,]+)/i);
    if (depAmt) b.deposit_amount = Number(depAmt[1].replace(/,/g, "")); else if (depPct && b.total) b.deposit_amount = Math.round(b.total * (+depPct[1] / 100));
    const em = t.match(/[\w.+-]+@[\w-]+\.[\w.]+/); if (em && !/thetipsytui|leadhive/i.test(em[0])) b.email = em[0];
    const ph = t.match(/(?:\+64|0)[23]\d[\s-]?\d{3}[\s-]?\d{3,4}/); if (ph) b.phone = ph[0];
    b.glassware = /glassware included|glassware \(/i.test(t) && !/BYO glassware/i.test(t);
    b.generator = /generator/i.test(t); b.fairy_lights = /fairy lights/i.test(t); b.cocktails = /cocktail/i.test(t); b.accommodation = /accommodation/i.test(t);
    const hay = ((b.venue || "") + " " + (b.event_name || "") + " " + t.slice(0, 600)).toLowerCase();
    for (const [place, mins] of TRAVEL_GUESS) if (hay.includes(place)) { b.travel_minutes = mins; break; }
    if (/wedding/i.test(t) || /\s(&|and)\s/i.test(b.client_name || "")) b.event_type = "wedding"; else if (/birthday|21st|30th|40th|50th/i.test(t)) b.event_type = "birthday"; else if (/reunion/i.test(t)) b.event_type = "reunion"; else if (/office|corporate|staff|christmas|company|structures|ltd|limited/i.test(hay)) b.event_type = "corporate"; else b.event_type = "other";
    if (b.client_name && !b.event_name) b.event_name = b.event_type === "wedding" ? `${b.client_name}'s wedding` : null;
    if (!b.client_name) flags.push("Couldn't find the client's name."); if (!b.event_date) flags.push("Couldn't find the event date."); if (!b.venue) flags.push("No venue found.");
    if (/venue tbc|date tbc/i.test(t)) flags.push("Document says venue or date is TBC."); if (/liquor licen/i.test(t)) flags.push("Check the client has sorted the liquor licence.");
    if (/travel/i.test(t) && !b.travel_minutes) flags.push("It mentions travel but no drive time was set. Add the minutes from Christchurch.");
    b.flags = flags; b.summary = `Read ${b.package === "dry_hire" ? "a dry hire" : b.package === "byo" ? "a BYO bar" : "a fully catered"} job${b.client_name ? " for " + b.client_name : ""}${b.event_date ? " on " + fmtDate(b.event_date) : ""}.`;
    return b;
  }
  // Pull only the things an update message actually mentions.
  function localUpdate(text, existing) {
    const p = localParse(text), out = {}, t = text;
    if (/\d+\s*(?:people|pax|guests|heads|ppl)|guest(?:s| count)/i.test(t) && p.guest_count) out.guest_count = p.guest_count;
    if (p.start_time && p.finish_time) { out.start_time = p.start_time; out.finish_time = p.finish_time; }
    if (/venue|location|at the|moved to/i.test(t) && p.venue) out.venue = p.venue;
    if (p.event_date && /date|moved|now on|changed to|instead/i.test(t)) out.event_date = p.event_date;
    if (/cocktail/i.test(t)) out.cocktails = !/no cocktail|without cocktail|drop(?:ping)? the cocktail/i.test(t);
    if (/generator/i.test(t)) out.generator = !/no generator|don'?t need (?:the|a) generator/i.test(t);
    if (/fairy lights/i.test(t)) out.fairy_lights = !/no fairy lights/i.test(t);
    if (/glassware|cups/i.test(t)) out.glassware = !/no glassware|their own glass|byo glass/i.test(t);
    if (/accommodation/i.test(t)) out.accommodation = true;
    if (/dry hire|fully catered|byo/i.test(t)) out.package = p.package;
    if (/bartenders?\s*\d+|\d+\s*bartenders?/i.test(t)) { const m = t.match(/(\d+)\s*bartenders?|bartenders?\s*[:\-]?\s*(\d+)/i); out.bartender_count = +(m[1] || m[2]); }
    if (p.total && /total|price|quote/i.test(t)) out.total = p.total;
    if (p.travel_minutes && !existing.travel_minutes) out.travel_minutes = p.travel_minutes;
    if (/deposit (?:paid|received|came through|landed)/i.test(t)) { out.deposit_paid = true; if (existing.status !== "confirmed") out.status = "confirmed"; }
    if (/balance (?:paid|received)|paid in full/i.test(t)) out.balance_paid = true;
    for (const k of Object.keys(out)) if (String(out[k]) === String(existing[k] ?? "") || (typeof out[k] === "boolean" && out[k] === !!existing[k])) delete out[k];
    return out;
  }

  // Local fallback for talking to a job: tick tasks by keyword, pull changes with localUpdate, catch "add a task to ...".
  const STOP = new Set(["the", "a", "an", "and", "to", "of", "for", "with", "on", "in", "at", "is", "it", "its", "it's", "up", "off", "out", "&", "+", "i", "ive", "i've", "we", "weve", "we've", "got", "have", "has", "been", "done", "did", "do", "that", "this", "all", "now", "also", "just", "so", "then", "them", "sorted", "finished", "ticked", "tick", "please", "can", "you", "yeah", "ok", "okay", "um", "ah", "hey", "job", "client", "check", "confirm"]);
  const words = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9$'& ]+/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w)).map((w) => w.replace(/s$/, ""));
  function localCommand(text, booking, tasks) {
    const out = { done: [], undone: [], newTasks: [], changes: localUpdate(text, booking), notesAppend: "", reply: "" };
    const segs = text.split(/\s*(?:,|\.|;|\band\b|\balso\b|\bplus\b)\s*/i).map((x) => x.trim()).filter(Boolean);
    const open = tasks.filter((t) => !t.done), done = tasks.filter((t) => t.done);
    for (const seg of segs) {
      const add = seg.match(/(?:add (?:a )?(?:task|reminder|to-?do)(?: to| for)?|remind (?:me|us) to|need to|needs? to|note to)\s+(.+)/i);
      if (add) { out.newTasks.push({ title: add[1].replace(/^(?:to|that)\s+/i, "").trim(), due_date: "", who: "both" }); continue; }
      if (/\d+\s*(?:people|pax|guests|heads)|\d\s*[ap]m|\$\s*\d/i.test(seg) && !/done|sorted|finished|paid|sent|bought|collected|booked|ticked/i.test(seg)) continue;
      const undo = /not (?:actually )?done|haven'?t|hasn'?t|didn'?t|untick|undo|still need/i.test(seg);
      const pool = undo ? done : open, sw = new Set(words(seg)); if (!sw.size) continue;
      let best = null, bestScore = 0;
      for (const t of pool) { const tw = words(t.title); const score = tw.filter((w) => sw.has(w) || [...sw].some((x) => x.length > 3 && (w.startsWith(x) || x.startsWith(w)))).length; const ratio = tw.length ? score / tw.length : 0; if (score > bestScore || (score === bestScore && best && ratio > (words(best.title).filter((w) => sw.has(w)).length / words(best.title).length))) { best = t; bestScore = score; } }
      if (best && bestScore >= 1 && (bestScore >= 2 || words(best.title).length <= 3 || bestScore / words(best.title).length >= 0.5)) { (undo ? out.undone : out.done).push(best.title); }
    }
    out.done = [...new Set(out.done)]; out.undone = [...new Set(out.undone)];
    const n = out.done.length + Object.keys(out.changes).length + out.newTasks.length;
    out.reply = n ? `Got ${out.done.length ? out.done.length + " ticked off" : ""}${out.done.length && Object.keys(out.changes).length ? ", " : ""}${Object.keys(out.changes).length ? Object.keys(out.changes).length + " change" + (Object.keys(out.changes).length === 1 ? "" : "s") : ""}${out.newTasks.length ? (out.done.length || Object.keys(out.changes).length ? ", " : "") + out.newTasks.length + " new task" + (out.newTasks.length === 1 ? "" : "s") : ""}. Check and apply.` : "Couldn't match that to a task or a detail. Try naming the task.";
    return out;
  }

  // ============================================================ data layers
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "id-" + Math.random().toString(36).slice(2) + Date.now());
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* blocked */ } };

  const LocalDB = {
    key: "tipsy-tui-demo-v3", data: null,
    read() { try { return JSON.parse(lsGet(this.key)) || null; } catch { return null; } },
    write(d) { lsSet(this.key, JSON.stringify(d)); },
    async init() { this.data = this.read() || demoSeed(); this.write(this.data); return { user: { id: "demo", name: TEAM[0] } }; },
    async load() { return structuredClone(this.data); },
    async signIn() {}, async signOut() {},
    async upsertBooking(b) { const i = this.data.bookings.findIndex((x) => x.id === b.id); const row = { ...b, updated_at: new Date().toISOString() }; if (i >= 0) this.data.bookings[i] = row; else { row.id = row.id || uuid(); row.created_at = new Date().toISOString(); this.data.bookings.push(row); } this.write(this.data); return row; },
    async deleteBooking(id) { this.data.bookings = this.data.bookings.filter((x) => x.id !== id); this.data.tasks = this.data.tasks.filter((x) => x.booking_id !== id); this.data.booking_staff = this.data.booking_staff.filter((x) => x.booking_id !== id); this.write(this.data); },
    async insertTasks(rows) { const out = rows.map((r) => ({ done: false, ...r, id: uuid() })); this.data.tasks.push(...out); this.write(this.data); return out; },
    async updateTask(id, patch) { const t = this.data.tasks.find((x) => x.id === id); Object.assign(t, patch); this.write(this.data); return t; },
    async deleteTask(id) { this.data.tasks = this.data.tasks.filter((x) => x.id !== id); this.write(this.data); },
    async upsertStaff(s) { const i = this.data.staff.findIndex((x) => x.id === s.id); if (i >= 0) this.data.staff[i] = s; else { s.id = uuid(); this.data.staff.push(s); } this.write(this.data); return s; },
    async setCrew(bookingId, staffIds) { this.data.booking_staff = this.data.booking_staff.filter((x) => x.booking_id !== bookingId).concat(staffIds.map((sid) => ({ id: uuid(), booking_id: bookingId, staff_id: sid }))); this.write(this.data); },
    async intake(text) { return { booking: localParse(text), source_text: text, engine: "local" }; },
    async intakeUpdate(text, existing) { return { changes: localUpdate(text, existing), engine: "local" }; },
    async command(text, booking, tasks) { return { ...localCommand(text, booking, tasks), engine: "local" }; },
    reset() { this.data = demoSeed(); this.write(this.data); },
  };

  const SupabaseDB = {
    sb: null, user: null,
    async init() {
      this.sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
      const { data: { session } } = await this.sb.auth.getSession();
      this.sb.auth.onAuthStateChange((_e, s) => { const changed = (s?.user?.id || null) !== (this.user?.id || null); this.user = s?.user || null; if (changed) boot(); });
      this.user = session?.user || null;
      return { user: this.user ? await this.profile() : null };
    },
    async profile() { const { data } = await this.sb.from("profiles").select("name").eq("id", this.user.id).maybeSingle(); return { id: this.user.id, name: data?.name || this.user.email.split("@")[0] }; },
    async signIn(email, password) { const { error } = await this.sb.auth.signInWithPassword({ email, password }); if (error) throw error; },
    async signOut() { await this.sb.auth.signOut(); },
    async load() {
      const [b, t, s, bs] = await Promise.all([this.sb.from("bookings").select("*").order("event_date"), this.sb.from("tasks").select("*").order("sort"), this.sb.from("staff").select("*").order("role").order("name"), this.sb.from("booking_staff").select("*")]);
      for (const r of [b, t, s, bs]) if (r.error) throw r.error;
      return { bookings: b.data, tasks: t.data, staff: s.data, booking_staff: bs.data };
    },
    async upsertBooking(b) {
      const row = { ...b }; for (const k of ["flags", "summary", "engine"]) delete row[k];
      if (!Array.isArray(row.review_flags)) row.review_flags = [];
      for (const k of Object.keys(row)) if (row[k] === "") row[k] = null;
      if (!row.id) { delete row.id; row.created_by = this.user.id; }
      const { data, error } = await this.sb.from("bookings").upsert(row).select().single(); if (error) throw error; return data;
    },
    async deleteBooking(id) { const { error } = await this.sb.from("bookings").delete().eq("id", id); if (error) throw error; },
    async insertTasks(rows) { const { data, error } = await this.sb.from("tasks").insert(rows).select(); if (error) throw error; return data; },
    async updateTask(id, patch) { const { data, error } = await this.sb.from("tasks").update(patch).eq("id", id).select().single(); if (error) throw error; return data; },
    async deleteTask(id) { const { error } = await this.sb.from("tasks").delete().eq("id", id); if (error) throw error; },
    async upsertStaff(s) { const row = { ...s }; if (!row.id) delete row.id; const { data, error } = await this.sb.from("staff").upsert(row).select().single(); if (error) throw error; return data; },
    async setCrew(bookingId, staffIds) { const del = await this.sb.from("booking_staff").delete().eq("booking_id", bookingId); if (del.error) throw del.error; if (staffIds.length) { const ins = await this.sb.from("booking_staff").insert(staffIds.map((staff_id) => ({ booking_id: bookingId, staff_id }))); if (ins.error) throw ins.error; } },
    async callIntake(body) {
      const names = [...new Set([CFG.INTAKE_FUNCTION || "intake", "intake", "Intake"])];
      let data = null, error = null;
      for (const name of names) { ({ data, error } = await this.sb.functions.invoke(name, { body })); const unreachable = error && !(error.context && typeof error.context.status === "number" && error.context.status !== 404); if (!unreachable) break; }
      if (error || data?.error) {
        let reason = data?.error || (error && error.message) || "Intake failed";
        try { const ctx = error && error.context; if (ctx && typeof ctx.json === "function") { const j = await ctx.clone().json(); if (j && j.error) reason = j.error + " (HTTP " + ctx.status + ")"; } } catch { /* keep */ }
        return { error: reason };
      }
      return data;
    },
    async intake(text, file) {
      const body = { text }; if (file) { body.file_base64 = await fileToBase64(file); body.file_type = file.type; }
      const r = await this.callIntake(body);
      if (r.error) { if (!text) throw new Error(r.error); const b = localParse(text); b.flags.unshift("AI intake unavailable: " + r.error + ". Used the basic parser instead."); return { booking: b, source_text: text, engine: "local" }; }
      return { ...r, engine: "claude" };
    },
    async intakeUpdate(text, existing) {
      const keep = {}; for (const k of UPDATE_FIELDS) keep[k] = existing[k] ?? null;
      const material = `This job is ALREADY BOOKED. Below is the current booking, then a new message from the client or Joe with changes. Return the booking with the changes applied and everything else unchanged. Do not blank out existing details.\n\nCURRENT BOOKING (JSON):\n${JSON.stringify(keep)}\n\nNEW MESSAGE:\n${text}`;
      const r = await this.callIntake({ text: material });
      if (r.error) return { changes: localUpdate(text, existing), engine: "local", warning: r.error };
      const changes = {}; const nb = r.booking || {};
      for (const k of UPDATE_FIELDS) {
        const nv = nb[k], ov = existing[k] ?? null;
        if (nv == null || nv === "") continue;
        if (typeof nv === "boolean") { if (nv !== !!ov) changes[k] = nv; continue; }
        if (/_time$/.test(k) ? hm(nv) !== hm(ov) : String(nv) !== String(ov ?? "")) changes[k] = nv;
      }
      if (changes.status && !/confirmed|cancel|quoted|enquir|deposit/i.test(text)) delete changes.status;
      return { changes, engine: "claude" };
    },
  };
  SupabaseDB.command = async function (text, booking, tasks) {
    const keep = {}; for (const k of UPDATE_FIELDS) keep[k] = booking[k] ?? null; keep.notes = booking.notes ?? "";
    const r = await this.callIntake({ mode: "command", text, booking: keep, open_tasks: tasks.filter((t) => !t.done).map((t) => t.title), done_tasks: tasks.filter((t) => t.done).map((t) => t.title) });
    if (r.error || !r.command) return { ...localCommand(text, booking, tasks), engine: "local", warning: r.error || "No answer" };
    const c = r.command, changes = {};
    for (const k of ["guest_count", "bartender_count", "total", "travel_minutes"]) if (c[k] != null && String(c[k]) !== String(booking[k] ?? "")) changes[k] = c[k];
    for (const k of ["event_date", "venue", "address", "kegs_on_tap", "drinks_notes"]) if (c[k] && c[k] !== (booking[k] ?? "")) changes[k] = c[k];
    for (const k of ["start_time", "finish_time"]) if (c[k] && hm(c[k]) !== hm(booking[k])) changes[k] = c[k];
    for (const k of ["package", "status"]) if (c[k] && c[k] !== "unchanged" && c[k] !== booking[k]) changes[k] = c[k];
    for (const k of ["cocktails", "generator", "fairy_lights", "glassware", "accommodation", "deposit_paid", "balance_paid"]) if (c[k] === "yes" || c[k] === "no") { const v = c[k] === "yes"; if (v !== !!booking[k]) changes[k] = v; }
    const titles = new Set(tasks.map((t) => t.title));
    return { done: (c.done_tasks || []).filter((t) => titles.has(t)), undone: (c.undone_tasks || []).filter((t) => titles.has(t)), newTasks: c.new_tasks || [], changes, notesAppend: c.notes_append || "", reply: c.reply || "", engine: "claude" };
  };
  const UPDATE_FIELDS = ["client_name", "contact_name", "email", "phone", "event_name", "event_type", "event_date", "start_time", "finish_time", "venue", "address", "travel_minutes", "guest_count", "package", "bartender_count", "glassware", "generator", "fairy_lights", "cocktails", "accommodation", "kegs_on_tap", "drinks_notes", "total", "deposit_amount", "bond_amount", "status", "deposit_paid", "balance_paid"];
  const FIELD_LABEL = { client_name: "Client", contact_name: "Contact", email: "Email", phone: "Phone", event_name: "Event", event_type: "Type", event_date: "Date", start_time: "Bar opens", finish_time: "Last drinks", venue: "Venue", address: "Suburb / town", travel_minutes: "Drive (min)", guest_count: "Guests", package: "Package", bartender_count: "Bartenders", glassware: "Glassware", generator: "Generator", fairy_lights: "Fairy lights", cocktails: "Cocktails", accommodation: "Accommodation", kegs_on_tap: "On tap", drinks_notes: "Drinks", total: "Total", deposit_amount: "Deposit", bond_amount: "Bond", status: "Status", deposit_paid: "Deposit paid", balance_paid: "Balance paid", notes: "Notes" };
  const fileToBase64 = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(file); });

  function demoSeed() {
    const d = (n) => addDays(todayISO(), n);
    const staff = [{ id: "s-joe", name: TEAM[0], role: "owner", hourly_rate: 0, active: true }, { id: "s-kieran", name: TEAM[1] || "Kieran", role: "owner", hourly_rate: 0, active: true }, { id: "s-1", name: "Tash (example)", role: "bartender", phone: "021 000 0001", hourly_rate: 30, active: true }, { id: "s-2", name: "Ben (example)", role: "bartender", phone: "021 000 0002", hourly_rate: 30, active: true }];
    const base = { setup_hours: 1, packdown_hours: 1, glassware: false, generator: false, fairy_lights: false, cocktails: false, accommodation: false, deposit_paid: false, balance_paid: false, bond_amount: 0, bond_paid: false, bond_refunded: false, kegs_on_tap: "", drinks_notes: "", review_flags: [], created_at: new Date().toISOString() };
    const bookings = [
      { ...base, id: "b1", status: "confirmed", client_name: "Sam & Priya (example)", contact_name: "Sam", email: "sam@example.com", phone: "021 555 0101", event_name: "Sam & Priya's wedding", event_type: "wedding", event_date: d(9), start_time: "15:00", finish_time: "22:00", venue: "Westhaven Gardens", address: "West Melton", travel_minutes: 25, guest_count: 90, package: "byo", bartender_count: null, glassware: true, fairy_lights: true, kegs_on_tap: "2 × 50L Southpaw Pilsner, 1 × 30L Zeffer cider", drinks_notes: "Wine and bubbles for the toast, RTDs in cans.", total: 1300, deposit_amount: 325, deposit_paid: true, notes: "Park on the gravel pad by the marquee. Power from the shed, 20 m lead. Speeches 6:30pm, keep the bar quiet then." },
      { ...base, id: "b2", status: "confirmed", client_name: "Harrington Homes (example)", contact_name: "Dee", email: "dee@example.com", phone: "03 555 0102", event_name: "Harrington Homes Christmas do", event_type: "corporate", event_date: d(23), start_time: "16:30", finish_time: "20:30", venue: "Harrington Homes yard", address: "Sockburn, Christchurch", travel_minutes: 0, guest_count: 60, package: "fully_catered", bartender_count: 2, glassware: true, cocktails: true, kegs_on_tap: "1 × 50L Cassels Lager, 1 × 30L Three Boys Hazy", drinks_notes: "Allowance: beer $600, wine $300, sparkling $200, spirits $250, soft $80. Cocktails: Aperol spritz, mojito.", total: 3240, deposit_amount: 810, notes: "Yard is fenced, ask Dee for the gate code. H&S induction on arrival." },
      { ...base, id: "b3", status: "confirmed", client_name: "Lincoln Rugby Club (example)", contact_name: "Kylie", email: "", phone: "027 555 0103", event_name: "Lincoln Rugby Club 50th reunion", event_type: "reunion", event_date: d(45), start_time: "14:00", finish_time: "19:00", venue: "Lincoln Domain", address: "Lincoln", travel_minutes: 25, guest_count: 100, package: "dry_hire", bartender_count: null, generator: true, drinks_notes: "Club is sorting their own kegs.", total: 699, deposit_amount: 0, deposit_paid: true, bond_amount: 300, notes: "No power at the domain, generator needed. Club has a special licence." },
      { ...base, id: "b4", status: "quoted", client_name: "Mel Thompson (example)", contact_name: "Mel", email: "mel@example.com", phone: "", event_name: "Mel's 30th", event_type: "birthday", event_date: d(70), start_time: "18:00", finish_time: "23:00", venue: "Private bach", address: "Akaroa", travel_minutes: 85, guest_count: 45, package: "byo", bartender_count: null, glassware: true, fairy_lights: true, cocktails: true, accommodation: true, total: 1150, deposit_amount: null, notes: "Quote sent, waiting to hear back. Steep driveway, check caravan access." },
      { ...base, id: "b5", status: "completed", client_name: "Tuatara Structures (example)", contact_name: "Rob", email: "", phone: "", event_name: "Office drinks", event_type: "corporate", event_date: d(-12), start_time: "16:30", finish_time: "19:30", venue: "Tuatara Structures office", address: "Christchurch", travel_minutes: 0, guest_count: 80, package: "byo", bartender_count: 2, glassware: true, kegs_on_tap: "1 × 50L Summit Ultra", total: 800, deposit_amount: 200, deposit_paid: true, balance_paid: true, notes: "" },
    ];
    const tasks = [];
    for (const b of bookings) {
      const gen = generateTasks(b).map((t) => ({ ...t, id: uuid(), booking_id: b.id, done: false }));
      gen.forEach((t) => { if (t.due_date && t.due_date < todayISO()) { t.done = true; t.done_at = new Date().toISOString(); } });
      if (b.id === "b2") gen.forEach((t) => { if (/Roster|licence/.test(t.title)) { t.done = false; delete t.done_at; } });
      tasks.push(...gen);
    }
    const booking_staff = [{ id: uuid(), booking_id: "b1", staff_id: "s-joe" }, { id: uuid(), booking_id: "b1", staff_id: "s-kieran" }, { id: uuid(), booking_id: "b2", staff_id: "s-joe" }, { id: uuid(), booking_id: "b5", staff_id: "s-joe" }, { id: uuid(), booking_id: "b5", staff_id: "s-1" }];
    return { bookings, tasks, staff, booking_staff };
  }

  // ============================================================ state & helpers
  const DB = DEMO ? LocalDB : SupabaseDB;
  const state = { user: null, bookings: [], tasks: [], staff: [], booking_staff: [], view: "jobs", bookingId: null, jobTab: "overview", jobFilter: "upcoming", todoWho: "all", calMonth: null, calSelected: null, editing: null, intakeBusy: false, confirmDelete: false, calendarToken: lsGet("tipsy-cal-token") || "" };
  const $ = (sel, root = document) => root.querySelector(sel);
  const el = (id) => document.getElementById(id);
  const h = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const bookingById = (id) => state.bookings.find((b) => b.id === id);
  const tasksFor = (id) => state.tasks.filter((t) => t.booking_id === id).sort((a, b) => (a.due_date || "").localeCompare(b.due_date || "") || a.sort - b.sort);
  const crewFor = (id) => state.booking_staff.filter((x) => x.booking_id === id).map((x) => state.staff.find((s) => s.id === x.staff_id)).filter(Boolean);
  const isLive = (b) => b.status === "confirmed" || b.status === "quoted" || b.status === "enquiry";
  const whoIdx = (name) => { const i = TEAM.indexOf(name); return i < 0 ? 2 : i; };
  const initials = (name) => String(name || "").split(/\s+/).map((x) => x[0]).join("").slice(0, 2).toUpperCase();

  let toastTimer;
  function toast(msg) { const t = el("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2400); }
  async function copyText(text) { try { await navigator.clipboard.writeText(text); toast("Copied"); } catch { toast("Couldn't copy here. Select the text and copy it."); } }
  function download(name, text, mime = "text/calendar") { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: mime })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); }

  // Bottom sheet
  function openSheet({ title, body, foot, onMount }) {
    el("sheet").innerHTML = `<div class="sheet-backdrop" data-action="sheet-close"><div class="sheet" role="dialog" aria-label="${h(title)}" style="position:relative"><i class="grab"></i><div class="sheet-head"><h2>${h(title)}</h2><button class="btn ghost sm" data-action="sheet-close" aria-label="Close">✕</button></div><div class="sheet-body">${body}</div>${foot ? `<div class="sheet-foot">${foot}</div>` : ""}</div></div>`;
    document.body.style.overflow = "hidden";
    if (onMount) onMount(el("sheet"));
  }
  function closeSheet() { if (recog) { try { recog.stop(); } catch { /* */ } recog = null; } el("sheet").innerHTML = ""; document.body.style.overflow = ""; }

  async function boot() {
    try {
      const { user } = await DB.init(); state.user = user;
      el("modePill").hidden = !DEMO;
      if (!user) { el("tabbar").hidden = true; el("appbar").hidden = true; renderAuth(); return; }
      await reload(); await migrateChecklists(); el("tabbar").hidden = false; el("appbar").hidden = false; render();
    } catch (e) { el("view").innerHTML = `<div class="card"><h2>Couldn't start</h2><p class="muted">${h(e.message || e)}</p><p class="small muted" style="margin-top:8px">Check the Supabase URL and key in config.js, and that schema.sql has been run.</p></div>`; }
  }
  async function reload() { Object.assign(state, await DB.load()); }
  // One-off: jobs booked under the old checklist get the new short task set (ticked items stay ticked).
  async function migrateChecklists() {
    const flag = "tipsy-checklist-v3"; if (lsGet(flag)) return;
    try {
      for (const b of state.bookings.filter(isLive)) {
        const ts = state.tasks.filter((t) => t.booking_id === b.id);
        if (ts.some((t) => OLD_TEMPLATE_TITLES.has(normTitle(t.title)))) await syncTasks(b);
      }
      await reload();
    } finally { lsSet(flag, "1"); }
  }
  function setView(v, extra = {}) { Object.assign(state, { view: v, confirmDelete: false }, extra); render(); window.scrollTo({ top: 0 }); }
  const BAR_TITLES = { jobs: "Jobs", detail: "Job", calendar: "Calendar", todo: "To-do", new: "Book a job", more: "More" };
  function render() {
    document.querySelectorAll("#tabbar button[data-view]").forEach((b) => b.classList.toggle("active", b.dataset.view === state.view || (state.view === "detail" && b.dataset.view === "jobs")));
    el("barTitle").textContent = BAR_TITLES[state.view] || "Tipsy Tui";
    ({ jobs: renderJobs, detail: renderDetail, calendar: renderCalendar, todo: renderTodo, new: renderNew, more: renderMore })[state.view](el("view"));
  }

  // ============================================================ views
  function renderAuth() {
    el("view").innerHTML = `<div class="auth"><img src="logo-small.jpg" alt="The Tipsy Tui"><h1>Tipsy Tui Bookings</h1><p class="muted">Sign in to see the jobs.</p>
      <form id="loginForm" class="stack"><div class="field"><label for="email">Email</label><input id="email" type="email" required autocomplete="username"></div><div class="field"><label for="password">Password</label><input id="password" type="password" required autocomplete="current-password"></div><button class="btn primary block" type="submit">Sign in</button><p class="small muted" id="loginErr"></p></form></div>`;
    $("#loginForm").addEventListener("submit", async (e) => { e.preventDefault(); try { await DB.signIn(el("email").value.trim(), el("password").value); } catch (err) { el("loginErr").textContent = err.message; } });
  }

  function jobCard(b) {
    const d = parseISO(b.event_date), past = daysUntil(b.event_date) < 0, open = tasksFor(b.id).filter((t) => !t.done).length, crew = crewFor(b.id), need = bartendersFor(b);
    const chips = [`<span class="chip pkg-${b.package}">${PKG[b.package].label}</span>`];
    if (b.status !== "confirmed") chips.push(`<span class="chip st-${b.status}">${STATUS[b.status]}</span>`);
    if (isLive(b) && !past) {
      if (!b.deposit_paid && b.status === "confirmed" && depositFor(b)) chips.push(`<span class="chip warn">Deposit unpaid</span>`);
      if (need > 0 && crew.length < need) chips.push(`<span class="chip ${daysUntil(b.event_date) <= 14 ? "bad" : "warn"}">Crew ${crew.length}/${need}</span>`);
      if (open) chips.push(`<span class="chip">${open} to do</span>`);
    }
    return `<div class="card job ${past ? "past" : ""} ${b.status !== "confirmed" ? "quoted" : ""}" data-action="open" data-id="${b.id}" role="button" tabindex="0">
      <div class="datebox"><div class="d num">${d.getDate()}</div><div class="m">${MON[d.getMonth()]}</div><div class="w">${DOW[d.getDay()]}</div></div>
      <div style="min-width:0"><div class="title"><h3>${h(b.client_name)}</h3><span class="small muted num" style="white-space:nowrap">${relDay(b.event_date)}</span></div>
        <div class="meta">${h(b.event_name || PKG[b.package].alt)}</div>
        <div class="meta num">${ic("pin")}${h(b.venue || "Venue TBC")} &nbsp; ${ic("users")}${b.guest_count || "?"} &nbsp; ${ic("clock")}${fmt12(hm(b.start_time))}–${fmt12(hm(b.finish_time))}</div>
        <div class="chips">${chips.join("")}</div></div></div>`;
  }

  function renderJobs(v) {
    const today = todayISO(), live = state.bookings.filter(isLive);
    const upcoming = live.filter((b) => b.event_date >= today).sort((a, b) => a.event_date.localeCompare(b.event_date));
    const confirmed = upcoming.filter((b) => b.status === "confirmed");
    const next = confirmed[0] || upcoming[0]; const in30 = upcoming.filter((b) => daysUntil(b.event_date) <= 30);
    const crewGap = in30.filter((b) => b.status === "confirmed").reduce((n, b) => n + Math.max(0, bartendersFor(b) - crewFor(b.id).length), 0);
    const owed = confirmed.reduce((n, b) => { const rs = runSheet(b); return n + (!b.deposit_paid && rs.deposit ? rs.deposit : 0) + (!b.balance_paid && rs.balance && daysUntil(b.event_date) <= 7 ? rs.balance : 0); }, 0);
    const overdue = state.tasks.filter((t) => !t.done && t.due_date && t.due_date < today && bookingById(t.booking_id) && isLive(bookingById(t.booking_id)));
    const issues = [];
    for (const b of in30.filter((x) => x.status === "confirmed")) {
      const need = bartendersFor(b), have = crewFor(b.id).length, rs = runSheet(b);
      if (need > have) issues.push(`<li><a data-action="open" data-id="${b.id}">${h(b.client_name)}</a> needs ${need - have} more bartender${need - have === 1 ? "" : "s"} (${relDay(b.event_date)})</li>`);
      if (!b.deposit_paid && rs.deposit) issues.push(`<li><a data-action="open" data-id="${b.id}">${h(b.client_name)}</a>: deposit ${money(rs.deposit)} not paid</li>`);
      if (!b.balance_paid && rs.balance && daysUntil(b.event_date) <= 7) issues.push(`<li><a data-action="open" data-id="${b.id}">${h(b.client_name)}</a>: balance ${money(rs.balance)} due now</li>`);
    }
    if (overdue.length) issues.push(`<li><a data-action="goto" data-view="todo">${overdue.length} overdue task${overdue.length === 1 ? "" : "s"}</a> across the jobs</li>`);
    const f = state.jobFilter; let list;
    if (f === "upcoming") list = confirmed; else if (f === "quoted") list = upcoming.filter((b) => b.status !== "confirmed");
    else if (f === "past") list = state.bookings.filter((b) => b.event_date < today || b.status === "completed" || b.status === "cancelled").sort((a, b) => b.event_date.localeCompare(a.event_date));
    else list = [...state.bookings].sort((a, b) => a.event_date.localeCompare(b.event_date));
    v.innerHTML = `
      <div class="hero"><div class="kicker">${fmtDate(today)}</div><h1>Kia ora, ${h(state.user.name)}</h1><p class="where">${confirmed.length} confirmed job${confirmed.length === 1 ? "" : "s"} coming up${upcoming.length - confirmed.length ? `, ${upcoming.length - confirmed.length} quoted` : ""}.</p></div>
      <div class="tiles hero-tiles">
        <div class="tile"><span class="label">Next job</span><div class="v num">${next ? (daysUntil(next.event_date) === 0 ? "Today" : daysUntil(next.event_date) + "d") : "—"}</div><div class="s">${next ? h(next.client_name) : "Nothing booked"}</div></div>
        <div class="tile"><span class="label">Next 30 days</span><div class="v num">${in30.length}</div><div class="s">job${in30.length === 1 ? "" : "s"}</div></div>
        <div class="tile"><span class="label">Crew to roster</span><div class="v num ${crewGap ? "warn" : ""}">${crewGap}</div><div class="s">bartender slot${crewGap === 1 ? "" : "s"}</div></div>
        <div class="tile"><span class="label">To collect</span><div class="v num ${owed ? "warn" : ""}">${money(owed)}</div><div class="s">deposits + balances due</div></div>
      </div>
      ${issues.length ? `<div class="card attention section"><b>${ic("alert")} Needs a look</b><ul>${issues.join("")}</ul></div>` : ""}
      <div class="section">
        <div class="filters">${[["upcoming", "Upcoming"], ["quoted", "Quotes"], ["past", "Past"], ["all", "All"]].map(([k, l]) => `<button data-action="filter" data-f="${k}" class="${f === k ? "active" : ""}">${l}</button>`).join("")}</div>
        ${list.length ? list.map(jobCard).join("") : `<div class="empty">Nothing here yet. Tap <b>Book</b> to add a job.</div>`}
      </div>`;
  }

  // ---------- job page ----------
  function renderDetail(v) {
    const b = bookingById(state.bookingId); if (!b) return setView("jobs");
    const crew = crewFor(b.id), rs = runSheet(b, crew.map((s) => s.name)), tasks = tasksFor(b.id), done = tasks.filter((t) => t.done).length, open = tasks.length - done;
    const tab = state.jobTab;
    const crewCls = rs.bartenders === 0 ? "" : crew.length >= rs.bartenders ? "good" : (daysUntil(b.event_date) <= 14 ? "bad" : "warn");
    const moneyTile = b.balance_paid ? ["Paid in full", money(rs.total), "good"] : !b.deposit_paid && rs.deposit ? ["Deposit due", money(rs.deposit), "warn"] : [`Balance due ${rs.balanceDue ? fmtShort(rs.balanceDue) : ""}`, money(rs.balance), rs.balanceDue && rs.balanceDue < todayISO() ? "bad" : ""];
    v.innerHTML = `
      <div class="hero">
        <button class="back" data-action="goto" data-view="jobs">${ic("back")} Jobs</button>
        <div class="row"><div class="kicker grow">${fmtDate(b.event_date)}<span class="rel">${relDay(b.event_date)}</span></div>
          <span class="status-select"><select data-action="status" class="st-${b.status}" aria-label="Status">${Object.entries(STATUS).map(([k, l]) => `<option value="${k}" ${b.status === k ? "selected" : ""}>${l}</option>`).join("")}</select></span></div>
        <h1>${h(b.client_name)}</h1>
        <div class="where">${h(b.event_name || PKG[b.package].alt)} · ${h([b.venue, b.address].filter(Boolean).join(", ") || "Venue TBC")}</div>
        <div class="chips"><span class="chip pkg">${PKG[b.package].label}</span>${b.event_type ? `<span class="chip">${h(b.event_type)}</span>` : ""}<span class="chip">${b.travel_minutes ? b.travel_minutes + " min drive" : "Local"}</span></div>
        <div class="actions"><button class="btn gold" data-action="edit">${ic("edit")} Edit details</button><button class="btn" data-action="talk">${ic("mic")} Talk to the job</button></div>
      </div>
      <div class="tiles hero-tiles">
        <button class="tile" data-action="edit" data-focus="f_guest_count">${ic("edit", "corner")}<span class="label">Guests</span><div class="v num">${b.guest_count || "?"}</div><div class="s">${rs.drinks ? "~" + rs.drinks + " drinks" : "add a number"}</div></button>
        <button class="tile" data-action="edit" data-focus="f_start_time">${ic("edit", "corner")}<span class="label">Bar hours</span><div class="v sm num">${fmt12(hm(b.start_time))} – ${fmt12(hm(b.finish_time))}</div><div class="s">${rs.hours != null ? rs.hours + "h service" : "set the times"}</div></button>
        <div class="tile" data-action="jobtab" data-tab="crew" role="button" tabindex="0" style="cursor:pointer"><span class="label">Crew</span><div class="v num ${crewCls}">${rs.bartenders ? `${crew.length}/${rs.bartenders}` : "—"}</div><div class="s">${rs.bartenders ? (crew.length ? crew.map((c) => c.name.split(" ")[0]).join(", ") : "nobody rostered") : "no staff on dry hire"}</div></div>
        <div class="tile" data-action="jobtab" data-tab="money" role="button" tabindex="0" style="cursor:pointer"><span class="label">${moneyTile[0]}</span><div class="v num ${moneyTile[2]}">${moneyTile[1]}</div><div class="s">total ${money(rs.total)}</div></div>
      </div>
      ${Array.isArray(b.review_flags) && b.review_flags.length ? `<div class="card flags section"><div class="row"><b class="grow">Check these</b><button class="btn sm" data-action="clear-flags">All sorted</button></div><ul>${b.review_flags.map((x) => `<li>${h(x)}</li>`).join("")}</ul></div>` : ""}
      <div class="seg">${[["overview", "Overview"], ["todo", `To-do${open ? "<b>" + open + "</b>" : ""}`], ["crew", "Crew"], ["money", "Money"]].map(([k, l]) => `<button data-action="jobtab" data-tab="${k}" class="${tab === k ? "active" : ""}">${l}</button>`).join("")}</div>
      ${tab === "overview" ? overviewTab(b, rs) : tab === "todo" ? todoTab(b, tasks, done) : tab === "crew" ? crewTab(b, rs, crew) : moneyTab(b, rs)}`;
  }
  function overviewTab(b, rs) {
    const tl = [["depart", `Leave ${BASE}`, `${rs.travel} min drive`, ""], ["arrive", "On site, set up", `${rs.setup}h set-up`, ""], ["open", "Bar opens", "", "open"], ["last", "Last drinks", "", "last"], ["packed", "Packed down", `${rs.pack}h pack-down`, ""], ["home", "Home", `${rs.travel} min drive`, ""]].filter(([k]) => rs.t[k]);
    return `
      <div class="card tight"><div class="card-head"><h3>${ic("clock")} Run sheet</h3><span class="meta">built from the booking</span></div>
        ${tl.length ? `<div class="timeline">${tl.map(([k, d, s, cls]) => `<div class="tl ${cls}"><span class="t">${fmt12(rs.t[k])}</span><div><div class="d">${d}</div>${s ? `<div class="s">${s}</div>` : ""}</div></div>`).join("")}</div>` : `<div class="card-body muted">Add bar hours to build the timeline. Tap the Bar hours tile above.</div>`}
      </div>
      <div class="two-col section">
        <div class="card tight"><div class="card-head"><h3>${ic("truck")} We bring</h3></div><div class="card-body"><ul class="plain-list">${rs.weBring.map((x) => `<li>${ic("check")}<span>${h(x)}</span></li>`).join("")}</ul></div></div>
        <div class="card tight"><div class="card-head"><h3>${ic("user")} Client sorts</h3></div><div class="card-body"><ul class="plain-list client">${rs.clientSorts.map((x) => `<li>${ic("dot")}<span>${h(x)}</span></li>`).join("")}</ul></div></div>
      </div>
      <div class="section tiles">
        <div class="tile"><span class="label">Drinks</span><div class="v num">~${rs.drinks ?? "?"}</div><div class="s">${rs.hours ? `${(1 + 0.75 * Math.min(8, rs.hours)).toFixed(1)} per guest` : "guide"}</div></div>
        <div class="tile"><span class="label">Kegs</span><div class="v num">${rs.kegs ?? "?"}</div><div class="s">if beer-heavy (50L)</div></div>
        <div class="tile"><span class="label">Ice</span><div class="v num">${rs.iceBags ?? "?"}</div><div class="s">5 kg bags</div></div>
        <div class="tile"><span class="label">Cups</span><div class="v num">${rs.cups ?? "?"}</div><div class="s">2 per guest</div></div>
      </div>
      ${b.kegs_on_tap || b.drinks_notes ? `<div class="card tight section"><div class="card-head"><h3>${ic("beer")} Drinks</h3><button class="btn ghost sm" data-action="edit" data-focus="f_kegs_on_tap">Edit</button></div><div class="card-body stack">${b.kegs_on_tap ? `<div><span class="label">On tap</span><div>${h(b.kegs_on_tap)}</div></div>` : ""}${b.drinks_notes ? `<div><span class="label">Notes</span><div>${h(b.drinks_notes)}</div></div>` : ""}</div></div>` : ""}
      <div class="card tight section"><div class="card-head"><h3>${ic("note")} Notes for the day</h3><button class="btn ghost sm" data-action="edit" data-focus="f_notes">Edit</button></div><div class="card-body">${b.notes ? h(b.notes).replace(/\n/g, "<br>") : '<span class="muted">Nothing yet. Access, parking, power, speeches, anything the crew needs.</span>'}</div></div>
      <div class="card tight section"><div class="card-head"><h3>${ic("phone")} Contact</h3><button class="btn ghost sm" data-action="edit" data-focus="f_contact_name">Edit</button></div><div class="card-body"><b>${h(b.contact_name || b.client_name)}</b>${b.phone ? ` · <a href="tel:${h(b.phone)}">${h(b.phone)}</a>` : ""}${b.email ? ` · <a href="mailto:${h(b.email)}">${h(b.email)}</a>` : ""}</div></div>
      <div class="btn-row section"><button class="btn" data-action="copy-runsheet">${ic("list")} Copy run sheet</button><a class="btn" href="${gcalUrl(b)}" target="_blank" rel="noopener">${ic("calendar")} Google Calendar</a><button class="btn" data-action="ics">${ic("upload")} Download .ics</button></div>
      ${b.source_text ? `<details class="section"><summary class="small muted">What was pasted in</summary><pre class="mono">${h(b.source_text)}</pre></details>` : ""}
      <div class="btn-row section"><button class="btn danger" data-action="delete">${state.confirmDelete ? "Yes, delete this job" : "Delete job"}</button>${state.confirmDelete ? `<button class="btn" data-action="cancel-delete">Keep it</button>` : ""}</div>`;
  }
  function todoTab(b, tasks, done) {
    const blocks = PHASES.map(([key, label]) => { const ts = tasks.filter((t) => t.phase === key); if (!ts.length) return ""; const d = ts.filter((t) => t.done).length; return `<div class="phase"><div class="phase-bar ${d === ts.length ? "done" : ""}"><h4>${label}</h4><span class="cnt num">${d}/${ts.length}</span></div><div class="tasklist">${ts.map((t) => taskRow(t, false)).join("")}</div></div>`; }).join("");
    return `
      <div class="card"><div class="row"><b class="grow">${done} of ${tasks.length} done</b><button class="btn sm" data-action="sync-tasks">Refresh checklist</button></div><div class="progress" style="margin-top:8px"><i style="width:${tasks.length ? Math.round(done / tasks.length * 100) : 0}%"></i></div>
        <div class="who-legend">${TEAM.map((n, i) => `<span><i class="dot" style="background:${i === 0 ? "var(--teal)" : "var(--gold)"}"></i>${h(n)}</span>`).join("")}<span><i class="dot" style="border:2px dashed var(--line-strong);box-sizing:border-box"></i>Both</span><span class="muted">Tap the circle to pass a task. Tap a task to edit it.</span></div></div>
      ${blocks || `<div class="empty section">No checklist yet. <button class="btn sm" data-action="sync-tasks">Build it</button></div>`}
      <form class="card tight section" data-action="add-task"><div class="add-task" style="border-top:0"><input id="newTask" placeholder="Add a task…" aria-label="New task"><button class="btn sm primary" type="submit">Add</button></div></form>`;
  }
  function crewTab(b, rs, crew) {
    return `
      <div class="tiles"><div class="tile"><span class="label">Needed</span><div class="v num">${rs.bartenders}</div><div class="s">${b.bartender_count != null && b.bartender_count !== "" ? "set on this job" : "1 per 50 guests"}</div></div><div class="tile"><span class="label">Rostered</span><div class="v num ${crew.length >= rs.bartenders ? "good" : "warn"}">${crew.length}</div><div class="s">${rs.staffHours != null ? rs.staffHours + "h each" : "hours TBC"}</div></div></div>
      <div class="card tight section"><div class="card-head"><h3>${ic("users")} Who's working it</h3><button class="btn ghost sm" data-action="edit" data-focus="f_bartender_count">Change number</button></div>
        ${state.staff.filter((s) => s.active !== false).map((s) => `<label class="switch-row"><div><div class="name">${h(s.name)}</div><div class="sub">${s.role === "owner" ? "owner" : h(s.phone || "casual bartender")}</div></div><span class="switch"><input type="checkbox" data-action="crew" data-sid="${s.id}" ${crew.some((c) => c.id === s.id) ? "checked" : ""}><i></i></span></label>`).join("")}
      </div>
      <p class="small muted section">Add casual bartenders under More → Crew. ${rs.wages != null ? `Est. wages for this job: ${money(rs.wages)} (${rs.bartenders} × ${rs.staffHours}h × $${BARTENDER_RATE}).` : ""}</p>`;
  }
  function moneyTab(b, rs) {
    const today = todayISO();
    return `
      <div class="card">
        <div class="kv">
          <div>Deposit (25%)<span class="sub">secures the date</span></div><div class="num">${money(rs.deposit)}</div>
          <div>Balance<span class="sub">due ${rs.balanceDue ? fmtShort(rs.balanceDue) : "7 days out"}${rs.balanceDue && rs.balanceDue < today && !b.balance_paid && b.status === "confirmed" ? ' · <b style="color:var(--bad)">overdue</b>' : ""}</span></div><div class="num">${money(rs.balance)}</div>
          ${rs.bond ? `<div>Bond<span class="sub">refund by ${fmtShort(rs.bondRefundDue)}</span></div><div class="num">${money(rs.bond)}</div>` : ""}
          ${rs.wages != null ? `<div class="muted">Est. wages<span class="sub">${rs.bartenders} × ${rs.staffHours}h × $${BARTENDER_RATE}</span></div><div class="num muted">${money(rs.wages)}</div>` : ""}
        </div>
        <div class="money-total"><span><b>Total</b> <button class="btn ghost sm" data-action="edit" data-focus="f_total">edit</button></span><span class="amt num">${money(rs.total)}</span></div>
      </div>
      <div class="card tight section">
        <label class="switch-row"><div><div class="name">Deposit paid</div><div class="sub">${money(rs.deposit)}</div></div><span class="switch"><input type="checkbox" data-action="flag" data-k="deposit_paid" ${b.deposit_paid ? "checked" : ""}><i></i></span></label>
        <label class="switch-row"><div><div class="name">Balance paid</div><div class="sub">${money(rs.balance)}</div></div><span class="switch"><input type="checkbox" data-action="flag" data-k="balance_paid" ${b.balance_paid ? "checked" : ""}><i></i></span></label>
        ${rs.bond ? `<label class="switch-row"><div><div class="name">Bond held</div><div class="sub">${money(rs.bond)}</div></div><span class="switch"><input type="checkbox" data-action="flag" data-k="bond_paid" ${b.bond_paid ? "checked" : ""}><i></i></span></label><label class="switch-row"><div><div class="name">Bond refunded</div><div class="sub">within 7 business days</div></div><span class="switch"><input type="checkbox" data-action="flag" data-k="bond_refunded" ${b.bond_refunded ? "checked" : ""}><i></i></span></label>` : ""}
      </div>`;
  }

  function dueChip(iso, done) {
    if (!iso) return `<span class="due">no date</span>`;
    const n = daysUntil(iso); if (done) return `<span class="due">${fmtShort(iso)}</span>`;
    if (n < 0) return `<span class="due overdue">${-n}d overdue</span>`; if (n === 0) return `<span class="due today">Today</span>`; if (n === 1) return `<span class="due soon">Tomorrow</span>`; if (n <= 7) return `<span class="due soon">${fmtShort(iso)}</span>`;
    return `<span class="due">${fmtShort(iso)}</span>`;
  }
  function taskRow(t, showJob) {
    const b = bookingById(t.booking_id), who = t.assigned_to || "";
    return `<div class="task ${t.done ? "done" : ""}">
      <button class="cb" data-action="task-done" data-id="${t.id}" aria-label="${t.done ? "Mark not done" : "Mark done"}"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg></button>
      <div class="body" data-action="task-edit" data-id="${t.id}"><div class="t-title">${h(t.title)}</div><div class="t-sub">${dueChip(t.due_date, t.done)}${showJob && b ? `<span class="joblink">${h(b.client_name)}</span>` : ""}</div></div>
      <button class="who ${who ? "set w" + whoIdx(who) : ""}" data-action="task-who" data-id="${t.id}" title="Who's on it">${who ? initials(who) : "?"}</button></div>`;
  }

  function renderCalendar(v) {
    if (!state.calMonth) state.calMonth = todayISO().slice(0, 7);
    const [y, m] = state.calMonth.split("-").map(Number), first = new Date(y, m - 1, 1), daysIn = new Date(y, m, 0).getDate(), lead = (first.getDay() + 6) % 7, today = todayISO();
    const byDate = {}; for (const b of state.bookings) if (b.status !== "cancelled") (byDate[b.event_date] ||= []).push(b);
    let cells = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => `<div class="dow">${d}</div>`).join("");
    for (let i = 0; i < lead; i++) cells += `<div class="cal-day pad"></div>`;
    for (let d = 1; d <= daysIn; d++) { const iso = `${y}-${pad(m)}-${pad(d)}`, js = byDate[iso] || []; cells += `<div class="cal-day ${iso === today ? "today" : ""} ${iso === state.calSelected ? "selected" : ""}" data-action="cal-day" data-date="${iso}" role="button" tabindex="0"><span class="n num">${d}</span><div class="dots">${js.map((b) => `<span class="dot pkg-${b.package} st-${b.status}" title="${h(b.client_name)}"></span>`).join("")}</div></div>`; }
    const sel = state.calSelected ? (byDate[state.calSelected] || []) : [], monthJobs = Object.keys(byDate).filter((k) => k.startsWith(state.calMonth)).sort().flatMap((k) => byDate[k]);
    v.innerHTML = `
      <div class="cal-head" style="margin-top:14px"><button class="btn sm" data-action="cal-nav" data-n="-1" aria-label="Previous month">‹</button><h2>${MONTH_LONG[m - 1]} ${y}</h2><button class="btn sm" data-action="cal-nav" data-n="1" aria-label="Next month">›</button></div>
      <div class="card"><div class="cal-grid">${cells}</div><div class="cal-legend"><span><i></i> BYO / catered</span><span><i class="pkg-dry_hire"></i> Dry hire</span><span><i class="st-quoted"></i> Quoted</span></div></div>
      <div class="section"><div class="section-head"><h2>${state.calSelected ? fmtDate(state.calSelected) : `${monthJobs.length} job${monthJobs.length === 1 ? "" : "s"} this month`}</h2>${state.calSelected ? `<button class="btn ghost sm" data-action="cal-clear">Whole month</button>` : ""}</div>
        ${(state.calSelected ? sel : monthJobs).map(jobCard).join("") || `<div class="empty">${state.calSelected ? "Nothing on. Free day." : "Nothing booked this month."}</div>`}</div>`;
  }

  function renderTodo(v) {
    const today = todayISO(), who = state.todoWho;
    const open = state.tasks.filter((t) => !t.done && bookingById(t.booking_id) && isLive(bookingById(t.booking_id)) && (who === "all" || (who === "unassigned" ? !t.assigned_to : t.assigned_to === who))).sort((a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999"));
    const groups = [], byKey = {};
    for (const t of open) {
      let key, label, cls = "";
      if (!t.due_date) { key = "zz-none"; label = "No date"; } else if (t.due_date < today) { key = "aa-over"; label = "Overdue"; cls = "overdue"; } else if (t.due_date === today) { key = "ab-today"; label = "Today"; cls = "today"; } else if (t.due_date === addDays(today, 1)) { key = "ac-tmrw"; label = "Tomorrow"; } else if (t.due_date <= addDays(today, 7)) { key = "b-" + t.due_date; label = fmtShort(t.due_date); } else if (t.due_date <= addDays(today, 21)) { key = "c-soon"; label = "Next few weeks"; } else { key = "d-later"; label = "Later"; }
      if (!byKey[key]) { byKey[key] = { label, cls, items: [] }; groups.push(key); } byKey[key].items.push(t);
    }
    groups.sort();
    v.innerHTML = `
      <div class="page-title" style="margin-top:14px"><h1>To-do</h1><p>${open.length} open across the live jobs.</p></div>
      <div class="filters">${[["all", "Everyone"], ...TEAM.map((n) => [n, n]), ["unassigned", "Both / unassigned"]].map(([k, l]) => `<button data-action="todo-who" data-w="${k}" class="${who === k ? "active" : ""}">${l}</button>`).join("")}</div>
      ${groups.map((k) => `<div class="day-head ${byKey[k].cls}"><h3>${byKey[k].label}</h3><span class="small muted num">${byKey[k].items.length}</span></div><div class="tasklist standalone">${byKey[k].items.map((t) => taskRow(t, true)).join("")}</div>`).join("") || `<div class="empty">All clear. Go pour yourself one.</div>`}`;
  }

  function renderNew(v) {
    if (state.editing) return renderForm(v);
    v.innerHTML = `
      <div class="page-title" style="margin-top:14px"><h1>Book a job</h1><p>Attach the signed agreement or quote (PDF${DEMO ? "" : " or photo"}), or paste the email. It books the job, builds the checklist split between ${TEAM.join(" and ")}, rosters the crew, and puts it on the shared calendar.</p></div>
      <div class="card intake stack">
        <div class="drop">${ic("upload")}<b>Upload the contract</b>PDF${DEMO ? "" : " or photo"} of the agreement or quote<input type="file" id="intakeFile" accept="application/pdf${DEMO ? "" : ",image/*"}"></div>
        <div class="field"><label for="intakeText">Or paste it</label><textarea id="intakeText" placeholder="Paste the contract, quote or email thread here…"></textarea></div>
        <div class="checks"><label><input type="checkbox" id="autoBook" ${AUTO_BOOK ? "checked" : ""}> Book it straight in (skip the check screen)</label></div>
        <button class="btn primary block" data-action="intake" ${state.intakeBusy ? "disabled" : ""}>${state.intakeBusy ? "Reading it…" : "Book it in"}</button>
        <button class="btn block" data-action="manual">Type it in by hand</button>
      </div>`;
  }

  // One form builder, used on the Book page (new) and inside the edit sheet (existing).
  function formHtml(b) {
    const f = (k, label, type = "text", attrs = "") => `<div class="field"><label for="f_${k}">${label}</label><input id="f_${k}" name="${k}" type="${type}" value="${h(type === "time" ? hm(b[k]) : (b[k] ?? ""))}" ${attrs}></div>`;
    const sel = (k, label, opts) => `<div class="field"><label for="f_${k}">${label}</label><select id="f_${k}" name="${k}">${opts.map(([val, l]) => `<option value="${val}" ${String(b[k] ?? "") === String(val) ? "selected" : ""}>${l}</option>`).join("")}</select></div>`;
    const chk = (k, label) => `<label><input type="checkbox" name="${k}" ${b[k] ? "checked" : ""}> ${label}</label>`;
    return `
      <fieldset class="card stack"><legend>Who</legend>
        <div class="grid2">${f("client_name", "Client / couple / business", "text", "required")}${f("contact_name", "Contact first name")}</div>
        <div class="grid2">${f("phone", "Phone", "tel")}${f("email", "Email", "email")}</div>
        <div class="grid2">${f("event_name", "Event name")}${sel("event_type", "Type", EVENT_TYPES)}</div></fieldset>
      <fieldset class="card stack"><legend>When & where</legend>
        <div class="grid3">${f("event_date", "Event date", "date", "required")}${f("start_time", "Bar opens", "time")}${f("finish_time", "Last drinks", "time")}</div>
        <div class="grid2">${f("venue", "Venue")}${f("address", "Suburb / town")}</div>
        <div class="grid3">${f("travel_minutes", `Drive from ${BASE} (min)`, "number", 'min="0" step="5"')}${f("setup_hours", "Set-up hours", "number", 'min="0" step="0.5"')}${f("packdown_hours", "Pack-down hours", "number", 'min="0" step="0.5"')}</div></fieldset>
      <fieldset class="card stack"><legend>Package</legend>
        <div class="grid3">${sel("package", "Package", [["dry_hire", "Dry Hire"], ["byo", "BYO Bar"], ["fully_catered", "Fully Catered"]])}${f("guest_count", "Guests", "number", 'min="0"')}${f("bartender_count", "Bartenders (blank = 1 per 50)", "number", 'min="0"')}</div>
        <div class="checks">${chk("glassware", "Glassware")}${chk("cocktails", "Cocktails")}${chk("generator", "Generator")}${chk("fairy_lights", "Fairy lights")}${chk("accommodation", "Accommodation")}</div>
        <div class="grid2">${f("kegs_on_tap", "On tap")}${f("drinks_notes", "Drinks notes / allowance")}</div></fieldset>
      <fieldset class="card stack"><legend>Money & status</legend>
        <div class="grid3">${f("total", "Total (NZD)", "number", 'min="0" step="1"')}${f("deposit_amount", "Deposit (blank = 25%)", "number", 'min="0" step="1"')}${f("bond_amount", "Bond (dry hire)", "number", 'min="0" step="1"')}</div>
        <div class="grid2">${sel("status", "Status", Object.entries(STATUS))}<div class="checks" style="align-self:end">${chk("deposit_paid", "Deposit paid")}${chk("balance_paid", "Balance paid")}</div></div>
        <div class="field"><label for="f_notes">Notes for the day</label><textarea id="f_notes" name="notes" placeholder="Access, parking, power, speeches, anything the crew needs to know">${h(b.notes ?? "")}</textarea></div></fieldset>`;
  }
  function readForm(form, base) {
    const fd = new FormData(form), b = { ...base };
    for (const [k, val] of fd.entries()) b[k] = val;
    for (const k of ["glassware", "cocktails", "generator", "fairy_lights", "accommodation", "deposit_paid", "balance_paid"]) b[k] = fd.get(k) === "on";
    return b;
  }
  function renderForm(v) {
    const b = state.editing, isNew = !b.id;
    v.innerHTML = `<button class="back" data-action="form-cancel" style="margin-top:12px">${ic("back")} Back</button><div class="page-title"><h1>${isNew ? "Check the booking" : "Edit booking"}</h1></div>
      ${b.summary ? `<p class="summary-quote">“${h(b.summary)}”</p>` : ""}
      ${b.flags && b.flags.length ? `<div class="card flags" style="margin-bottom:12px"><b>Before you save</b><ul>${b.flags.map((x) => `<li>${h(x)}</li>`).join("")}</ul></div>` : ""}
      <form id="bookingForm" class="stack">${formHtml(b)}<div class="btn-row"><button class="btn primary" type="submit">${isNew ? "Save and build the checklist" : "Save changes"}</button><button class="btn" type="button" data-action="form-cancel">Cancel</button></div></form>`;
    $("#bookingForm").addEventListener("submit", async (e) => { e.preventDefault(); const btn = e.target.querySelector("button[type=submit]"); btn.disabled = true; try { await saveBooking(readForm(e.target, state.editing)); } catch (err) { btn.disabled = false; toast("Couldn't save: " + err.message); } });
  }
  function openEditSheet(b, focusId) {
    openSheet({ title: "Edit details", body: `<form id="editForm" class="stack">${formHtml(b)}</form>`, foot: `<button class="btn" data-action="sheet-close" type="button">Cancel</button><button class="btn primary" type="submit" form="editForm">Save changes</button>`,
      onMount: (root) => {
        $("#editForm", root).addEventListener("submit", async (e) => { e.preventDefault(); const btn = $('button[form="editForm"]', root); btn.disabled = true; try { await saveBooking(readForm(e.target, b)); closeSheet(); } catch (err) { btn.disabled = false; toast("Couldn't save: " + err.message); } });
        if (focusId) { const f = $("#" + focusId, root); if (f) { f.scrollIntoView({ block: "center" }); f.focus(); } }
      } });
  }
  let recog = null;
  function openTalkSheet(b) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    openSheet({ title: "Talk to the job", body: `
      <p class="small muted" style="margin-bottom:10px">Say what's done and what's changed, in one go. “Agreement's signed and the deposit's in, we're 100 people now, and remind me to call the venue about parking.”</p>
      <div class="talk-box"><textarea id="talkText" placeholder="${SR ? "Tap the mic and talk, or type here…" : "Type here, or use the mic key on your keyboard…"}"></textarea>
        <button class="btn mic ${SR ? "" : "hidden"}" id="talkMic" type="button" aria-label="Talk">${ic("mic")}<span>Talk</span></button></div>
      <div id="talkResult"></div>`,
      foot: `<button class="btn" data-action="sheet-close" type="button">Cancel</button><button class="btn primary" id="talkGo" type="button">Read it</button>`,
      onMount: (root) => {
        const ta = $("#talkText", root), mic = $("#talkMic", root), go = $("#talkGo", root);
        if (mic) mic.addEventListener("click", () => {
          if (recog) { recog.stop(); return; }
          try {
            recog = new SR(); recog.lang = "en-NZ"; recog.interimResults = true; recog.continuous = true;
            const base = ta.value ? ta.value.trim() + " " : "";
            recog.onresult = (e) => { let fin = "", interim = ""; for (const r of e.results) { if (r.isFinal) fin += r[0].transcript + " "; else interim += r[0].transcript; } ta.value = base + fin + interim; };
            recog.onerror = (e) => { toast(e.error === "not-allowed" ? "Mic blocked. Allow the microphone, or use the keyboard mic key." : "Mic hiccup: " + e.error); };
            recog.onend = () => { recog = null; mic.classList.remove("live"); mic.innerHTML = ic("mic") + "<span>Talk</span>"; if (ta.value.trim()) go.click(); };
            recog.start(); mic.classList.add("live"); mic.innerHTML = ic("stop") + "<span>Done</span>"; ta.value = base;
          } catch (err) { recog = null; toast("Mic not available here. Use the keyboard mic key."); }
        });
        go.addEventListener("click", async () => {
          const text = ta.value.trim(); if (!text) return toast("Say or type something first");
          go.disabled = true; go.textContent = "Reading…";
          try {
            const tasks = tasksFor(b.id);
            const r = await DB.command(text, b, tasks);
            const ck = Object.keys(r.changes);
            const any = r.done.length || r.undone.length || r.newTasks.length || ck.length || r.notesAppend;
            $("#talkResult", root).innerHTML = `
              ${r.reply ? `<p class="summary-quote" style="margin:12px 0 8px">“${h(r.reply)}”</p>` : ""}
              ${r.warning ? `<p class="small muted">AI unavailable (${h(r.warning)}), used the basic reader.</p>` : ""}
              ${any ? `<div class="card diff-card">
                ${r.done.length ? `<div class="label">Tick off</div><div class="diff">${r.done.map((t, i) => `<label><input type="checkbox" name="done" value="${h(t)}" checked><div>${ic("check")} ${h(t)}</div></label>`).join("")}</div>` : ""}
                ${r.undone.length ? `<div class="label" style="margin-top:10px">Un-tick</div><div class="diff">${r.undone.map((t) => `<label><input type="checkbox" name="undone" value="${h(t)}" checked><div>${h(t)}</div></label>`).join("")}</div>` : ""}
                ${r.newTasks.length ? `<div class="label" style="margin-top:10px">Add to checklist</div><div class="diff">${r.newTasks.map((t, i) => `<label><input type="checkbox" name="new" value="${i}" checked><div><b>${h(t.title)}</b>${t.due_date ? ` <span class="muted small">· ${fmtShort(t.due_date)}</span>` : ""}${t.who && t.who !== "both" ? ` <span class="muted small">· ${h(t.who)}</span>` : ""}</div></label>`).join("")}</div>` : ""}
                ${ck.length ? `<div class="label" style="margin-top:10px">Change</div><div class="diff">${ck.map((k) => `<label><input type="checkbox" name="chg" value="${k}" checked><div><div class="k">${FIELD_LABEL[k] || k}</div><span class="from">${h(showVal(k, b[k]))}</span><span class="to">${h(showVal(k, r.changes[k]))}</span></div></label>`).join("")}</div>` : ""}
                ${r.notesAppend ? `<div class="label" style="margin-top:10px">Add to notes</div><div class="diff"><label><input type="checkbox" name="notes" checked><div>${h(r.notesAppend)}</div></label></div>` : ""}
              </div>` : `<div class="card"><b>Nothing matched.</b><p class="small muted">Try naming the task as it appears in the list, or the detail you want changed.</p></div>`}`;
            go.textContent = any ? "Apply" : "Try again"; go.disabled = false;
            if (!any) { go.onclick = null; return; }
            go.onclick = async () => {
              go.disabled = true;
              try {
                const picked = (name) => [...root.querySelectorAll(`input[name="${name}"]:checked`)].map((x) => x.value);
                for (const title of picked("done")) { const t = tasks.find((x) => x.title === title && !x.done); if (t) await DB.updateTask(t.id, { done: true, done_at: new Date().toISOString() }); }
                for (const title of picked("undone")) { const t = tasks.find((x) => x.title === title && x.done); if (t) await DB.updateTask(t.id, { done: false, done_at: null }); }
                const adds = picked("new").map((i) => r.newTasks[+i]).filter(Boolean);
                if (adds.length) await DB.insertTasks(adds.map((t, i) => ({ booking_id: b.id, title: t.title, phase: "prep", due_date: t.due_date || null, assigned_to: t.who === "both" || !t.who ? null : t.who, sort: 900 + i })));
                const chg = picked("chg"); const nb = { ...b }; for (const k of chg) nb[k] = r.changes[k];
                if (root.querySelector('input[name="notes"]:checked')) nb.notes = (b.notes ? b.notes + "\n" : "") + r.notesAppend;
                nb.source_text = (b.source_text ? b.source_text + "\n\n" : "") + `--- Said ${fmtDate(todayISO())} ---\n` + text;
                if (chg.length || root.querySelector('input[name="notes"]:checked')) await saveBooking(nb, { quiet: true }); else { await reload(); render(); }
                closeSheet(); toast("Done. " + (r.reply || "Updated."));
              } catch (err) { go.disabled = false; toast("Couldn't apply: " + err.message); }
            };
          } catch (err) { go.disabled = false; go.textContent = "Read it"; toast("Couldn't read it: " + err.message); }
        });
      } });
  }
  function showVal(k, v) { if (v == null || v === "") return "—"; if (typeof v === "boolean") return v ? "yes" : "no"; if (k === "package") return PKG[v]?.label || v; if (k === "status") return STATUS[v] || v; if (k === "event_date") return fmtDate(v); if (/_time$/.test(k)) return fmt12(hm(v)); if (/total|deposit_amount|bond/.test(k)) return money(v); return String(v); }
  function openTaskSheet(t) {
    openSheet({ title: "Edit task", body: `<form id="taskForm" class="stack"><div class="field"><label for="t_title">Task</label><input id="t_title" name="title" value="${h(t.title)}" required></div><div class="grid2"><div class="field"><label for="t_due">Due</label><input id="t_due" name="due_date" type="date" value="${h(t.due_date || "")}"></div><div class="field"><label for="t_who">Who</label><select id="t_who" name="assigned_to"><option value="">Both / anyone</option>${TEAM.map((n) => `<option ${t.assigned_to === n ? "selected" : ""}>${h(n)}</option>`).join("")}</select></div></div><div class="field"><label for="t_phase">Section</label><select id="t_phase" name="phase">${PHASES.map(([k, l]) => `<option value="${k}" ${t.phase === k ? "selected" : ""}>${l}</option>`).join("")}</select></div></form>`,
      foot: `<button class="btn danger" id="t_del" type="button">Delete</button><button class="btn primary" type="submit" form="taskForm">Save</button>`,
      onMount: (root) => {
        $("#taskForm", root).addEventListener("submit", async (e) => { e.preventDefault(); const fd = new FormData(e.target); try { Object.assign(t, await DB.updateTask(t.id, { title: fd.get("title"), due_date: fd.get("due_date") || null, assigned_to: fd.get("assigned_to") || null, phase: fd.get("phase") })); closeSheet(); render(); } catch (err) { toast("Couldn't save: " + err.message); } });
        $("#t_del", root).addEventListener("click", async () => { try { await DB.deleteTask(t.id); state.tasks = state.tasks.filter((x) => x.id !== t.id); closeSheet(); render(); toast("Task removed"); } catch (err) { toast("Couldn't delete: " + err.message); } });
      } });
  }

  function renderMore(v) {
    const owners = state.staff.filter((s) => s.role === "owner"), casuals = state.staff.filter((s) => s.role !== "owner" && s.active !== false);
    v.innerHTML = `
      <div class="page-title" style="margin-top:14px"><h1>More</h1></div>
      ${DEMO ? `<div class="notice"><b>Demo mode.</b> These jobs are examples stored only on this device.</div>` : ""}
      <div class="card tight section"><div class="card-head"><h3>${ic("users")} Crew</h3></div>
        ${owners.map((s) => `<div class="switch-row"><div><div class="name">${h(s.name)}</div><div class="sub">owner</div></div></div>`).join("")}
        ${casuals.map((s) => `<div class="switch-row"><div><div class="name">${h(s.name)}</div><div class="sub">${h(s.phone || "casual")} · $${s.hourly_rate}/h</div></div><button class="btn ghost sm" data-action="staff-off" data-sid="${s.id}">Remove</button></div>`).join("")}
        <form class="card-body grid3" data-action="add-staff" style="align-items:end;border-top:1px solid var(--line)"><div class="field"><label for="s_name">Name</label><input id="s_name" required placeholder="Tash"></div><div class="field"><label for="s_phone">Phone</label><input id="s_phone" placeholder="021…"></div><div class="field"><label for="s_rate">Pay $/h</label><input id="s_rate" type="number" value="30" min="0"></div><button class="btn sm primary" type="submit">Add bartender</button></form>
      </div>
      <div class="card tight section"><div class="card-head"><h3>${ic("calendar")} Shared calendar</h3></div><div class="card-body stack">
        <p class="small">Subscribe once on each phone and every job shows in Google or iPhone Calendar with the run sheet in the notes.</p>
        ${DEMO ? `<p class="small muted">Available once connected to Supabase.</p>` : `<div class="field"><label for="calToken">Calendar token</label><input id="calToken" value="${h(state.calendarToken)}" placeholder="the CALENDAR_TOKEN secret"></div><div class="copybox"><input id="calUrl" readonly value="${h(CFG.SUPABASE_URL)}/functions/v1/calendar?token=${h(state.calendarToken || "…")}"><button class="btn sm" data-action="copy-cal">Copy</button></div><p class="small muted">Google Calendar: Other calendars → + → From URL. iPhone: Settings → Calendar → Accounts → Add Subscribed Calendar.</p>`}
      </div></div>
      <div class="card tight section"><div class="card-head"><h3>${ic("sparkle")} Install on your phone</h3></div><div class="card-body small"><p><b>iPhone:</b> Safari → Share → Add to Home Screen.</p><p style="margin-top:6px"><b>Android:</b> Chrome → menu → Add to Home screen.</p></div></div>
      <div class="section btn-row">${DEMO ? `<button class="btn" data-action="reset-demo">Reset demo data</button>` : `<button class="btn" data-action="signout">Sign out (${h(state.user.name)})</button>`}</div>
      <p class="small muted section">The Tipsy Tui Limited · Christchurch</p>`;
  }

  // ============================================================ actions
  async function saveBooking(input, opts = {}) {
    const b = { ...input };
    for (const k of ["travel_minutes", "guest_count", "bartender_count", "total", "deposit_amount", "bond_amount", "setup_hours", "packdown_hours"]) b[k] = b[k] === "" || b[k] == null ? null : Number(b[k]);
    if (b.travel_minutes == null) b.travel_minutes = 0; if (b.setup_hours == null) b.setup_hours = 1; if (b.packdown_hours == null) b.packdown_hours = 1; if (b.bond_amount == null) b.bond_amount = b.package === "dry_hire" ? BOND_DEFAULT : 0;
    if (b.package !== "dry_hire") { b.bond_paid = false; b.bond_refunded = false; }
    if (!Array.isArray(b.review_flags)) b.review_flags = [];
    for (const k of ["flags", "summary", "engine"]) delete b[k];
    const isNew = !b.id;
    const saved = await DB.upsertBooking(b);
    let added = 0;
    if (isNew) { await DB.insertTasks(generateTasks(saved).map((t) => ({ ...t, booking_id: saved.id }))); const need = bartendersFor(saved); if (need > 0) { const owners = state.staff.filter((st) => st.role === "owner" && st.active !== false).slice(0, need).map((st) => st.id); if (owners.length) await DB.setCrew(saved.id, owners); } }
    else { added = await syncTasks(saved); }
    await reload(); state.editing = null;
    if (!opts.quiet) toast(isNew ? "Booked in. Checklist built and assigned." : added ? `Saved. ${added} task${added === 1 ? "" : "s"} added to the checklist.` : "Saved");
    setView("detail", { bookingId: saved.id, jobTab: isNew ? "overview" : state.jobTab });
    return saved;
  }
  // Keep the checklist in step with the booking: add what's missing, retire our own tasks that no longer apply, re-date the rest.
  async function syncTasks(b) {
    const existing = state.tasks.filter((t) => t.booking_id === b.id), tpl = generateTasks(b), used = new Set(); let added = 0;
    for (const t of tpl) {
      const match = existing.find((e) => !used.has(e.id) && normTitle(e.title) === normTitle(t.title));
      if (!match) { await DB.insertTasks([{ ...t, booking_id: b.id }]); added++; continue; }
      used.add(match.id);
      if (!match.done && (match.due_date !== t.due_date || match.title !== t.title)) await DB.updateTask(match.id, { due_date: t.due_date, title: t.title });
    }
    for (const e of existing) if (!used.has(e.id) && !e.done && (TEMPLATE_TITLES.has(normTitle(e.title)) || OLD_TEMPLATE_TITLES.has(normTitle(e.title)))) await DB.deleteTask(e.id);
    return added;
  }
  async function pdfToText(file) {
    if (!window.pdfjsLib) throw new Error("PDF reader didn't load. Paste the text instead.");
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = CFG.PDFJS_WORKER || "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise; const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) { const content = await (await pdf.getPage(i)).getTextContent(); let line = "", lastY = null, out = []; for (const item of content.items) { if (lastY !== null && Math.abs(item.transform[5] - lastY) > 2) { out.push(line.trim()); line = ""; } line += item.str + (item.hasEOL ? "\n" : " "); lastY = item.transform[5]; } out.push(line.trim()); pages.push(out.join("\n")); }
    return pages.join("\n\n");
  }
  async function doIntake() {
    let text = (el("intakeText")?.value || "").trim(); const file = el("intakeFile")?.files?.[0]; const auto = el("autoBook") ? el("autoBook").checked : AUTO_BOOK;
    if (!text && !file) return toast("Paste something or attach the contract first");
    state.intakeBusy = true; render();
    try {
      if (file && file.type === "application/pdf") { const pdfText = await pdfToText(file); if (pdfText.replace(/\s/g, "").length < 40 && DEMO) throw new Error("That PDF is a scan with no text. Paste the details instead."); text = [text, pdfText].filter(Boolean).join("\n\n"); }
      else if (file && DEMO) throw new Error("Demo mode can't read photos. Paste the text, or attach a PDF.");
      const { booking, source_text, engine } = await DB.intake(text, file);
      const draft = { status: "confirmed", setup_hours: 1, packdown_hours: 1, bond_amount: 0, travel_minutes: 0, ...booking };
      if (draft.package === "dry_hire" && !draft.bond_amount) draft.bond_amount = BOND_DEFAULT;
      draft.source_text = source_text; delete draft.engine; draft.review_flags = Array.isArray(draft.flags) ? [...draft.flags] : [];
      if (engine === "local" && !DEMO) toast("Used the basic parser");
      if (auto && draft.client_name && draft.event_date) {
        if (draft.status !== "confirmed") draft.review_flags.push(`Saved as "${STATUS[draft.status] || draft.status}" because it didn't look signed. Change the status once the deposit lands.`);
        state.intakeBusy = false; await saveBooking(draft, { quiet: true });
        toast(draft.review_flags.length ? `Booked in. ${draft.review_flags.length} thing${draft.review_flags.length === 1 ? "" : "s"} to check.` : "Booked in and on the calendar."); return;
      }
      if (auto) draft.flags = ["Couldn't book it straight in: " + (!draft.client_name ? "no client name found." : "no event date found.") + " Fill it in and save.", ...(draft.flags || [])];
      state.editing = draft; state.intakeBusy = false; render(); window.scrollTo({ top: 0 });
    } catch (err) { state.intakeBusy = false; render(); toast("Couldn't read it: " + err.message); }
  }


  el("tabbar").addEventListener("click", (e) => { const btn = e.target.closest("button[data-view]"); if (!btn) return; if (btn.dataset.view === "new") state.editing = null; setView(btn.dataset.view); });

  document.addEventListener("click", async (e) => {
    const t = e.target.closest("[data-action]"); if (!t) return;
    if (t.tagName === "INPUT" || t.tagName === "SELECT") return;
    const a = t.dataset.action;
    if (a === "sheet-close") { if (e.target === t || t.tagName === "BUTTON") closeSheet(); return; }
    if (!el("view").contains(t)) return;
    try {
      if (a === "open") { e.stopPropagation(); return setView("detail", { bookingId: t.dataset.id, jobTab: "overview" }); }
      if (a === "goto") return setView(t.dataset.view);
      if (a === "filter") { state.jobFilter = t.dataset.f; return render(); }
      if (a === "todo-who") { state.todoWho = t.dataset.w; return render(); }
      if (a === "jobtab") { state.jobTab = t.dataset.tab; return render(); }
      if (a === "cal-nav") { const [y, m] = state.calMonth.split("-").map(Number); const d = new Date(y, m - 1 + Number(t.dataset.n), 1); state.calMonth = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; state.calSelected = null; return render(); }
      if (a === "cal-day") { state.calSelected = state.calSelected === t.dataset.date ? null : t.dataset.date; return render(); }
      if (a === "cal-clear") { state.calSelected = null; return render(); }
      if (a === "intake") return doIntake();
      if (a === "manual") { state.editing = { status: "confirmed", package: "byo", setup_hours: 1, packdown_hours: 1, travel_minutes: 0, bond_amount: 0, event_type: "wedding" }; return render(); }
      if (a === "form-cancel") { const id = state.editing?.id; state.editing = null; return id ? setView("detail", { bookingId: id }) : setView("jobs"); }
      if (a === "edit") return openEditSheet(bookingById(state.bookingId), t.dataset.focus);
      if (a === "talk" || a === "update") return openTalkSheet(bookingById(state.bookingId));
      if (a === "delete") { if (!state.confirmDelete) { state.confirmDelete = true; return render(); } await DB.deleteBooking(state.bookingId); await reload(); toast("Deleted"); return setView("jobs"); }
      if (a === "cancel-delete") { state.confirmDelete = false; return render(); }
      if (a === "clear-flags") { const b = bookingById(state.bookingId); b.review_flags = []; await DB.upsertBooking(b); toast("Cleared"); return render(); }
      if (a === "copy-runsheet") { const b = bookingById(state.bookingId); return copyText(runSheetText(b, runSheet(b, crewFor(b.id).map((s) => s.name)))); }
      if (a === "ics") { const b = bookingById(state.bookingId); return download(`TipsyTui_${(b.client_name || "job").replace(/[^a-z0-9]+/gi, "")}_${b.event_date}.ics`, icsForBooking(b)); }
      if (a === "sync-tasks") { const b = bookingById(state.bookingId); const n = await syncTasks(b); await reload(); toast(n ? `${n} task${n === 1 ? "" : "s"} added` : "Checklist is up to date"); return render(); }
      if (a === "task-done") { const task = state.tasks.find((x) => x.id === t.dataset.id); Object.assign(task, await DB.updateTask(task.id, { done: !task.done, done_at: !task.done ? new Date().toISOString() : null })); return render(); }
      if (a === "task-who") { const task = state.tasks.find((x) => x.id === t.dataset.id); const order = [null, ...TEAM]; const next = order[(order.indexOf(task.assigned_to || null) + 1) % order.length]; Object.assign(task, await DB.updateTask(task.id, { assigned_to: next })); return render(); }
      if (a === "task-edit") return openTaskSheet(state.tasks.find((x) => x.id === t.dataset.id));
      if (a === "staff-off") { const s = state.staff.find((x) => x.id === t.dataset.sid); await DB.upsertStaff({ ...s, active: false }); await reload(); return render(); }
      if (a === "copy-cal") return copyText(el("calUrl").value);
      if (a === "signout") { await DB.signOut(); return boot(); }
      if (a === "reset-demo") { LocalDB.reset(); await reload(); toast("Demo data reset"); return render(); }
    } catch (err) { toast("Something went wrong: " + err.message); }
  });
  document.addEventListener("change", async (e) => {
    const t = e.target.closest("[data-action]"); if (!t || !el("view").contains(t)) return; const a = t.dataset.action;
    try {
      if (a === "flag") { const b = bookingById(state.bookingId); b[t.dataset.k] = t.checked; await DB.upsertBooking(b); return render(); }
      if (a === "status") { const b = bookingById(state.bookingId); b.status = t.value; await DB.upsertBooking(b); toast("Status: " + STATUS[b.status]); return render(); }
      if (a === "crew") { const ids = [...el("view").querySelectorAll('input[data-action="crew"]:checked')].map((x) => x.dataset.sid); await DB.setCrew(state.bookingId, ids); await reload(); return render(); }
    } catch (err) { toast("Couldn't save: " + err.message); }
  });
  document.addEventListener("input", (e) => { if (e.target.id === "calToken") { state.calendarToken = e.target.value.trim(); lsSet("tipsy-cal-token", state.calendarToken); el("calUrl").value = `${CFG.SUPABASE_URL}/functions/v1/calendar?token=${state.calendarToken || "…"}`; } });
  document.addEventListener("submit", async (e) => {
    const f = e.target.closest("form[data-action]"); if (!f) return; e.preventDefault();
    try {
      if (f.dataset.action === "add-task") { const title = el("newTask").value.trim(); if (!title) return; await DB.insertTasks([{ booking_id: state.bookingId, title, phase: "prep", due_date: null, sort: 999, assigned_to: null }]); await reload(); return render(); }
      if (f.dataset.action === "add-staff") { await DB.upsertStaff({ name: el("s_name").value.trim(), phone: el("s_phone").value.trim() || null, hourly_rate: Number(el("s_rate").value) || 0, role: "bartender", active: true }); await reload(); toast("Added"); return render(); }
    } catch (err) { toast("Couldn't save: " + err.message); }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && el("sheet").firstChild) { if (recog) recog.stop(); closeSheet(); } if (e.key === "Enter" && e.target.matches('[role="button"][data-action]')) e.target.click(); });

  window.__tipsy = { localParse, localUpdate, localCommand, runSheet, generateTasks, runSheetText, icsForBooking, gcalUrl, syncTasks };
  boot();
})();
