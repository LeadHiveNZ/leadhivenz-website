/* The Tipsy Tui — Bookings
   One file, no build step. Reads config.js; with no Supabase keys it runs in Demo mode on this device. */
(() => {
  "use strict";

  const CFG = window.TIPSY_CONFIG || {};
  const TEAM = CFG.TEAM || ["Joe", "Kieran"];
  const BASE = CFG.BASE || "Christchurch";
  const DEMO = !(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);

  const PKG = {
    dry_hire: { label: "Dry Hire", alt: "Classic Tui", short: "Dry" },
    byo: { label: "BYO Bar", alt: "Tui Experience", short: "BYO" },
    fully_catered: { label: "Fully Catered", alt: "Premium Tui", short: "Catered" },
  };
  const STATUS = { enquiry: "Enquiry", quoted: "Quoted", confirmed: "Confirmed", completed: "Done", cancelled: "Cancelled" };
  const PHASES = [
    ["booking", "Lock it in"], ["prep", "Lead-up"], ["week_of", "Week of"],
    ["day_before", "Day before"], ["day_of", "On the day"], ["after", "After the job"],
  ];
  const BOND_DEFAULT = 300;
  const DEPOSIT_PCT = 0.25;
  const BARTENDER_RATE = 50;

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
  const fmtShort = (iso) => { if (!iso) return "TBC"; const d = parseISO(iso); return `${d.getDate()} ${MON[d.getMonth()]}`; };
  const fmt12 = (hhmm) => {
    if (!hhmm) return "TBC";
    const [h, m] = hhmm.split(":").map(Number);
    const hr = h % 12 === 0 ? 12 : h % 12;
    return `${hr}${m ? ":" + pad(m) : ""}${h >= 12 ? "pm" : "am"}`;
  };
  const shiftTime = (hhmm, hours) => {
    const [h, m] = hhmm.split(":").map(Number);
    let mins = h * 60 + m + Math.round(hours * 60);
    mins = ((mins % 1440) + 1440) % 1440;
    return `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
  };
  const hoursBetween = (start, finish) => {
    if (!start || !finish) return null;
    const [sh, sm] = start.split(":").map(Number); const [fh, fm] = finish.split(":").map(Number);
    let mins = (fh * 60 + fm) - (sh * 60 + sm); if (mins <= 0) mins += 1440;
    return mins / 60;
  };
  const relDay = (iso) => {
    const n = daysUntil(iso);
    if (n === 0) return "Today"; if (n === 1) return "Tomorrow"; if (n === -1) return "Yesterday";
    if (n > 0) return `in ${n} day${n === 1 ? "" : "s"}`; return `${-n} days ago`;
  };
  const money = (n) => n == null || isNaN(n) ? "—" : "$" + Number(n).toLocaleString("en-NZ", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  // ============================================================ business rules
  const bartendersFor = (b) => {
    if (b.package === "dry_hire") return 0;
    if (b.bartender_count != null && b.bartender_count !== "") return Number(b.bartender_count);
    const g = Number(b.guest_count) || 0;
    if (g <= 0) return 1;
    return Math.max(1, Math.ceil(g / 50));
  };
  const serviceHours = (b) => hoursBetween(b.start_time, b.finish_time);
  const travelFee = (min) => Math.ceil((Number(min) || 0) / 45) * 50;
  const depositFor = (b) => b.deposit_amount != null && b.deposit_amount !== "" ? Number(b.deposit_amount) : (b.total ? Math.round(Number(b.total) * DEPOSIT_PCT) : null);

  function runSheet(b, crewNames) {
    const setup = Number(b.setup_hours ?? 1), pack = Number(b.packdown_hours ?? 1);
    const travel = Number(b.travel_minutes) || 0;
    const hours = serviceHours(b);
    const guests = Number(b.guest_count) || 0;
    const bartenders = bartendersFor(b);
    const t = {};
    if (b.start_time) {
      t.arrive = shiftTime(b.start_time, -setup);
      if (travel) t.depart = shiftTime(t.arrive, -travel / 60);
      t.open = b.start_time;
    }
    if (b.finish_time) {
      t.last = b.finish_time;
      t.packed = shiftTime(b.finish_time, pack);
      if (travel) t.home = shiftTime(t.packed, travel / 60);
    }
    const staffHours = hours != null ? hours + setup + pack : null;
    // Drinks: the team's own guide — about 4 per guest over 4 hrs, 5.5 over 6, 7 over 8.
    const perGuest = hours != null ? Math.min(8, Math.max(2, 1 + 0.75 * hours)) : 5.5;
    const drinks = guests ? Math.round(guests * perGuest / 10) * 10 : null;
    const kegs = drinks ? Math.max(1, Math.ceil((drinks * 0.4) / 100)) : null; // if ~40% of drinks go through the taps, 50L ≈ 100 pours
    const iceBags = guests ? Math.ceil(guests / 5) : null;                        // ~1 kg per guest, 5 kg bags
    const cups = guests ? guests * 2 : null;
    const wages = staffHours != null ? bartenders * BARTENDER_RATE * staffHours : null;
    const deposit = depositFor(b);
    const total = b.total != null && b.total !== "" ? Number(b.total) : null;
    const balance = total != null && deposit != null ? total - deposit : total;
    const bond = b.package === "dry_hire" ? (Number(b.bond_amount) || BOND_DEFAULT) : 0;

    const weBring = ["The caravan: 3 keg taps, bar fridge, lights", "Delivery, set-up and pack-down"];
    const clientSorts = [];
    if (b.package === "dry_hire") {
      clientSorts.push("All drinks, served by their own people", "Bar staff (none from us)", "Liquor licence / permit if the venue needs one", "$" + bond + " bond, refunded within 7 business days");
      weBring.push(b.glassware ? "Glassware (plastic)" : "No glassware (they BYO or add ours)");
    } else {
      weBring.push(`${bartenders} bartender${bartenders === 1 ? "" : "s"} for ${staffHours != null ? staffHours.toFixed(1).replace(/\.0$/, "") + " hrs" : "the shift"}`, "Bar tools, ice bins, napkins, straws, water station", b.glassware ? "Plastic glassware (no breakages)" : "No glassware supplied");
      if (b.package === "byo") clientSorts.push("All the alcohol (kegs, bottles, cans, wine)", "Liquor licence / permit if the venue needs one");
      else { weBring.push("All drinks: sourced, chilled, served", "Stock management and buy-back of unopened stock"); clientSorts.push("Their drinks wish list (we price it)", "Liquor licence / permit if the venue needs one"); }
    }
    if (b.cocktails) weBring.push("Pre-made signature cocktails, served from the tap or over ice");
    if (b.generator) weBring.push("Generator for off-grid power");
    if (b.fairy_lights) weBring.push("Fairy lights and styling");
    if (b.accommodation) weBring.push("Staff accommodation (booked by us)");
    if (travel) weBring.push(`Travel: ${travel} min each way (${money(travelFee(travel))} travel fee)`);

    return { t, hours, setup, pack, travel, guests, bartenders, staffHours, drinks, kegs, iceBags, cups, wages, deposit, total, balance, bond,
      balanceDue: b.event_date ? addDays(b.event_date, -7) : null,
      bondRefundDue: b.event_date ? addDays(b.event_date, 10) : null,
      weBring, clientSorts, crewNames: crewNames || [] };
  }

  function generateTasks(b) {
    const d = b.event_date; const T = [];
    const add = (phase, title, offset) => T.push({ phase, title, due_date: d ? addDays(d, offset) : null, sort: T.length });
    const pkg = b.package; const staffed = pkg !== "dry_hire";
    const dep = depositFor(b);
    // Lock it in
    add("booking", "Send the booking agreement for signing", 0 - Math.max(0, daysUntil(d) || 0));
    add("booking", `Collect the ${dep != null ? money(dep) + " " : ""}deposit (25%) to secure the date`, -Math.max(7, (daysUntil(d) || 0) - 7));
    add("booking", "Add to the shared calendar and tell " + (TEAM[1] || "the team"), -Math.max(7, (daysUntil(d) || 0) - 1));
    if (pkg === "byo") add("booking", "Send the Local Pour Guide (kegs, local beer and wine partners)", -Math.max(14, (daysUntil(d) || 0) - 3));
    if (pkg === "fully_catered") add("booking", "Send the Drinks List guide and ask for their wish list", -Math.max(14, (daysUntil(d) || 0) - 3));
    // Lead-up
    if (staffed) add("prep", `Roster ${bartendersFor(b)} bartender${bartendersFor(b) === 1 ? "" : "s"} and confirm they're keen`, -28);
    add("prep", "Confirm with client: site access, power, where the caravan parks", -28);
    add("prep", "Check whether the venue needs a liquor licence or permit (client's job, but chase it)", -28);
    if (b.accommodation || Number(b.travel_minutes) >= 120) add("prep", "Book staff accommodation", -28);
    if (pkg === "fully_catered") { add("prep", "Price the drinks list and get it approved", -21); add("prep", "Order stock from suppliers", -14); }
    if (pkg === "byo") add("prep", "Check the client has ordered their kegs and drinks", -14);
    add("prep", "Confirm final guest count and bar hours with the client", -14);
    // Week of
    add("week_of", `Chase the balance${b.total ? " (" + money(runSheet(b).balance) + ")" : ""}: due 7 days out`, -7);
    if (pkg === "dry_hire") add("week_of", `Collect the ${money(Number(b.bond_amount) || BOND_DEFAULT)} bond`, -7);
    add("week_of", "Send the run sheet to the crew", -3);
    if (pkg === "fully_catered") add("week_of", "Pick up stock and get it chilling", -2);
    add("week_of", "Check CO2 bottle, keg couplers and tap lines", -2);
    if (b.generator) add("week_of", "Fuel and test the generator", -2);
    if (b.fairy_lights) add("week_of", "Charge and test the lights", -2);
    // Day before
    add("day_before", "Buy ice", -1);
    add("day_before", "Clean the caravan, stock bar tools, napkins, straws, water station", -1);
    if (b.glassware || staffed) add("day_before", "Pack glassware and ice bins", -1);
    add("day_before", "Hitch up and road check: tyres, lights, hitch, gas off", -1);
    add("day_before", "Text the client and the crew to confirm times", -1);
    // Day of
    add("day_of", "Depart base with the caravan", 0);
    add("day_of", "Set up on site and run a pour test on every tap", 0);
    add("day_of", "Bar service", 0);
    add("day_of", "Pack down, final clean, photos for socials", 0);
    // After
    if (pkg === "fully_catered") add("after", "Settle unopened stock: buy back at cost or leave with client", 1);
    add("after", "Thank-you message, ask for a Google review and tag us in photos", 2);
    if (pkg === "dry_hire") add("after", "Inspect for damage, then refund the bond within 7 business days", 3);
    add("after", "Mark the balance paid and close the job", 7);
    return T;
  }

  function runSheetText(b, rs) {
    const L = [];
    L.push(`THE TIPSY TUI — RUN SHEET`);
    L.push(`${b.event_name || b.client_name} · ${PKG[b.package].label}`);
    L.push(`${fmtDate(b.event_date)} · ${[b.venue, b.address].filter(Boolean).join(", ") || "Venue TBC"}`);
    L.push(`${rs.guests || "?"} guests · ${rs.bartenders} bartender${rs.bartenders === 1 ? "" : "s"}${rs.crewNames.length ? " (" + rs.crewNames.join(", ") + ")" : " (not rostered yet)"}`);
    L.push("", "TIMES");
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
    L.push("", "ESTIMATES");
    L.push(`~${rs.drinks ?? "?"} drinks · ${rs.kegs ?? "?"} keg${rs.kegs === 1 ? "" : "s"} if beer-heavy · ${rs.iceBags ?? "?"} bags of ice · ${rs.cups ?? "?"} cups`);
    L.push("", "MONEY");
    L.push(`Total ${money(rs.total)} · deposit ${money(rs.deposit)} ${b.deposit_paid ? "PAID" : "NOT PAID"} · balance ${money(rs.balance)} ${b.balance_paid ? "PAID" : "due " + fmtShort(rs.balanceDue)}`);
    if (rs.bond) L.push(`Bond ${money(rs.bond)} ${b.bond_paid ? "held" : "not yet paid"}${b.bond_refunded ? ", refunded" : ""}`);
    if (b.notes) L.push("", "NOTES", b.notes);
    if (b.contact_name || b.phone || b.email) L.push("", "CONTACT", [b.contact_name, b.phone, b.email].filter(Boolean).join(" · "));
    return L.join("\n");
  }

  // Calendar links
  const icsStamp = (iso, hhmm) => iso.replace(/-/g, "") + "T" + hhmm.replace(":", "") + "00";
  function eventWindow(b) {
    const rs = runSheet(b);
    if (!rs.t.arrive || !rs.t.packed) return null;
    const endDate = rs.t.packed < rs.t.arrive ? addDays(b.event_date, 1) : b.event_date;
    return { start: icsStamp(b.event_date, rs.t.arrive), end: icsStamp(endDate, rs.t.packed) };
  }
  function gcalUrl(b) {
    const w = eventWindow(b);
    const dates = w ? `${w.start}/${w.end}` : `${b.event_date.replace(/-/g, "")}/${addDays(b.event_date, 1).replace(/-/g, "")}`;
    const p = new URLSearchParams({
      action: "TEMPLATE", text: `${b.client_name} — ${PKG[b.package].label} (Tipsy Tui)`, dates, ctz: "Pacific/Auckland",
      details: runSheetText(b, runSheet(b)), location: [b.venue, b.address].filter(Boolean).join(", "),
    });
    return "https://calendar.google.com/calendar/render?" + p.toString();
  }
  function icsForBooking(b) {
    const w = eventWindow(b);
    const esc = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//The Tipsy Tui//Bookings//EN", "BEGIN:VEVENT", `UID:${b.id}@thetipsytui`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z")}`];
    if (w) { lines.push(`DTSTART;TZID=Pacific/Auckland:${w.start}`, `DTEND;TZID=Pacific/Auckland:${w.end}`); }
    else { lines.push(`DTSTART;VALUE=DATE:${b.event_date.replace(/-/g, "")}`, `DTEND;VALUE=DATE:${addDays(b.event_date, 1).replace(/-/g, "")}`); }
    lines.push(`SUMMARY:${esc(b.client_name + " — " + PKG[b.package].label + " (Tipsy Tui)")}`,
      `LOCATION:${esc([b.venue, b.address].filter(Boolean).join(", "))}`, `DESCRIPTION:${esc(runSheetText(b, runSheet(b)))}`, "END:VEVENT", "END:VCALENDAR");
    return lines.join("\r\n");
  }

  // ============================================================ local contract parser (no AI needed)
  // Joe's quotes and agreements follow a fixed layout, so most fields can be pulled with patterns.
  const MONTHS_RX = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
  function parseDateText(s) {
    if (!s) return null;
    let m = s.match(new RegExp(`(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTHS_RX})\\s+(\\d{4})`, "i"));
    if (m) { const mi = MON.findIndex((x) => m[2].toLowerCase().startsWith(x.toLowerCase())); return `${m[3]}-${pad(mi + 1)}-${pad(+m[1])}`; }
    m = s.match(/(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})/);
    if (m) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
    m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[0];
    return null;
  }
  function parseTime(s) {
    if (!s) return null;
    const m = s.match(/(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m/i);
    if (!m) { const n = s.match(/\b(\d{2}):(\d{2})\b/); return n ? `${n[1]}:${n[2]}` : null; }
    let h = +m[1]; const mins = m[2] ? +m[2] : 0;
    if (m[3].toLowerCase() === "p" && h < 12) h += 12; if (m[3].toLowerCase() === "a" && h === 12) h = 0;
    return `${pad(h)}:${pad(mins)}`;
  }
  const TRAVEL_GUESS = [["hanmer", 110], ["akaroa", 85], ["tekapo", 190], ["ashburton", 60], ["timaru", 120], ["temuka", 110], ["geraldine", 100], ["methven", 70], ["kaikoura", 150], ["rolleston", 25], ["west melton", 25], ["darfield", 40], ["rangiora", 30], ["oxford", 45], ["amberley", 45], ["waipara", 55], ["lincoln", 25], ["leeston", 35], ["southland", 480], ["dunedin", 300], ["queenstown", 420], ["wanaka", 400], ["oamaru", 200]];
  function localParse(text) {
    const t = text.replace(/\r/g, "");
    const line = (rx) => { const m = t.match(rx); return m ? m[1].trim() : null; };
    const b = { package: "byo", status: "quoted", glassware: false, generator: false, fairy_lights: false, cocktails: false, accommodation: false, deposit_paid: false, travel_minutes: 0 };
    const flags = [];
    if (/dry hire|classic tui|self-serve|supplying all beverages and bar staff/i.test(t)) b.package = "dry_hire";
    else if (/fully catered|premium tui/i.test(t)) b.package = "fully_catered";
    else if (/byo|tui experience|you supply the alcohol/i.test(t)) b.package = "byo";
    if (/agreement|signed|locked in|booked in|confirmed|deposit (?:paid|received)/i.test(t)) b.status = "confirmed";
    b.client_name = line(/^\s*Client\s*[:\-]?\s*(.+)$/im) || line(/between The Tipsy Tui Limited.*?and\s+(.+?)\s*\(the\s*[“"]Hirer/is) || null;
    if (b.client_name) b.client_name = b.client_name.replace(/\[.*?\]/g, "").replace(/\s{2,}/g, " ").trim();
    b.event_name = line(/^\s*EVENT\s*[:\-]?\s+(.+)$/m) || null;
    b.event_date = parseDateText(line(/Event Date\s*[:\-]?\s*(.+)/i) || line(/^\s*DATE\s*[:\-]?\s+(.+)$/m) || line(/Hire Date\(s\):\s*(.+)/i) || t);
    b.venue = line(/^\s*Venue\s*[:\-]?\s*(.+)$/im) || line(/^\s*LOCATION\s*[:\-]?\s+(.+)$/m) || line(/Event Location:\s*(.+)/i) || null;
    const g = t.match(/Guest(?:s| Count| numbers)?\s*[:\-]?\s*(?:Approximately|approx\.?)?\s*(\d{1,4})/i); if (g) b.guest_count = +g[1];
    const times = t.match(/(\d{1,2}(?::\d{2})?\s*[ap]\.?m)\s*(?:–|-|—|to)\s*(\d{1,2}(?::\d{2})?\s*[ap]\.?m)/i);
    if (times) { b.start_time = parseTime(times[1]); b.finish_time = parseTime(times[2]); } else flags.push("No bar hours found. Confirm start and finish times.");
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
    if (!b.client_name) flags.push("Couldn't find the client's name.");
    if (!b.event_date) flags.push("Couldn't find the event date.");
    if (!b.venue) flags.push("No venue found.");
    if (/venue tbc|date tbc/i.test(t)) flags.push("Document says venue or date is TBC.");
    if (/liquor licen/i.test(t)) flags.push("Check the client has sorted the liquor licence.");
    b.flags = flags;
    b.summary = `Read ${b.package === "dry_hire" ? "a dry hire" : b.package === "byo" ? "a BYO bar" : "a fully catered"} job${b.client_name ? " for " + b.client_name : ""}${b.event_date ? " on " + fmtDate(b.event_date) : ""}. Have a look over it before you save.`;
    return b;
  }

  // ============================================================ data layers
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "id-" + Math.random().toString(36).slice(2) + Date.now());

  const LocalDB = {
    key: "tipsy-tui-demo-v1",
    read() { try { return JSON.parse(localStorage.getItem(this.key)) || null; } catch { return null; } },
    write(d) { try { localStorage.setItem(this.key, JSON.stringify(d)); } catch { /* storage blocked: stay in memory */ } },
    data: null,
    async init() { this.data = this.read() || demoSeed(); this.write(this.data); return { user: { id: "demo", name: TEAM[0] } }; },
    async load() { return structuredClone(this.data); },
    async signIn() { return { user: { id: "demo", name: TEAM[0] } }; },
    async signOut() {},
    async upsertBooking(b) { const i = this.data.bookings.findIndex((x) => x.id === b.id); const row = { ...b, updated_at: new Date().toISOString() }; if (i >= 0) this.data.bookings[i] = row; else { row.id = row.id || uuid(); row.created_at = new Date().toISOString(); this.data.bookings.push(row); } this.write(this.data); return row; },
    async deleteBooking(id) { this.data.bookings = this.data.bookings.filter((x) => x.id !== id); this.data.tasks = this.data.tasks.filter((x) => x.booking_id !== id); this.data.booking_staff = this.data.booking_staff.filter((x) => x.booking_id !== id); this.write(this.data); },
    async insertTasks(rows) { const out = rows.map((r) => ({ ...r, id: uuid(), done: false })); this.data.tasks.push(...out); this.write(this.data); return out; },
    async updateTask(id, patch) { const t = this.data.tasks.find((x) => x.id === id); Object.assign(t, patch); this.write(this.data); return t; },
    async deleteTask(id) { this.data.tasks = this.data.tasks.filter((x) => x.id !== id); this.write(this.data); },
    async upsertStaff(s) { const i = this.data.staff.findIndex((x) => x.id === s.id); if (i >= 0) this.data.staff[i] = s; else { s.id = uuid(); this.data.staff.push(s); } this.write(this.data); return s; },
    async setCrew(bookingId, staffIds) { this.data.booking_staff = this.data.booking_staff.filter((x) => x.booking_id !== bookingId).concat(staffIds.map((sid) => ({ id: uuid(), booking_id: bookingId, staff_id: sid, role: "bartender", confirmed: false }))); this.write(this.data); },
    async intake(text) { return { booking: localParse(text), source_text: text, engine: "local" }; },
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
    async profile() {
      const { data } = await this.sb.from("profiles").select("name").eq("id", this.user.id).maybeSingle();
      return { id: this.user.id, name: data?.name || this.user.email.split("@")[0] };
    },
    async signIn(email, password) { const { error } = await this.sb.auth.signInWithPassword({ email, password }); if (error) throw error; },
    async signOut() { await this.sb.auth.signOut(); },
    async load() {
      const [b, t, s, bs] = await Promise.all([
        this.sb.from("bookings").select("*").order("event_date"),
        this.sb.from("tasks").select("*").order("sort"),
        this.sb.from("staff").select("*").order("role").order("name"),
        this.sb.from("booking_staff").select("*"),
      ]);
      for (const r of [b, t, s, bs]) if (r.error) throw r.error;
      return { bookings: b.data, tasks: t.data, staff: s.data, booking_staff: bs.data };
    },
    async upsertBooking(b) {
      const row = { ...b }; delete row.flags; delete row.summary; delete row.engine;
      for (const k of Object.keys(row)) if (row[k] === "") row[k] = null;
      if (!row.id) { delete row.id; row.created_by = this.user.id; }
      const { data, error } = await this.sb.from("bookings").upsert(row).select().single(); if (error) throw error; return data;
    },
    async deleteBooking(id) { const { error } = await this.sb.from("bookings").delete().eq("id", id); if (error) throw error; },
    async insertTasks(rows) { const { data, error } = await this.sb.from("tasks").insert(rows).select(); if (error) throw error; return data; },
    async updateTask(id, patch) { const { data, error } = await this.sb.from("tasks").update(patch).eq("id", id).select().single(); if (error) throw error; return data; },
    async deleteTask(id) { const { error } = await this.sb.from("tasks").delete().eq("id", id); if (error) throw error; },
    async upsertStaff(s) { const row = { ...s }; if (!row.id) delete row.id; const { data, error } = await this.sb.from("staff").upsert(row).select().single(); if (error) throw error; return data; },
    async setCrew(bookingId, staffIds) {
      const del = await this.sb.from("booking_staff").delete().eq("booking_id", bookingId); if (del.error) throw del.error;
      if (staffIds.length) { const ins = await this.sb.from("booking_staff").insert(staffIds.map((staff_id) => ({ booking_id: bookingId, staff_id }))); if (ins.error) throw ins.error; }
    },
    async intake(text, file) {
      const body = { text };
      if (file) { body.file_base64 = await fileToBase64(file); body.file_type = file.type; }
      const { data, error } = await this.sb.functions.invoke("intake", { body });
      if (error || data?.error) {
        // Fall back to the pattern parser so a bad API key never blocks a booking.
        if (!text) throw new Error((error && error.message) || data?.error || "Intake failed");
        const b = localParse(text); b.flags.unshift("AI intake unavailable (" + ((error && error.message) || data?.error) + "). Used the basic parser instead.");
        return { booking: b, source_text: text, engine: "local" };
      }
      return { ...data, engine: "claude" };
    },
  };
  const fileToBase64 = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(file); });

  function demoSeed() {
    const d = (n) => addDays(todayISO(), n);
    const staff = [
      { id: "s-joe", name: TEAM[0], role: "owner", hourly_rate: 0, active: true },
      { id: "s-kieran", name: TEAM[1] || "Kieran", role: "owner", hourly_rate: 0, active: true },
      { id: "s-1", name: "Tash (example)", role: "bartender", phone: "021 000 0001", hourly_rate: 30, active: true },
      { id: "s-2", name: "Ben (example)", role: "bartender", phone: "021 000 0002", hourly_rate: 30, active: true },
    ];
    const bookings = [
      { id: "b1", status: "confirmed", client_name: "Sam & Priya (example)", contact_name: "Sam", email: "sam@example.com", phone: "021 555 0101", event_name: "Sam & Priya's wedding", event_type: "wedding", event_date: d(9), start_time: "15:00", finish_time: "22:00", setup_hours: 1, packdown_hours: 1, venue: "Westhaven Gardens", address: "West Melton", travel_minutes: 25, guest_count: 90, package: "byo", bartender_count: null, glassware: true, generator: false, fairy_lights: true, cocktails: false, accommodation: false, kegs_on_tap: "2 × 50L Southpaw Pilsner, 1 × 30L Zeffer cider", drinks_notes: "They're bringing wine and bubbles for the toast, RTDs in cans.", total: 1300, deposit_amount: 325, deposit_paid: true, balance_paid: false, bond_amount: 0, bond_paid: false, bond_refunded: false, notes: "Park on the gravel pad by the marquee. Power from the shed, 20 m lead. Speeches 6:30pm, keep the bar quiet then.", created_at: new Date().toISOString() },
      { id: "b2", status: "confirmed", client_name: "Harrington Homes (example)", contact_name: "Dee", email: "dee@example.com", phone: "03 555 0102", event_name: "Harrington Homes Christmas do", event_type: "corporate", event_date: d(23), start_time: "16:30", finish_time: "20:30", setup_hours: 1, packdown_hours: 1, venue: "Harrington Homes yard", address: "Sockburn, Christchurch", travel_minutes: 0, guest_count: 60, package: "fully_catered", bartender_count: 2, glassware: true, generator: false, fairy_lights: false, cocktails: true, accommodation: false, kegs_on_tap: "1 × 50L Cassels Lager, 1 × 30L Three Boys Hazy", drinks_notes: "Allowance: beer $600, wine $300, sparkling $200, spirits $250, soft drinks $80. Two cocktails: Aperol spritz, mojito.", total: 3240, deposit_amount: 810, deposit_paid: false, balance_paid: false, bond_amount: 0, bond_paid: false, bond_refunded: false, notes: "Yard is fenced, ask Dee for the gate code. Health and safety induction on arrival.", created_at: new Date().toISOString() },
      { id: "b3", status: "confirmed", client_name: "Lincoln Rugby Club (example)", contact_name: "Kylie", email: "", phone: "027 555 0103", event_name: "Lincoln Rugby Club 50th reunion", event_type: "reunion", event_date: d(45), start_time: "14:00", finish_time: "19:00", setup_hours: 1, packdown_hours: 1, venue: "Lincoln Domain", address: "Lincoln", travel_minutes: 25, guest_count: 100, package: "dry_hire", bartender_count: null, glassware: false, generator: true, fairy_lights: false, cocktails: false, accommodation: false, kegs_on_tap: "", drinks_notes: "Club is sorting their own kegs through their supplier.", total: 699, deposit_amount: 0, deposit_paid: true, balance_paid: false, bond_amount: 300, bond_paid: false, bond_refunded: false, notes: "No power at the domain, generator needed. Club has a special licence.", created_at: new Date().toISOString() },
      { id: "b4", status: "quoted", client_name: "Mel Thompson (example)", contact_name: "Mel", email: "mel@example.com", phone: "", event_name: "Mel's 30th", event_type: "birthday", event_date: d(70), start_time: "18:00", finish_time: "23:00", setup_hours: 1, packdown_hours: 1, venue: "Private bach", address: "Akaroa", travel_minutes: 85, guest_count: 45, package: "byo", bartender_count: null, glassware: true, generator: false, fairy_lights: true, cocktails: true, accommodation: true, kegs_on_tap: "", drinks_notes: "", total: 1150, deposit_amount: null, deposit_paid: false, balance_paid: false, bond_amount: 0, bond_paid: false, bond_refunded: false, notes: "Quote sent, waiting to hear back. Steep driveway, check caravan access.", created_at: new Date().toISOString() },
      { id: "b5", status: "completed", client_name: "Tuatara Structures (example)", contact_name: "Rob", email: "", phone: "", event_name: "Tuatara Structures office drinks", event_type: "corporate", event_date: d(-12), start_time: "16:30", finish_time: "19:30", setup_hours: 1, packdown_hours: 1, venue: "Tuatara Structures office", address: "Christchurch", travel_minutes: 0, guest_count: 80, package: "byo", bartender_count: 2, glassware: true, generator: false, fairy_lights: false, cocktails: false, accommodation: false, kegs_on_tap: "1 × 50L Summit Ultra", drinks_notes: "", total: 800, deposit_amount: 200, deposit_paid: true, balance_paid: true, bond_amount: 0, bond_paid: false, bond_refunded: false, notes: "", created_at: new Date().toISOString() },
    ];
    const tasks = [];
    for (const b of bookings) {
      const gen = generateTasks(b).map((t) => ({ ...t, id: uuid(), booking_id: b.id, done: false, assigned_to: null }));
      // Anything that would already be overdue on a sample job is ticked off, so the demo looks like a job that's been run properly.
      gen.forEach((t) => { if (t.due_date && t.due_date < todayISO()) { t.done = true; t.done_at = new Date().toISOString(); } });
      if (b.id === "b1") gen.forEach((t) => { if (/Chase the balance/.test(t.title)) t.assigned_to = TEAM[0]; if (/Buy ice|CO2/.test(t.title)) t.assigned_to = TEAM[1] || "Kieran"; });
      if (b.id === "b2") gen.forEach((t) => { if (/Roster|liquor licence/.test(t.title)) { t.done = false; delete t.done_at; } });
      if (b.id === "b3") gen.forEach((t) => { if (t.phase === "booking") t.done = true; });
      if (b.id === "b5") gen.forEach((t) => { if (!/review/.test(t.title)) t.done = true; });
      tasks.push(...gen);
    }
    const booking_staff = [
      { id: uuid(), booking_id: "b1", staff_id: "s-joe" }, { id: uuid(), booking_id: "b1", staff_id: "s-kieran" },
      { id: uuid(), booking_id: "b2", staff_id: "s-joe" },
      { id: uuid(), booking_id: "b5", staff_id: "s-joe" }, { id: uuid(), booking_id: "b5", staff_id: "s-1" },
    ];
    return { bookings, tasks, staff, booking_staff };
  }

  // ============================================================ state
  const DB = DEMO ? LocalDB : SupabaseDB;
  const state = { user: null, bookings: [], tasks: [], staff: [], booking_staff: [], view: "jobs", bookingId: null, jobFilter: "upcoming", todoWho: "all", calMonth: null, calSelected: null, draft: null, editing: null, intakeBusy: false, confirmDelete: false, calendarToken: "" };
  const $ = (sel, root = document) => root.querySelector(sel);
  const el = (id) => document.getElementById(id);
  const h = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const bookingById = (id) => state.bookings.find((b) => b.id === id);
  const tasksFor = (id) => state.tasks.filter((t) => t.booking_id === id).sort((a, b) => (a.due_date || "").localeCompare(b.due_date || "") || a.sort - b.sort);
  const crewFor = (id) => state.booking_staff.filter((x) => x.booking_id === id).map((x) => state.staff.find((s) => s.id === x.staff_id)).filter(Boolean);
  const isLive = (b) => b.status === "confirmed" || b.status === "quoted" || b.status === "enquiry";

  let toastTimer;
  function toast(msg) { const t = el("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2200); }
  async function copyText(text) { try { await navigator.clipboard.writeText(text); toast("Copied"); } catch { toast("Couldn't copy on this device. Select the text and copy it."); } }

  async function boot() {
    try {
      const { user } = await DB.init();
      state.user = user;
      el("modePill").hidden = !DEMO;
      if (!user) { el("tabbar").hidden = true; el("topbar").hidden = true; renderAuth(); return; }
      await reload();
      el("tabbar").hidden = false; el("topbar").hidden = false;
      render();
    } catch (e) { el("view").innerHTML = `<div class="card"><h2>Couldn't start</h2><p class="muted">${h(e.message || e)}</p><p class="small muted" style="margin-top:8px">Check the Supabase URL and key in config.js, and that schema.sql has been run.</p></div>`; }
  }
  async function reload() { const d = await DB.load(); Object.assign(state, d); }

  function setView(v, extra = {}) { Object.assign(state, { view: v, confirmDelete: false }, extra); render(); window.scrollTo({ top: 0 }); }
  function render() {
    document.querySelectorAll("#tabbar button[data-view]").forEach((b) => b.classList.toggle("active", b.dataset.view === state.view || (state.view === "detail" && b.dataset.view === "jobs")));
    const v = el("view");
    ({ jobs: renderJobs, detail: renderDetail, calendar: renderCalendar, todo: renderTodo, new: renderNew, more: renderMore })[state.view](v);
  }

  // ============================================================ views
  function renderAuth() {
    el("view").innerHTML = `
      <div class="auth">
        <img src="logo-small.jpg" alt="The Tipsy Tui">
        <h1>Tipsy Tui Bookings</h1>
        <p class="muted">Sign in to see the jobs.</p>
        <form id="loginForm" class="stack">
          <div class="field"><label for="email">Email</label><input id="email" type="email" required autocomplete="username"></div>
          <div class="field"><label for="password">Password</label><input id="password" type="password" required autocomplete="current-password"></div>
          <button class="btn primary block" type="submit">Sign in</button>
          <p class="small muted" id="loginErr"></p>
        </form>
      </div>`;
    $("#loginForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      try { await DB.signIn(el("email").value.trim(), el("password").value); } catch (err) { el("loginErr").textContent = err.message; }
    });
  }

  function jobCard(b, opts = {}) {
    const d = parseISO(b.event_date); const past = daysUntil(b.event_date) < 0;
    const open = tasksFor(b.id).filter((t) => !t.done).length;
    const crew = crewFor(b.id); const need = bartendersFor(b);
    const chips = [`<span class="chip pkg-${b.package}">${PKG[b.package].label}</span>`];
    if (b.status !== "confirmed") chips.push(`<span class="chip st-${b.status}">${STATUS[b.status]}</span>`);
    if (isLive(b) && !past) {
      if (!b.deposit_paid && b.status === "confirmed") chips.push(`<span class="chip warn">Deposit unpaid</span>`);
      if (need > 0 && crew.length < need) chips.push(`<span class="chip ${daysUntil(b.event_date) <= 14 ? "bad" : "warn"}">Crew ${crew.length}/${need}</span>`);
      else if (need > 0) chips.push(`<span class="chip good">Crew ${crew.length}/${need}</span>`);
      if (open) chips.push(`<span class="chip">${open} to do</span>`);
    }
    return `<div class="card job ${past ? "past" : ""}" data-action="open" data-id="${b.id}" role="button" tabindex="0">
      <div class="datebox"><div class="d num">${d.getDate()}</div><div class="m">${MON[d.getMonth()]}</div><div class="w">${DOW[d.getDay()]}</div></div>
      <div style="min-width:0">
        <div class="title"><h3>${h(b.client_name)}</h3><span class="small muted num" style="white-space:nowrap">${opts.hideRel ? "" : relDay(b.event_date)}</span></div>
        <div class="meta">${h(b.event_name || PKG[b.package].alt)} · ${h(b.venue || "Venue TBC")}</div>
        <div class="meta num">${b.guest_count || "?"} guests · ${fmt12(b.start_time)}–${fmt12(b.finish_time)}${b.travel_minutes ? " · " + b.travel_minutes + " min drive" : ""}</div>
        <div class="chips">${chips.join("")}</div>
      </div></div>`;
  }

  function renderJobs(v) {
    const today = todayISO();
    const live = state.bookings.filter((b) => isLive(b));
    const upcoming = live.filter((b) => b.event_date >= today).sort((a, b) => a.event_date.localeCompare(b.event_date));
    const next = upcoming.find((b) => b.status === "confirmed") || upcoming[0];
    const in30 = upcoming.filter((b) => daysUntil(b.event_date) <= 30);
    const crewGap = in30.filter((b) => b.status === "confirmed").reduce((n, b) => n + Math.max(0, bartendersFor(b) - crewFor(b.id).length), 0);
    const owed = upcoming.filter((b) => b.status === "confirmed").reduce((n, b) => { const rs = runSheet(b); return n + (!b.deposit_paid && rs.deposit ? rs.deposit : 0) + (!b.balance_paid && rs.balance && daysUntil(b.event_date) <= 7 ? rs.balance : 0); }, 0);
    const overdue = state.tasks.filter((t) => !t.done && t.due_date && t.due_date < today && bookingById(t.booking_id) && isLive(bookingById(t.booking_id)));

    const issues = [];
    for (const b of in30.filter((x) => x.status === "confirmed")) {
      const need = bartendersFor(b), have = crewFor(b.id).length;
      if (need > have) issues.push(`<li><a data-action="open" data-id="${b.id}">${h(b.client_name)}</a> needs ${need - have} more bartender${need - have === 1 ? "" : "s"} (${relDay(b.event_date)})</li>`);
      if (!b.deposit_paid && runSheet(b).deposit) issues.push(`<li><a data-action="open" data-id="${b.id}">${h(b.client_name)}</a>: deposit ${money(runSheet(b).deposit)} not paid</li>`);
      if (!b.balance_paid && daysUntil(b.event_date) <= 7) issues.push(`<li><a data-action="open" data-id="${b.id}">${h(b.client_name)}</a>: balance ${money(runSheet(b).balance)} due now</li>`);
    }
    if (overdue.length) issues.push(`<li><a data-action="goto" data-view="todo">${overdue.length} overdue task${overdue.length === 1 ? "" : "s"}</a> across the jobs</li>`);

    let list;
    const f = state.jobFilter;
    if (f === "upcoming") list = upcoming.filter((b) => b.status === "confirmed");
    else if (f === "quoted") list = upcoming.filter((b) => b.status !== "confirmed");
    else if (f === "past") list = state.bookings.filter((b) => b.event_date < today || b.status === "completed" || b.status === "cancelled").sort((a, b) => b.event_date.localeCompare(a.event_date));
    else list = [...state.bookings].sort((a, b) => a.event_date.localeCompare(b.event_date));

    v.innerHTML = `
      <div class="greeting"><h1>Kia ora, <em>${h(state.user.name)}</em>.</h1>
        <p class="muted">${upcoming.filter((b) => b.status === "confirmed").length} confirmed job${upcoming.filter((b) => b.status === "confirmed").length === 1 ? "" : "s"} on the books${upcoming.filter((b) => b.status !== "confirmed").length ? `, ${upcoming.filter((b) => b.status !== "confirmed").length} quoted` : ""}.</p></div>
      <div class="stats">
        <div class="stat"><div class="eyebrow">Next job</div><div class="v num">${next ? (daysUntil(next.event_date) === 0 ? "Today" : daysUntil(next.event_date) + "d") : "—"}</div><div class="small muted">${next ? h(next.client_name) : "Nothing booked"}</div></div>
        <div class="stat"><div class="eyebrow">Next 30 days</div><div class="v num">${in30.length}</div><div class="small muted">job${in30.length === 1 ? "" : "s"}</div></div>
        <div class="stat"><div class="eyebrow">Crew to roster</div><div class="v num ${crewGap ? "warn" : ""}">${crewGap}</div><div class="small muted">bartender slot${crewGap === 1 ? "" : "s"}</div></div>
        <div class="stat"><div class="eyebrow">To collect</div><div class="v num ${owed ? "warn" : ""}">${money(owed)}</div><div class="small muted">deposits + balances due</div></div>
      </div>
      ${issues.length ? `<div class="card attention section"><b>Needs a look</b><ul>${issues.join("")}</ul></div>` : ""}
      <div class="section">
        <div class="filters">
          ${[["upcoming", "Upcoming"], ["quoted", "Quotes & enquiries"], ["past", "Past"], ["all", "All"]].map(([k, l]) => `<button data-action="filter" data-f="${k}" class="${f === k ? "active" : ""}">${l}</button>`).join("")}
        </div>
        ${list.length ? list.map((b) => jobCard(b)).join("") : `<div class="empty">Nothing here yet. Tap <b>Book</b> to paste in a contract.</div>`}
      </div>`;
  }

  function renderDetail(v) {
    const b = bookingById(state.bookingId);
    if (!b) return setView("jobs");
    const crew = crewFor(b.id); const rs = runSheet(b, crew.map((s) => s.name));
    const tasks = tasksFor(b.id); const done = tasks.filter((t) => t.done).length;
    const today = todayISO();
    const timeline = [["depart", `Leave ${BASE}${rs.travel ? ` (${rs.travel} min)` : ""}`, ""], ["arrive", "On site, set up", ""], ["open", "Bar opens", "gold"], ["last", "Last drinks", "gold"], ["packed", "Packed down", ""], ["home", "Home", ""]]
      .filter(([k]) => rs.t[k]).map(([k, label, cls]) => `<div class="t ${cls}">${fmt12(rs.t[k])}</div><div>${label}</div>`).join("");
    const phaseBlocks = PHASES.map(([key, label]) => {
      const ts = tasks.filter((t) => t.phase === key); if (!ts.length) return "";
      return `<div class="phase-head"><span class="eyebrow">${label}</span><span class="small muted num">${ts.filter((t) => t.done).length}/${ts.length}</span></div>` +
        ts.map((t) => taskRow(t, false)).join("");
    }).join("");

    v.innerHTML = `
      <div class="detail-head">
        <button class="btn ghost sm back" data-action="goto" data-view="jobs">← Jobs</button>
        <div class="row">
          <h1 class="grow">${h(b.client_name)}</h1>
          <span class="status-select"><select data-action="status" aria-label="Status">${Object.entries(STATUS).map(([k, l]) => `<option value="${k}" ${b.status === k ? "selected" : ""}>${l}</option>`).join("")}</select></span>
        </div>
        <p class="muted">${h(b.event_name || PKG[b.package].alt)} · ${fmtDate(b.event_date)} · ${relDay(b.event_date)}</p>
        <div class="row"><span class="chip pkg-${b.package}">${PKG[b.package].label}</span>${b.status === "confirmed" && !b.deposit_paid && rs.deposit ? `<span class="chip warn">Deposit unpaid</span>` : ""}${rs.bartenders && crew.length < rs.bartenders ? `<span class="chip warn">Crew ${crew.length}/${rs.bartenders}</span>` : rs.bartenders ? `<span class="chip good">Crew sorted</span>` : ""}</div>
      </div>

      <div class="card facts">
        <div class="fact"><div class="k">Bar hours</div><div class="v num">${fmt12(b.start_time)} – ${fmt12(b.finish_time)}${rs.hours != null ? ` <span class="muted small">(${rs.hours}h)</span>` : ""}</div></div>
        <div class="fact"><div class="k">Guests</div><div class="v num">${b.guest_count || "TBC"}</div></div>
        <div class="fact"><div class="k">Venue</div><div class="v">${h(b.venue || "TBC")}${b.address ? `<div class="small muted">${h(b.address)}</div>` : ""}</div></div>
        <div class="fact"><div class="k">Travel</div><div class="v num">${rs.travel ? `${rs.travel} min each way` : "Local"}</div></div>
        <div class="fact"><div class="k">Contact</div><div class="v">${h(b.contact_name || b.client_name)}${b.phone ? `<div class="small"><a href="tel:${h(b.phone)}">${h(b.phone)}</a></div>` : ""}${b.email ? `<div class="small"><a href="mailto:${h(b.email)}">${h(b.email)}</a></div>` : ""}</div></div>
        <div class="fact"><div class="k">Type</div><div class="v">${h(b.event_type || "event")}</div></div>
      </div>

      <div class="section">
        <div class="section-head"><h2>Run sheet</h2><span class="small muted">auto-built from the booking</span></div>
        <div class="card">
          ${timeline ? `<div class="timeline">${timeline}</div>` : `<p class="muted">Add start and finish times to build the timeline.</p>`}
          <div class="two-col" style="margin-top:14px">
            <div><div class="eyebrow">We bring</div><ul class="list-plain">${rs.weBring.map((x) => `<li>${h(x)}</li>`).join("")}</ul></div>
            <div><div class="eyebrow">Client sorts</div><ul class="list-plain">${rs.clientSorts.map((x) => `<li>${h(x)}</li>`).join("")}</ul></div>
          </div>
          ${b.kegs_on_tap || b.drinks_notes ? `<div style="margin-top:12px">${b.kegs_on_tap ? `<div><span class="eyebrow">On tap</span> &nbsp;${h(b.kegs_on_tap)}</div>` : ""}${b.drinks_notes ? `<div class="small" style="margin-top:4px"><span class="eyebrow">Drinks</span> &nbsp;${h(b.drinks_notes)}</div>` : ""}</div>` : ""}
          <div class="stats" style="margin-top:14px">
            <div class="stat"><div class="eyebrow">Drinks</div><div class="v num">~${rs.drinks ?? "?"}</div><div class="small muted">${rs.hours ? `${rs.hours}h, ${(1 + 0.75 * Math.min(8, rs.hours)).toFixed(1)}/guest` : "guide"}</div></div>
            <div class="stat"><div class="eyebrow">Kegs</div><div class="v num">${rs.kegs ?? "?"}</div><div class="small muted">if beer-heavy (50L)</div></div>
            <div class="stat"><div class="eyebrow">Ice</div><div class="v num">${rs.iceBags ?? "?"}</div><div class="small muted">5 kg bags</div></div>
            <div class="stat"><div class="eyebrow">Cups</div><div class="v num">${rs.cups ?? "?"}</div><div class="small muted">2 per guest</div></div>
          </div>
          <div class="btn-row" style="margin-top:14px">
            <button class="btn" data-action="copy-runsheet">Copy run sheet</button>
            <a class="btn" href="${gcalUrl(b)}" target="_blank" rel="noopener">Google Calendar</a>
            <button class="btn" data-action="ics">Download .ics</button>
          </div>
          <details style="margin-top:10px"><summary class="small muted">Preview the text version</summary><pre class="runsheet">${h(runSheetText(b, rs))}</pre></details>
        </div>
      </div>

      <div class="section">
        <div class="section-head"><h2>Crew</h2><span class="small muted">${rs.bartenders ? `${rs.bartenders} needed` : "no staff on a dry hire"}</span></div>
        <div class="card">
          ${rs.bartenders ? `<div class="crew-need"><div class="big num ${crew.length < rs.bartenders ? "" : ""}">${crew.length}<span class="muted">/${rs.bartenders}</span></div><div class="small muted">${rs.staffHours != null ? `${rs.staffHours}h each incl. set-up and pack-down · est. wages ${money(rs.wages)} at $${BARTENDER_RATE}/h charge-out` : "Add times for hours"}</div></div>` : `<p class="muted">Dry hire: drop off, set up, pack down. No bar staff.</p>`}
          <div class="crew-list">
            ${state.staff.filter((s) => s.active !== false).map((s) => `<label><input type="checkbox" data-action="crew" data-sid="${s.id}" ${crew.some((c) => c.id === s.id) ? "checked" : ""}> ${h(s.name)} <span class="r">${s.role === "owner" ? "owner" : h(s.phone || "bartender")}</span></label>`).join("")}
          </div>
          <p class="small muted" style="margin-top:8px">Add casual bartenders under More → Crew.</p>
        </div>
      </div>

      <div class="section">
        <div class="section-head"><h2>Checklist</h2><span class="small muted num">${done}/${tasks.length} done</span></div>
        <div class="card">
          ${tasks.length ? `<div class="progress" style="margin:0 0 10px"><i style="width:${tasks.length ? Math.round(done / tasks.length * 100) : 0}%"></i></div>${phaseBlocks}` : `<p class="muted">No checklist yet.</p><button class="btn sm" data-action="gen-tasks" style="margin-top:8px">Build the standard checklist</button>`}
          <form class="row" data-action="add-task" style="margin-top:12px"><input class="grow" id="newTask" placeholder="Add a task…" aria-label="New task" style="padding:9px 11px;border:1px solid var(--line);border-radius:10px;background:var(--surface)"><button class="btn sm" type="submit">Add</button></form>
          <p class="small muted" style="margin-top:6px">Tap the name pill on a task to pass it between ${TEAM.join(" and ")}.</p>
        </div>
      </div>

      <div class="section">
        <div class="section-head"><h2>Money</h2></div>
        <div class="card">
          <div class="kv">
            <div>Deposit (25%)<div class="sub">secures the date</div></div><div class="num">${money(rs.deposit)}</div>
            <div>Balance<div class="sub">due ${rs.balanceDue ? fmtShort(rs.balanceDue) : "7 days out"}${rs.balanceDue && rs.balanceDue < today && !b.balance_paid && b.status === "confirmed" ? ' <span class="chip bad">overdue</span>' : ""}</div></div><div class="num">${money(rs.balance)}</div>
            ${rs.bond ? `<div>Bond<div class="sub">refund by ${fmtShort(rs.bondRefundDue)}</div></div><div class="num">${money(rs.bond)}</div>` : ""}
            ${rs.wages != null ? `<div class="muted">Est. wages<div class="sub">${rs.bartenders} × ${rs.staffHours}h × $${BARTENDER_RATE}</div></div><div class="num muted">${money(rs.wages)}</div>` : ""}
          </div>
          <div class="money-total"><span>Total</span><span class="amt num">${money(rs.total)}</span></div>
          <div class="checks" style="margin-top:12px">
            <label><input type="checkbox" data-action="flag" data-k="deposit_paid" ${b.deposit_paid ? "checked" : ""}> Deposit paid</label>
            <label><input type="checkbox" data-action="flag" data-k="balance_paid" ${b.balance_paid ? "checked" : ""}> Balance paid</label>
            ${rs.bond ? `<label><input type="checkbox" data-action="flag" data-k="bond_paid" ${b.bond_paid ? "checked" : ""}> Bond held</label><label><input type="checkbox" data-action="flag" data-k="bond_refunded" ${b.bond_refunded ? "checked" : ""}> Bond refunded</label>` : ""}
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-head"><h2>Notes</h2></div>
        <div class="card">
          <p>${b.notes ? h(b.notes).replace(/\n/g, "<br>") : '<span class="muted">No notes.</span>'}</p>
          ${b.source_text ? `<details style="margin-top:10px"><summary class="small muted">What was pasted in</summary><pre class="runsheet">${h(b.source_text)}</pre></details>` : ""}
        </div>
      </div>

      <div class="btn-row section">
        <button class="btn primary" data-action="edit">Edit booking</button>
        <button class="btn danger" data-action="delete">${state.confirmDelete ? "Yes, delete this job" : "Delete"}</button>
        ${state.confirmDelete ? `<button class="btn" data-action="cancel-delete">Keep it</button>` : ""}
      </div>`;
  }

  function taskRow(t, showJob) {
    const b = bookingById(t.booking_id); const today = todayISO();
    const overdue = !t.done && t.due_date && t.due_date < today;
    const who = t.assigned_to || "";
    return `<div class="task ${t.done ? "done" : ""}">
      <input type="checkbox" data-action="task-done" data-id="${t.id}" ${t.done ? "checked" : ""} aria-label="Done">
      <div style="min-width:0"><div class="t-title">${h(t.title)}</div>
        <div class="t-sub ${overdue ? "overdue" : ""}">${t.due_date ? (overdue ? "Overdue · " : "") + fmtDate(t.due_date) : "No date"}${showJob && b ? ` · <a data-action="open" data-id="${b.id}" style="cursor:pointer">${h(b.client_name)}</a>` : ""}</div></div>
      <div class="row" style="gap:6px;flex-wrap:nowrap">
        <button class="who ${who.toLowerCase()}" data-action="task-who" data-id="${t.id}" title="Assign">${h(who || "anyone")}</button>
        <button class="btn ghost sm" data-action="task-del" data-id="${t.id}" aria-label="Remove task" style="padding:4px 6px">✕</button>
      </div></div>`;
  }

  function renderCalendar(v) {
    if (!state.calMonth) state.calMonth = todayISO().slice(0, 7);
    const [y, m] = state.calMonth.split("-").map(Number);
    const first = new Date(y, m - 1, 1); const daysIn = new Date(y, m, 0).getDate();
    const lead = (first.getDay() + 6) % 7; // Monday first
    const today = todayISO();
    const byDate = {}; for (const b of state.bookings) if (b.status !== "cancelled") (byDate[b.event_date] ||= []).push(b);
    let cells = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => `<div class="dow">${d}</div>`).join("");
    for (let i = 0; i < lead; i++) cells += `<div class="cal-day pad"></div>`;
    for (let d = 1; d <= daysIn; d++) {
      const iso = `${y}-${pad(m)}-${pad(d)}`; const js = byDate[iso] || [];
      cells += `<div class="cal-day ${iso === today ? "today" : ""} ${iso === state.calSelected ? "selected" : ""}" data-action="cal-day" data-date="${iso}" role="button" tabindex="0"><span class="n num">${d}</span><div class="dots">${js.map((b) => `<span class="dot pkg-${b.package} st-${b.status}" title="${h(b.client_name)}"></span>`).join("")}</div></div>`;
    }
    const sel = state.calSelected ? (byDate[state.calSelected] || []) : [];
    const monthJobs = Object.keys(byDate).filter((k) => k.startsWith(state.calMonth)).sort().flatMap((k) => byDate[k]);
    v.innerHTML = `
      <div class="cal-head"><button class="btn sm" data-action="cal-nav" data-n="-1" aria-label="Previous month">‹</button><h2>${MONTH_LONG[m - 1]} ${y}</h2><button class="btn sm" data-action="cal-nav" data-n="1" aria-label="Next month">›</button></div>
      <div class="cal-grid">${cells}</div>
      <div class="cal-legend"><span><i></i> BYO</span><span><i class="pkg-fully_catered"></i> Fully catered</span><span><i class="pkg-dry_hire"></i> Dry hire</span><span><i class="st-quoted"></i> Quoted</span></div>
      <div class="section">
        <div class="section-head"><h2>${state.calSelected ? fmtDate(state.calSelected) : `${monthJobs.length} job${monthJobs.length === 1 ? "" : "s"} this month`}</h2>${state.calSelected ? `<button class="btn ghost sm" data-action="cal-clear">Show whole month</button>` : ""}</div>
        ${(state.calSelected ? sel : monthJobs).map((b) => jobCard(b)).join("") || `<div class="empty">${state.calSelected ? "Nothing on. Free day." : "Nothing booked this month."}</div>`}
      </div>
      ${!DEMO ? "" : `<p class="small muted section">In the real app every job also appears in Google Calendar or iPhone Calendar through the shared feed (set up under More).</p>`}`;
  }

  function renderTodo(v) {
    const today = todayISO(); const who = state.todoWho;
    const open = state.tasks.filter((t) => !t.done && bookingById(t.booking_id) && isLive(bookingById(t.booking_id)) && (who === "all" || (who === "unassigned" ? !t.assigned_to : t.assigned_to === who)))
      .sort((a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999"));
    const groups = [["Overdue", (t) => t.due_date && t.due_date < today], ["Today", (t) => t.due_date === today], ["This week", (t) => t.due_date && t.due_date > today && t.due_date <= addDays(today, 7)], ["Next two weeks", (t) => t.due_date && t.due_date > addDays(today, 7) && t.due_date <= addDays(today, 21)], ["Later", (t) => !t.due_date || t.due_date > addDays(today, 21)]];
    const used = new Set();
    const blocks = groups.map(([label, fn]) => { const ts = open.filter((t) => !used.has(t.id) && fn(t)); ts.forEach((t) => used.add(t.id)); if (!ts.length) return ""; return `<div class="section"><div class="section-head"><h2>${label}</h2><span class="small muted num">${ts.length}</span></div><div class="card">${ts.map((t) => taskRow(t, true)).join("")}</div></div>`; }).join("");
    const doneRecent = state.tasks.filter((t) => t.done && t.done_at && t.done_at > new Date(Date.now() - 3 * 86400000).toISOString()).length;
    v.innerHTML = `
      <div class="greeting"><h1>To-do</h1><p class="muted">${open.length} open across the live jobs${doneRecent ? ` · ${doneRecent} ticked off in the last 3 days` : ""}.</p></div>
      <div class="filters">${[["all", "Everyone"], ...TEAM.map((n) => [n, n]), ["unassigned", "Unassigned"]].map(([k, l]) => `<button data-action="todo-who" data-w="${k}" class="${who === k ? "active" : ""}">${l}</button>`).join("")}</div>
      ${blocks || `<div class="empty">All clear. Go pour yourself one.</div>`}`;
  }

  function renderNew(v) {
    if (state.editing) return renderForm(v);
    v.innerHTML = `
      <div class="greeting"><h1>Book a job</h1><p class="muted">Paste the signed agreement, the quote, or the email thread. ${DEMO ? "Demo mode reads it with the built-in parser; the real app sends it to Claude." : "Claude reads it and fills in the booking for you to check."}</p></div>
      <div class="card intake stack">
        <div class="field"><label for="intakeText">Contract, quote or email</label><textarea id="intakeText" placeholder="Paste here…&#10;&#10;e.g. Client: Sarah & Jake&#10;Event Date: 14 March 2027&#10;Venue: Riverside Barn, Hawke's Bay&#10;Guest Count: 100&#10;Times: 3:00 PM – 11:00 PM&#10;TOTAL $1,769"></textarea></div>
        <div class="drop">Or attach the PDF or a photo of it${DEMO ? " (needs the real app)" : ""}<input type="file" id="intakeFile" accept="application/pdf,image/*" ${DEMO ? "disabled" : ""}></div>
        <button class="btn primary block" data-action="intake" ${state.intakeBusy ? "disabled" : ""}>${state.intakeBusy ? "Reading it…" : "Read it in"}</button>
        <button class="btn block" data-action="manual">Or type it in by hand</button>
      </div>`;
  }

  function renderForm(v) {
    const b = state.editing; const isNew = !b.id;
    const f = (k, label, type = "text", attrs = "") => `<div class="field"><label for="f_${k}">${label}</label><input id="f_${k}" name="${k}" type="${type}" value="${h(b[k] ?? "")}" ${attrs}></div>`;
    const sel = (k, label, opts) => `<div class="field"><label for="f_${k}">${label}</label><select id="f_${k}" name="${k}">${opts.map(([val, l]) => `<option value="${val}" ${String(b[k] ?? "") === String(val) ? "selected" : ""}>${l}</option>`).join("")}</select></div>`;
    const chk = (k, label) => `<label><input type="checkbox" name="${k}" ${b[k] ? "checked" : ""}> ${label}</label>`;
    v.innerHTML = `
      <div class="detail-head"><button class="btn ghost sm back" data-action="form-cancel">← Back</button><h1>${isNew ? "Check the booking" : "Edit booking"}</h1></div>
      ${b.summary ? `<p class="summary-quote" style="margin-bottom:12px">“${h(b.summary)}”</p>` : ""}
      ${b.flags && b.flags.length ? `<div class="card flags" style="margin-bottom:12px"><b>Before you save</b><ul>${b.flags.map((x) => `<li>${h(x)}</li>`).join("")}</ul></div>` : ""}
      <form id="bookingForm" class="stack">
        <fieldset class="card stack"><legend>Who</legend>
          <div class="grid2">${f("client_name", "Client / couple / business", "text", "required")}${f("contact_name", "Contact first name")}</div>
          <div class="grid2">${f("phone", "Phone", "tel")}${f("email", "Email", "email")}</div>
          <div class="grid2">${f("event_name", "Event name")}${sel("event_type", "Type", [["wedding", "Wedding"], ["birthday", "Birthday"], ["corporate", "Corporate"], ["reunion", "Reunion"], ["festival", "Festival / market"], ["other", "Other"]])}</div>
        </fieldset>
        <fieldset class="card stack"><legend>When & where</legend>
          <div class="grid3">${f("event_date", "Event date", "date", "required")}${f("start_time", "Bar opens", "time")}${f("finish_time", "Last drinks", "time")}</div>
          <div class="grid2">${f("venue", "Venue")}${f("address", "Suburb / town")}</div>
          <div class="grid3">${f("travel_minutes", `Drive from ${BASE} (min, one way)`, "number", 'min="0" step="5"')}${f("setup_hours", "Set-up hours", "number", 'min="0" step="0.5"')}${f("packdown_hours", "Pack-down hours", "number", 'min="0" step="0.5"')}</div>
        </fieldset>
        <fieldset class="card stack"><legend>Package</legend>
          <div class="grid3">${sel("package", "Package", [["dry_hire", "Dry Hire (Classic Tui)"], ["byo", "BYO Bar (Tui Experience)"], ["fully_catered", "Fully Catered (Premium Tui)"]])}${f("guest_count", "Guests", "number", 'min="0"')}${f("bartender_count", "Bartenders (blank = 1 per 50)", "number", 'min="0"')}</div>
          <div class="checks">${chk("glassware", "Glassware")}${chk("cocktails", "Cocktails")}${chk("generator", "Generator")}${chk("fairy_lights", "Fairy lights")}${chk("accommodation", "Accommodation")}</div>
          <div class="grid2">${f("kegs_on_tap", "On tap")}${f("drinks_notes", "Drinks notes / allowance")}</div>
        </fieldset>
        <fieldset class="card stack"><legend>Money & status</legend>
          <div class="grid3">${f("total", "Total (NZD)", "number", 'min="0" step="1"')}${f("deposit_amount", "Deposit (blank = 25%)", "number", 'min="0" step="1"')}${f("bond_amount", "Bond (dry hire)", "number", 'min="0" step="1"')}</div>
          <div class="grid2">${sel("status", "Status", Object.entries(STATUS))}<div class="checks" style="align-self:end">${chk("deposit_paid", "Deposit paid")}${chk("balance_paid", "Balance paid")}</div></div>
          <div class="field"><label for="f_notes">Notes for the day</label><textarea id="f_notes" name="notes" placeholder="Access, parking, power, speeches, anything the crew needs to know">${h(b.notes ?? "")}</textarea></div>
        </fieldset>
        <div class="btn-row"><button class="btn primary" type="submit">${isNew ? "Save and build the checklist" : "Save changes"}</button><button class="btn" type="button" data-action="form-cancel">Cancel</button></div>
      </form>`;
    $("#bookingForm").addEventListener("submit", onSaveBooking);
  }

  function renderMore(v) {
    const owners = state.staff.filter((s) => s.role === "owner"); const casuals = state.staff.filter((s) => s.role !== "owner");
    v.innerHTML = `
      <div class="greeting"><h1>More</h1></div>
      ${DEMO ? `<div class="notice"><b>Demo mode.</b> These jobs are examples stored only on this device. Add your Supabase keys to <code class="inline">config.js</code> and both of you see the same live bookings. The README walks through it.</div>` : ""}
      <div class="section"><div class="section-head"><h2>Crew</h2></div>
        <div class="card">
          <div class="eyebrow">Owners</div><ul class="list-plain">${owners.map((s) => `<li>${h(s.name)}</li>`).join("")}</ul>
          <div class="eyebrow" style="margin-top:10px">Casual bartenders</div>
          ${casuals.length ? `<ul class="list-plain">${casuals.map((s) => `<li>${h(s.name)}${s.phone ? ` · <span class="muted">${h(s.phone)}</span>` : ""} · $${s.hourly_rate}/h ${s.active === false ? '<span class="chip">inactive</span>' : `<button class="btn ghost sm" data-action="staff-off" data-sid="${s.id}">remove</button>`}</li>`).join("")}</ul>` : `<p class="muted small">None yet.</p>`}
          <form class="grid3" data-action="add-staff" style="margin-top:10px;align-items:end">
            <div class="field"><label for="s_name">Name</label><input id="s_name" required placeholder="Tash"></div>
            <div class="field"><label for="s_phone">Phone</label><input id="s_phone" placeholder="021…"></div>
            <div class="field"><label for="s_rate">Pay $/h</label><input id="s_rate" type="number" value="30" min="0"></div>
            <button class="btn sm" type="submit">Add bartender</button>
          </form>
        </div>
      </div>
      <div class="section"><div class="section-head"><h2>Shared calendar</h2></div>
        <div class="card stack">
          <p class="small">Subscribe once on each phone and every confirmed job shows up in Google Calendar or iPhone Calendar, with the run sheet in the event notes. It refreshes on its own.</p>
          ${DEMO ? `<p class="small muted">Available once the app is connected to Supabase (the <code class="inline">calendar</code> function in the README).</p>` : `
          <div class="field"><label for="calToken">Calendar token (the CALENDAR_TOKEN secret you set)</label><input id="calToken" value="${h(state.calendarToken)}" placeholder="paste the token"></div>
          <div class="copybox"><input id="calUrl" readonly value="${h(CFG.SUPABASE_URL)}/functions/v1/calendar?token=${h(state.calendarToken || "…")}"><button class="btn sm" data-action="copy-cal">Copy</button></div>
          <p class="small muted">Google Calendar: Other calendars → + → From URL. iPhone: Settings → Calendar → Accounts → Add Subscribed Calendar.</p>`}
        </div>
      </div>
      <div class="section"><div class="section-head"><h2>Install on your phone</h2></div>
        <div class="card small"><p><b>iPhone:</b> open this page in Safari → Share → Add to Home Screen.</p><p style="margin-top:6px"><b>Android:</b> open in Chrome → menu → Add to Home screen (or Install app).</p><p class="muted" style="margin-top:6px">It then opens like a normal app, full screen, with the Tipsy Tui icon.</p></div>
      </div>
      <div class="section btn-row">
        ${DEMO ? `<button class="btn" data-action="reset-demo">Reset demo data</button>` : `<button class="btn" data-action="signout">Sign out (${h(state.user.name)})</button>`}
      </div>
      <p class="small muted section">The Tipsy Tui Limited · Christchurch · Bookings app</p>`;
  }

  // ============================================================ actions
  async function onSaveBooking(e) {
    e.preventDefault();
    const fd = new FormData(e.target); const b = { ...state.editing };
    for (const [k, val] of fd.entries()) b[k] = val;
    for (const k of ["glassware", "cocktails", "generator", "fairy_lights", "accommodation", "deposit_paid", "balance_paid"]) b[k] = fd.get(k) === "on";
    for (const k of ["travel_minutes", "guest_count", "bartender_count", "total", "deposit_amount", "bond_amount", "setup_hours", "packdown_hours"]) b[k] = b[k] === "" || b[k] == null ? null : Number(b[k]);
    if (b.travel_minutes == null) b.travel_minutes = 0; if (b.setup_hours == null) b.setup_hours = 1; if (b.packdown_hours == null) b.packdown_hours = 1; if (b.bond_amount == null) b.bond_amount = b.package === "dry_hire" ? BOND_DEFAULT : 0;
    if (b.package !== "dry_hire") { b.bond_paid = false; b.bond_refunded = false; }
    const isNew = !b.id;
    try {
      const saved = await DB.upsertBooking(b);
      if (isNew) {
        const rows = generateTasks(saved).map((t) => ({ ...t, booking_id: saved.id }));
        await DB.insertTasks(rows);
      }
      await reload();
      state.editing = null; state.draft = null;
      toast(isNew ? "Booked in. Checklist built." : "Saved");
      setView("detail", { bookingId: saved.id });
    } catch (err) { toast("Couldn't save: " + err.message); }
  }

  async function doIntake() {
    const text = (el("intakeText")?.value || "").trim(); const file = el("intakeFile")?.files?.[0];
    if (!text && !file) return toast("Paste something first");
    state.intakeBusy = true; render();
    try {
      const { booking, source_text, engine } = await DB.intake(text, file);
      const draft = { status: "confirmed", setup_hours: 1, packdown_hours: 1, bond_amount: 0, travel_minutes: 0, ...booking };
      if (draft.package === "dry_hire" && !draft.bond_amount) draft.bond_amount = BOND_DEFAULT;
      draft.source_text = source_text; delete draft.engine;
      state.editing = draft; state.intakeBusy = false;
      if (engine === "local" && !DEMO) toast("Used the basic parser");
      render(); window.scrollTo({ top: 0 });
    } catch (err) { state.intakeBusy = false; render(); toast("Couldn't read it: " + err.message); }
  }

  function download(name, text, mime = "text/calendar") {
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: mime })); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  }

  document.getElementById("tabbar").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-view]"); if (!btn) return;
    if (btn.dataset.view === "new") { state.editing = null; }
    setView(btn.dataset.view);
  });

  el("view").addEventListener("click", async (e) => {
    const t = e.target.closest("[data-action]"); if (!t || t.tagName === "INPUT" || t.tagName === "SELECT") return;
    const a = t.dataset.action;
    try {
      if (a === "open") { e.stopPropagation(); return setView("detail", { bookingId: t.dataset.id }); }
      if (a === "goto") return setView(t.dataset.view);
      if (a === "filter") { state.jobFilter = t.dataset.f; return render(); }
      if (a === "todo-who") { state.todoWho = t.dataset.w; return render(); }
      if (a === "cal-nav") { const [y, m] = state.calMonth.split("-").map(Number); const d = new Date(y, m - 1 + Number(t.dataset.n), 1); state.calMonth = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; state.calSelected = null; return render(); }
      if (a === "cal-day") { state.calSelected = state.calSelected === t.dataset.date ? null : t.dataset.date; return render(); }
      if (a === "cal-clear") { state.calSelected = null; return render(); }
      if (a === "intake") return doIntake();
      if (a === "manual") { state.editing = { status: "confirmed", package: "byo", setup_hours: 1, packdown_hours: 1, travel_minutes: 0, bond_amount: 0, event_type: "wedding" }; return render(); }
      if (a === "form-cancel") { const id = state.editing?.id; state.editing = null; return id ? setView("detail", { bookingId: id }) : setView("jobs"); }
      if (a === "edit") { state.editing = { ...bookingById(state.bookingId) }; return setView("new"); }
      if (a === "delete") { if (!state.confirmDelete) { state.confirmDelete = true; return render(); } await DB.deleteBooking(state.bookingId); await reload(); toast("Deleted"); return setView("jobs"); }
      if (a === "cancel-delete") { state.confirmDelete = false; return render(); }
      if (a === "copy-runsheet") { const b = bookingById(state.bookingId); return copyText(runSheetText(b, runSheet(b, crewFor(b.id).map((s) => s.name)))); }
      if (a === "ics") { const b = bookingById(state.bookingId); return download(`TipsyTui_${(b.client_name || "job").replace(/[^a-z0-9]+/gi, "")}_${b.event_date}.ics`, icsForBooking(b)); }
      if (a === "gen-tasks") { const b = bookingById(state.bookingId); await DB.insertTasks(generateTasks(b).map((x) => ({ ...x, booking_id: b.id }))); await reload(); return render(); }
      if (a === "task-who") { const task = state.tasks.find((x) => x.id === t.dataset.id); const order = [null, ...TEAM]; const next = order[(order.indexOf(task.assigned_to || null) + 1) % order.length]; Object.assign(task, await DB.updateTask(task.id, { assigned_to: next })); return render(); }
      if (a === "task-del") { await DB.deleteTask(t.dataset.id); state.tasks = state.tasks.filter((x) => x.id !== t.dataset.id); return render(); }
      if (a === "staff-off") { const s = state.staff.find((x) => x.id === t.dataset.sid); await DB.upsertStaff({ ...s, active: false }); await reload(); return render(); }
      if (a === "copy-cal") return copyText(el("calUrl").value);
      if (a === "signout") { await DB.signOut(); return boot(); }
      if (a === "reset-demo") { LocalDB.reset(); await reload(); toast("Demo data reset"); return render(); }
    } catch (err) { toast("Something went wrong: " + err.message); }
  });

  el("view").addEventListener("change", async (e) => {
    const t = e.target.closest("[data-action]"); if (!t) return;
    const a = t.dataset.action;
    try {
      if (a === "task-done") { const task = state.tasks.find((x) => x.id === t.dataset.id); Object.assign(task, await DB.updateTask(task.id, { done: t.checked, done_at: t.checked ? new Date().toISOString() : null })); return render(); }
      if (a === "flag") { const b = bookingById(state.bookingId); b[t.dataset.k] = t.checked; await DB.upsertBooking(b); return render(); }
      if (a === "status") { const b = bookingById(state.bookingId); b.status = t.value; await DB.upsertBooking(b); toast("Status: " + STATUS[b.status]); return render(); }
      if (a === "crew") { const ids = [...el("view").querySelectorAll('input[data-action="crew"]:checked')].map((x) => x.dataset.sid); await DB.setCrew(state.bookingId, ids); await reload(); return render(); }
    } catch (err) { toast("Couldn't save: " + err.message); }
  });
  el("view").addEventListener("input", (e) => { if (e.target.id === "calToken") { state.calendarToken = e.target.value.trim(); el("calUrl").value = `${CFG.SUPABASE_URL}/functions/v1/calendar?token=${state.calendarToken || "…"}`; } });
  el("view").addEventListener("submit", async (e) => {
    const f = e.target.closest("form[data-action]"); if (!f) return; e.preventDefault();
    try {
      if (f.dataset.action === "add-task") { const title = el("newTask").value.trim(); if (!title) return; await DB.insertTasks([{ booking_id: state.bookingId, title, phase: "prep", due_date: null, sort: 999 }]); await reload(); return render(); }
      if (f.dataset.action === "add-staff") { await DB.upsertStaff({ name: el("s_name").value.trim(), phone: el("s_phone").value.trim() || null, hourly_rate: Number(el("s_rate").value) || 0, role: "bartender", active: true }); await reload(); toast("Added"); return render(); }
    } catch (err) { toast("Couldn't save: " + err.message); }
  });
  el("view").addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.matches('[role="button"][data-action]')) e.target.click(); });

  window.__tipsy = { localParse, runSheet, generateTasks, runSheetText, icsForBooking, gcalUrl };
  boot();
})();
