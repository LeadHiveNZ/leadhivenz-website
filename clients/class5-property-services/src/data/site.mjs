// Business details used everywhere. Change the phone number / email / hours here and rebuild.
export const site = {
  name: 'Class 5 Property Services',
  legalName: 'Class 5 Property Services Ltd',
  owner: 'Jamie',
  tagline: 'Maintenance • Repairs • Property Care',
  phone: '021 704 252',           // shown on the site
  phoneIntl: '+6421704252',       // used in tel: links
  phoneSchema: '+64 21 704 252',
  email: 'jamie@class5services.co.nz',
  url: 'https://www.class5services.co.nz', // ASSUMED domain - confirm with Jamie
  city: 'Christchurch',
  region: 'Canterbury',
  // Placeholder hours - confirm with Jamie
  hours: [
    { label: 'Mon – Fri', value: '7:30am – 5:30pm' },
    { label: 'Saturday', value: 'By arrangement' },
  ],
  hoursSchema: [{ days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '07:30', closes: '17:30' }],
  description: 'Owner-operated property maintenance in Christchurch. TV wall mounting, plaster and GIB repairs, cabinetry, decks, fences, gates and rental property maintenance.',
  leadhive: 'https://leadhivenz.com',
  year: 2026,
};

export const tel = `tel:${site.phoneIntl}`;
export const mailto = `mailto:${site.email}`;
