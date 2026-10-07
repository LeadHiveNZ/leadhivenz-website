/**
 * Coverage data for every trade x region slot LeadHive runs or has built.
 *
 * Numbers come from Nimbata call tracking + website enquiry logs (Feb–Oct 2026).
 * "avgLeads" = average tracked calls + web enquiries per full month while the
 * campaign ran. "bestMonth" = the highest single month. Update these when a
 * partner joins or leaves; everything on the site (carousel, open-spots,
 * /areas, /leads/* pages, sitemap) reads from this file.
 */

export type TradeKey = "plumber" | "electrician" | "handyman" | "roofer";
export type SlotStatus = "taken" | "open" | "opening" | "built" | "unbuilt";

export type Trade = {
  key: TradeKey;
  label: string;        // "Plumber"
  plural: string;       // "Plumbers"
  noun: string;         // "plumbing"
  jobs: string[];       // typical urgent jobs
  searches: string[];   // what homeowners type
  jobValue: number;     // typical callout value (NZD) for calculator copy
};

export type Region = {
  key: string;          // "hawkes-bay"
  name: string;         // "Hawke's Bay"
  short: string;        // "Hawke's Bay"
  suburbs: string[];    // service area copy
  population: string;   // rough, for copy
  island: "North" | "South";
};

export type Slot = {
  trade: TradeKey;
  region: string;       // Region.key
  status: SlotStatus;
  since?: string;       // "Jun 2026" first month of data
  until?: string;       // last month of data if ended
  avgLeads?: number;    // avg leads per full month
  bestMonth?: number;   // best single month
  totalLeads?: number;  // all-time tracked leads
  months?: number;      // full months of data
  note?: string;        // one-line human note
  opensOn?: string;     // for "opening" status
};

export const TRADES: Trade[] = [
  {
    key: "plumber",
    label: "Plumber",
    plural: "Plumbers",
    noun: "plumbing",
    jobs: ["Burst pipes", "Blocked drains", "No hot water", "Leaking taps & toilets", "Hot water cylinder swaps"],
    searches: ["emergency plumber near me", "plumber [region]", "no hot water", "blocked drain [region]"],
    jobValue: 325,
  },
  {
    key: "electrician",
    label: "Electrician",
    plural: "Electricians",
    noun: "electrical",
    jobs: ["No power", "Switchboard tripping", "Faults & sparking points", "Hot water element", "EV charger & install enquiries"],
    searches: ["electrician near me", "emergency electrician [region]", "no power in house", "sparky [region]"],
    jobValue: 350,
  },
  {
    key: "handyman",
    label: "Handyman",
    plural: "Handymen & builders",
    noun: "handyman and repair",
    jobs: ["Door & lock repairs", "Fences, decks & gates", "Gutters & weatherboards", "Bathroom & kitchen fixes", "Small renovation jobs"],
    searches: ["handyman near me", "handyman [region]", "fence repair [region]", "small jobs builder [region]"],
    jobValue: 220,
  },
  {
    key: "roofer",
    label: "Roofer",
    plural: "Roofers",
    noun: "roofing",
    jobs: ["Roof leaks", "Storm damage", "Spouting & gutters", "Flashings", "Roof repairs"],
    searches: ["roof leak repair [region]", "roofer near me", "emergency roof repair"],
    jobValue: 750,
  },
];

