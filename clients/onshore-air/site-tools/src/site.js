// Single source of truth for business facts used across every page.
// Everything here comes from the client's current site / brief. Do not add prices, review counts,
// years or guarantees that the client has not confirmed.
module.exports = {
  name: 'Onshore Air',
  owner: 'Luke',
  // Canonical host: the live Wix site (and Google's index) uses www, so keep it for the migration.
  origin: 'https://www.onshoreair.com.au',
  phone: { display: '0444 541 409', tel: '+61444541409' },
  email: 'onshoreair@outlook.com',
  abn: '22 594 945 437',
  licence: 'AU067414',
  locality: 'Pacific Paradise',
  region: 'QLD',
  postcode: '4564',
  hoursShort: 'Mon–Sat 7am–5pm',
  hours: [
    { label: 'Monday – Friday', value: '7:00 am – 5:00 pm' },
    { label: 'Saturday', value: '7:00 am – 5:00 pm' },
    { label: 'Sunday', value: 'Closed' },
  ],
  // Google search results page with Luke's Business Profile and reviews (outbound link, opens in a new tab)
  googleReviews: 'https://www.google.com/search?q=Onshore+Air+Pacific+Paradise+reviews',
  // Brands named on the client's site (text, for inner pages; the home logo strip uses the real logo files).
  brands: ['Mitsubishi Electric', 'Fujitsu', 'Mitsubishi Heavy Industries', 'General', 'Hisense'],
  otherBrands: 'Daikin, Panasonic, LG',
  // Real public Google reviews shown on the client's site, quoted verbatim.
  reviews: [
    { name: 'Renée B.', text: 'Prompt professional service. Did a fantastic job, will definitely use this service again, highly recommend' },
    { name: 'Lovisa H.', text: 'Fast service and great price. Very happy.' },
    { name: 'Anne I.', text: 'Excellent service and work from Luke at Onshore Air. He is reliable and was on time both occasions we have used him. He is prompt in responding to communication' },
  ],
  nav: [
    { href: '/installations/', label: 'Installations' },
    { href: '/repairs/', label: 'Repairs' },
    { href: '/hydro-cleaning/', label: 'Hydro cleaning' },
    { href: '/maintenance/', label: 'Maintenance' },
    { href: '/about/', label: 'About' },
    { href: '/service-areas/', label: 'Service areas' },
    { href: '/contact/', label: 'Contact' },
  ],
  services: [
    { href: '/installations/', label: 'Installations' },
    { href: '/repairs/', label: 'Repairs' },
    { href: '/hydro-cleaning/', label: 'Hydro cleaning' },
    { href: '/maintenance/', label: 'Maintenance' },
  ],
  // Coastal stops for the route graphic, south to north (DOM order); Pacific Paradise is the base.
  route: ['Caloundra', 'Kawana', 'Mooloolaba', 'Maroochydore', 'Pacific Paradise', 'Coolum', 'Peregian', 'Noosa'],
  hinterland: ['Nambour', 'Woombye', 'Palmwoods', 'Montville', 'Maleny'],
  areas: [
    {
      key: 'north', title: 'Northern beaches', range: 'Noosa to Pacific Paradise',
      text: 'Beachside homes from Noosa down to Mudjimba cop salt air, sand and humidity all year round. That is hard on outdoor units and coils, so regular servicing and hydro cleans pay off here.',
      suburbs: ['Noosa Heads', 'Noosaville', 'Tewantin', 'Sunshine Beach', 'Peregian Beach', 'Peregian Springs', 'Coolum Beach', 'Yaroomba', 'Marcoola', 'Mudjimba', 'Twin Waters', 'Pacific Paradise'],
    },
    {
      key: 'central', title: 'Central Coast', range: 'Bli Bli to Sippy Downs',
      text: 'Just down the road from our Pacific Paradise base. From Maroochydore units and Mooloolaba holiday lets to family homes in Buderim and Sippy Downs.',
      suburbs: ['Bli Bli', 'Maroochydore', 'Kuluin', 'Alexandra Headland', 'Mooloolaba', 'Mountain Creek', 'Buderim', 'Forest Glen', 'Sippy Downs'],
    },
    {
      key: 'south', title: 'Southern suburbs', range: 'Kawana to Caloundra',
      text: 'Kawana Waters, Caloundra and the canal estates of Pelican Waters and Golden Beach. Plenty of new builds and renovations, plus older systems ready for a clean or an upgrade.',
      suburbs: ['Kawana Waters', 'Buddina', 'Warana', 'Birtinya', 'Currimundi', 'Little Mountain', 'Caloundra', 'Kings Beach', 'Golden Beach', 'Pelican Waters'],
    },
    {
      key: 'hinterland', title: 'Hinterland', range: 'Nambour to Maleny',
      text: 'Hot, still summer days and cool winter nights. A reverse-cycle system earns its keep in the hinterland, and Luke is happy to make the drive up the range.',
      suburbs: ['Nambour', 'Yandina', 'Eumundi', 'Woombye', 'Palmwoods', 'Mapleton', 'Montville', 'Maleny'],
    },
  ],
};