export const REGIONS: Region[] = [
  { key: "auckland", name: "Auckland", short: "Auckland", island: "North", population: "1.7m",
    suburbs: ["Auckland CBD", "North Shore", "West Auckland", "Mt Eden", "Remuera", "Albany", "Henderson", "Newmarket", "Torbay", "Glenfield"] },
  { key: "south-auckland", name: "South Auckland", short: "South Auckland", island: "North", population: "400k+",
    suburbs: ["Manukau", "Manurewa", "Papakura", "Botany", "Flat Bush", "Weymouth", "Takanini", "Pukekohe", "Howick", "Otahuhu"] },
  { key: "wellington", name: "Wellington", short: "Wellington", island: "North", population: "420k",
    suburbs: ["Wellington Central", "Lower Hutt", "Upper Hutt", "Porirua", "Karori", "Tawa", "Johnsonville", "Wainuiomata", "Petone", "Churton Park"] },
  { key: "christchurch", name: "Christchurch", short: "Christchurch", island: "South", population: "400k",
    suburbs: ["Christchurch Central", "Riccarton", "Halswell", "Hornby", "Papanui", "Rolleston", "Rangiora", "Sydenham", "Spreydon", "Kaiapoi"] },
  { key: "hamilton", name: "Hamilton", short: "Hamilton", island: "North", population: "185k",
    suburbs: ["Hamilton Central", "Rototuna", "Hillcrest", "Chartwell", "Melville", "Pukete", "Cambridge", "Te Awamutu", "Huntly", "Maeroa"] },
  { key: "tauranga", name: "Tauranga & Bay of Plenty", short: "Tauranga", island: "North", population: "160k",
    suburbs: ["Tauranga Central", "Mount Maunganui", "Papamoa", "Bethlehem", "Otumoetai", "Pyes Pa", "Greerton", "Welcome Bay", "Te Puke", "Omokoroa"] },
  { key: "hawkes-bay", name: "Hawke's Bay", short: "Hawke's Bay", island: "North", population: "180k",
    suburbs: ["Napier", "Hastings", "Havelock North", "Taradale", "Flaxmere", "Clive", "Tamatea", "Greenmeadows", "Waipukurau"] },
  { key: "northland", name: "Northland", short: "Northland", island: "North", population: "200k",
    suburbs: ["Whangārei", "Kerikeri", "Kaitaia", "Dargaville", "Paihia", "Warkworth", "Mangawhai", "Kaikohe"] },
  { key: "dunedin", name: "Dunedin", short: "Dunedin", island: "South", population: "135k",
    suburbs: ["Dunedin Central", "Mosgiel", "St Clair", "Port Chalmers", "Green Island", "North East Valley"] },
  { key: "palmerston-north", name: "Palmerston North & Manawatū", short: "Palmerston North", island: "North", population: "90k",
    suburbs: ["Palmerston North", "Feilding", "Levin", "Ashhurst", "Foxton"] },
  { key: "nelson", name: "Nelson & Tasman", short: "Nelson", island: "South", population: "110k",
    suburbs: ["Nelson", "Richmond", "Stoke", "Motueka", "Mapua"] },
  { key: "new-plymouth", name: "New Plymouth & Taranaki", short: "New Plymouth", island: "North", population: "90k",
    suburbs: ["New Plymouth", "Bell Block", "Waitara", "Inglewood", "Stratford", "Hāwera"] },
  { key: "rotorua", name: "Rotorua & Taupō", short: "Rotorua", island: "North", population: "120k",
    suburbs: ["Rotorua", "Taupō", "Ngongotahā", "Turangi"] },
  { key: "queenstown", name: "Queenstown & Central Otago", short: "Queenstown", island: "South", population: "60k",
    suburbs: ["Queenstown", "Frankton", "Arrowtown", "Wānaka", "Cromwell", "Alexandra"] },
  { key: "invercargill", name: "Invercargill & Southland", short: "Invercargill", island: "South", population: "60k",
    suburbs: ["Invercargill", "Gore", "Winton", "Bluff", "Te Anau"] },
];

export const SLOTS: Slot[] = [
  // ---- Plumbers ----
  { trade: "plumber", region: "wellington", status: "taken", since: "Mar 2026", avgLeads: 29, bestMonth: 49, totalLeads: 204, months: 7 },
  { trade: "plumber", region: "hawkes-bay", status: "open", since: "Apr 2026", until: "Jul 2026", avgLeads: 21, bestMonth: 28, totalLeads: 98, months: 4,
    note: "Ran for a Napier/Hastings plumber Apr–Jul 2026. Page, ads and tracking are built and paused. Blocked drains, hot water cylinders and toilets led the calls." },
  { trade: "plumber", region: "christchurch", status: "open", since: "Feb 2026", until: "Sep 2026", avgLeads: 21, bestMonth: 35, totalLeads: 136, months: 6,
    note: "Our longest-running plumbing slot. Hot water cylinders, leaks and burst pipes. The machine is built and can be switched back on in 24 hours." },
  { trade: "plumber", region: "tauranga", status: "open", since: "Apr 2026", until: "Jul 2026", avgLeads: 18, bestMonth: 18, totalLeads: 44, months: 2,
    note: "Ran Apr–Jul 2026 across Tauranga, the Mount and Papamoa. Built and paused." },
  { trade: "plumber", region: "auckland", status: "open", since: "Apr 2026", until: "May 2026", avgLeads: 14, bestMonth: 14, totalLeads: 19, months: 1,
    note: "Short run in autumn 2026. Page and campaign exist; Auckland can be split into two plumbing areas." },
  { trade: "plumber", region: "dunedin", status: "built", note: "Landing page built, waiting for the first Dunedin plumber." },
  { trade: "plumber", region: "hamilton", status: "unbuilt" },
  { trade: "plumber", region: "south-auckland", status: "unbuilt" },
  { trade: "plumber", region: "northland", status: "unbuilt" },
  { trade: "plumber", region: "palmerston-north", status: "unbuilt" },
  { trade: "plumber", region: "nelson", status: "unbuilt" },
  { trade: "plumber", region: "new-plymouth", status: "unbuilt" },
  { trade: "plumber", region: "rotorua", status: "unbuilt" },
  { trade: "plumber", region: "queenstown", status: "unbuilt" },
  { trade: "plumber", region: "invercargill", status: "unbuilt" },

  // ---- Electricians ----
  { trade: "electrician", region: "wellington", status: "taken", since: "Jun 2026", avgLeads: 39, bestMonth: 48, totalLeads: 160, months: 4 },
  { trade: "electrician", region: "hamilton", status: "taken", since: "May 2026", avgLeads: 34, bestMonth: 42, totalLeads: 171, months: 5 },
  { trade: "electrician", region: "tauranga", status: "taken", since: "May 2026", avgLeads: 27, bestMonth: 47, totalLeads: 135, months: 5 },
  { trade: "electrician", region: "auckland", status: "taken", since: "Aug 2026", avgLeads: 10, bestMonth: 10, totalLeads: 21, months: 2 },
  { trade: "electrician", region: "south-auckland", status: "taken", since: "Aug 2026", avgLeads: 15, bestMonth: 20, totalLeads: 34, months: 2 },
  { trade: "electrician", region: "christchurch", status: "open", since: "Aug 2026", until: "Sep 2026", avgLeads: 13, bestMonth: 18, totalLeads: 26, months: 2,
    note: "Ran Aug–Sep 2026. 18 calls in the first half of September alone before the partner stepped away. Built, paused, ready." },
  { trade: "electrician", region: "hawkes-bay", status: "unbuilt" },
  { trade: "electrician", region: "northland", status: "unbuilt" },
  { trade: "electrician", region: "dunedin", status: "unbuilt" },
  { trade: "electrician", region: "palmerston-north", status: "unbuilt" },
  { trade: "electrician", region: "nelson", status: "unbuilt" },
  { trade: "electrician", region: "new-plymouth", status: "unbuilt" },
  { trade: "electrician", region: "rotorua", status: "unbuilt" },
  { trade: "electrician", region: "queenstown", status: "unbuilt" },
  { trade: "electrician", region: "invercargill", status: "unbuilt" },

  // ---- Handymen / builders ----
  { trade: "handyman", region: "auckland", status: "taken", since: "Jun 2026", avgLeads: 39, bestMonth: 58, totalLeads: 162, months: 4 },
  { trade: "handyman", region: "wellington", status: "taken", since: "Jun 2026", avgLeads: 42, bestMonth: 50, totalLeads: 186, months: 4 },
  { trade: "handyman", region: "christchurch", status: "taken", since: "Jun 2026", avgLeads: 26, bestMonth: 33, totalLeads: 108, months: 4 },
  { trade: "handyman", region: "south-auckland", status: "taken", since: "Jul 2026", avgLeads: 19, bestMonth: 25, totalLeads: 58, months: 3 },
  { trade: "handyman", region: "northland", status: "taken", since: "Sep 2026", note: "Launched late September 2026." },
  { trade: "handyman", region: "tauranga", status: "opening", since: "Sep 2026", avgLeads: 33, bestMonth: 33, totalLeads: 36, months: 1, opensOn: "November 2026",
    note: "33 enquiries in its first month. The current partner is finishing up, so this spot reopens in November." },
  { trade: "handyman", region: "hamilton", status: "unbuilt" },
  { trade: "handyman", region: "hawkes-bay", status: "unbuilt" },
  { trade: "handyman", region: "dunedin", status: "unbuilt" },
  { trade: "handyman", region: "palmerston-north", status: "unbuilt" },
  { trade: "handyman", region: "nelson", status: "unbuilt" },
  { trade: "handyman", region: "new-plymouth", status: "unbuilt" },
  { trade: "handyman", region: "rotorua", status: "unbuilt" },
  { trade: "handyman", region: "queenstown", status: "unbuilt" },
  { trade: "handyman", region: "invercargill", status: "unbuilt" },

  // ---- Roofers ----
  { trade: "roofer", region: "auckland", status: "built", note: "Landing page built for urgent roof repairs across Auckland. Waiting for the first roofer." },
  { trade: "roofer", region: "wellington", status: "unbuilt" },
  { trade: "roofer", region: "christchurch", status: "unbuilt" },
  { trade: "roofer", region: "hamilton", status: "unbuilt" },
  { trade: "roofer", region: "tauranga", status: "unbuilt" },
  { trade: "roofer", region: "hawkes-bay", status: "unbuilt" },
];

/* ---------------- helpers ---------------- */

export const tradeByKey = (k: string) => TRADES.find((t) => t.key === k);
export const regionByKey = (k: string) => REGIONS.find((r) => r.key === k);

export const slotSlug = (s: Slot) => `${s.trade}-${s.region}`;
export const slotPath = (s: Slot) => `/leads/${slotSlug(s)}`;
export const slotBySlug = (slug: string) => SLOTS.find((s) => slotSlug(s) === slug);
export const tradeHubPath = (t: TradeKey) => `/leads/${TRADES.find((x) => x.key === t)!.plural.split(" ")[0].toLowerCase()}`;
export const tradeHubByPlural = (slug: string) =>
  TRADES.find((t) => t.plural.split(" ")[0].toLowerCase() === slug);

export const STATUS_LABEL: Record<SlotStatus, string> = {
  taken: "Taken",
  open: "Open now",
  opening: "Opening soon",
  built: "Built, first partner wanted",
  unbuilt: "Not built yet",
};

export const STATUS_CTA: Record<SlotStatus, string> = {
  taken: "Join the waitlist",
  open: "Claim this area",
  opening: "Reserve this area",
  built: "Be first in",
  unbuilt: "Ask Joe to build it",
};

/** Slots that are open or opening and have real history: the ones to sell first. */
export const featuredOpenSlots = () =>
  SLOTS.filter((s) => (s.status === "open" || s.status === "opening") && (s.totalLeads ?? 0) > 0)
    .sort((a, b) => (b.avgLeads ?? 0) - (a.avgLeads ?? 0));

/** Headline numbers used across the site. Update with each monthly report. */
export const TOTALS = {
  callsTracked: 1361,
  callsAnswered: 1115,
  webEnquiries: 249,
  partnersServed: 24,
  activePartners: 12,
  firstCampaign: "February 2026",
  updated: "October 2026",
};

export const mailtoFor = (s: Slot, trade: Trade, region: Region) => {
  const subj =
    s.status === "taken"
      ? `Waitlist: ${trade.label} in ${region.short}`
      : `Is the ${trade.label} spot in ${region.short} still open?`;
  const body =
    s.status === "taken"
      ? `Hey Joe,\n\nPut me on the waitlist for the ${trade.label.toLowerCase()} spot in ${region.short}. Let me know the moment it opens.\n\nName:\nBusiness:\nMobile:\n\nCheers`
      : `Hey Joe,\n\nI want the ${trade.label.toLowerCase()} spot in ${region.short}.\n\nName:\nBusiness:\nMobile:\n\nCheers`;
  return `mailto:hello@leadhivenz.com?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`;
};
