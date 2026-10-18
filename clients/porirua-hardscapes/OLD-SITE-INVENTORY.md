# Porirua Hardscapes — old site inventory

Pulled 18 Oct 2026 from **https://www.poriruahardscapes.co.nz/** (a Duda site, published 21 Nov 2025,
site alias `13f4aadd`). Everything below is verbatim from the live pages saved in
`assets/img/_from-old-site/_pages/` (one HTML file per page, the three site CSS files and the sitemap).
Images are in `assets/img/_from-old-site/` with `manifest.tsv` (file, bytes, pixel size, source URL,
pages it appeared on, alt text, notes). Nothing has been placed into the placeholder paths; see
"Proposed mapping" at the end.

## Reachability

| Source | Result |
|---|---|
| `https://www.poriruahardscapes.co.nz/` | 200. All 11 pages in the sitemap + `/t/tou-and-privacy` fetched. `/about`, `/about-us`, `/contact`, `/gallery` are 404 (they never existed). |
| `https://www.poriruahardscapes.com/` | **451 "Service suspended \| Webador"** — a dead Webador placeholder with `noindex`. Nothing to pull. Still worth the 301 → .co.nz once DNS is ours. |
| Image CDN `irp.cdn-website.com` / `lirp.cdn-website.com` | 200. Originals served at `/13f4aadd/dms3rep/multi/<name>.<ext>` (the `/opt/<name>-1920w.<ext>` form is the resized copy). All 80 unique images came down at original size. |
| Video CDN `vid.cdn-website.com` | **403** for anonymous requests. The 6 project videos could not be downloaded (URLs listed below; their poster frames were saved). |
| Facebook `https://facebook.com/p/Porirua-Hardscapes-61576109378291/` (the link the old site uses) | Page itself, `m.`, `mbasic.`, `profile.php?id=` and `/poriruahardscapes` all redirect to login (HTTP 400). The public **page plugin** works and gives: page name **"Porirua Hardscapes"**, **668 followers**, and the profile picture at 160 px (saved as `facebook-profile-picture-160.png`; it is the branded Hino tip-truck photo, same as `557541920_…_n.jpg`). Graph API returns only the silhouette placeholder. No posts, about text, cover photo, reviews or photo albums are reachable without a login. The page ID is **61576109378291**; the vanity URL `facebook.com/poriruahardscapes` assumed in site.js is **not** confirmed (it redirects to login rather than 404, so it may or may not exist). |

Note for the README "Confirm with Adam" list: the live site shows **only** `adam@poriruahardscapes.co.nz`
(no gmail address anywhere) and **no mention of arborist services** in the copy. The only arborist
reference is a partner logo for Zane White Business (see Partners).

## Site-wide elements (header / footer, identical on every page)

- Logo: `logo_porirua-hardscapes_main.png` (1859×893, transparent PNG, black "PORIRUA" over yellow "HARDSCAPES" block). Alt text: "Porirua Hardscapes".
- Open Graph image: `opengraph.png` (1200×630, same logo on white).
- Favicon: `https://irp.cdn-website.com/13f4aadd/site_favicon_16_1760719921700.ico` (16 px, not saved).
- Fonts: Poppins (body) and Days One (headings) via Duda's Google Fonts proxy.
- Phone: **027 244 4501** (`tel:027 244 4501`). Email: **adam@poriruahardscapes.co.nz**.
- Facebook icon → `https://facebook.com/p/Porirua-Hardscapes-61576109378291/`. No Instagram, LinkedIn, YouTube or Google links anywhere.
- Nav: Home · Services (Concrete Structures & Driveways · Excavator & Truck Services · Landscape Construction · Decking & Fencing · Retaining Walls · Residential Demolition) · Partners · Projects · Project Videos (`/new-landscaping-projects-wellington#ProjectVideos`) · Contact Us
- Footer "Browse Our Website": same links. Footer "Contact Information":
  - Phone Number: 027 244 4501
  - Email: adam@poriruahardscapes.co.nz
  - **Available 7-Days**
- Footer legal line: "Content, including images, displayed on this website is protected by copyright laws. Downloading, republication, retransmission or reproduction of content on this website is strictly prohibited. Terms of Use | Privacy Policy" (links to `/t/tou-and-privacy#TOU` and `#PP`).
- Every page has two CTAs: "Call Now" (tel link) and "Send an Enquiry" (→ `/landscaping-and-construction-quotes`).
- No street address, no opening hours beyond "Available 7-Days", no NZBN/GST, no Google review widget, no sponsor section anywhere on the old site.

## Page 1 — Home `/`

`<title>` Expert Excavation & Landscaping | Wellington, NZ
Meta description: Porirua Hardscapes is the top excavation contractor operating across the Wellington, NZ region. Click here to request a free quote!

Hero background (full-width, from the home CSS): `Messenger_creation_EC769C59-05A7-48B7-8F3B-BF50D27FA8BA.jpg` — crew of three placing concrete from a line pump in a garden, truck behind.

# Concrete, Excavation & Landscape Construction in Wellington, NZ
[Call Now] [Send an Enquiry]

## Your Local Concrete & Excavation Specialists
At Porirua Hardscapes, we specialise in concrete, excavation, and landscape construction across Porirua, Wellington City, Lower Hutt, Upper Hutt, and surrounding suburbs. With over 36 years of experience, our locally owned and operated team delivers high-quality craftsmanship and long-lasting results for residential and commercial projects. From driveways and patios to site excavation and landscaping, we provide end-to-end services, ensuring every project is completed safely, efficiently, and to the highest standard. Whether it's a new build, renovation, or outdoor upgrade, Porirua Hardscapes is your trusted partner for hardscape construction that stands the test of time.

## Our Services
(six cards; the card background photos come from the home CSS: `557623886_…_n.jpg` concrete pour, `561260421_…_n.jpg` slab, `532243848_…_n.jpg` retaining wall, `20250814_150935.jpg` deck, `IMG_20250928_130429.jpg` driveway pour, and the four 625×438 webp crops `6882cd19…`, `688acd26…`, `688acd27…`, `688acd7b…`)
- **Concrete Structures & Driveways** — Durable, clean-finished concrete work for driveways, patios, footpaths, slabs, and foundations, built to withstand Wellington's conditions.
- **Excavator & Truck Services** — Reliable excavator and truck hire with experienced operators for site preparation, material removal, trenching, and bulk earthworks.
- **Landscape Construction** — Design and build practical, attractive outdoor spaces—from garden edging and paving to full section clear-outs and soft landscaping.
- **Decking & Fencing** — Custom timber decks and fences to suit your section, style, and budget, including design, construction, and compliance.
- **Retaining Walls** — Strong, well-drained retaining walls using timber, concrete, or block—perfect for levelling, soil retention, and maximising usable space.
- **Residential Demolition** — Safe and efficient residential demolition services, from small sheds and garages to full house clear-outs, with responsible waste removal.

## Why Choose Porirua Hardscapes
- **Decades of Experience** — 36 years of hands-on expertise delivering reliable results across Wellington.
- **Locally Owned & Operated** — A trusted team that understands the region's terrain, climate, and council requirements.
- **Skilled & Dedicated Team** — Professional, experienced staff committed to quality workmanship and attention to detail.
- **Full-Service Solutions** — From site preparation to finishing touches, we manage every stage of your project.
- **Safe & Compliant Practices** — We prioritise safety and regulatory compliance on all projects, giving you peace of mind.
- **Durable, Long-Lasting Results** — We use high-quality materials and proven techniques to ensure every job stands the test of time.

## Our Partners
Six logos in this order (alt text as on the site):
1. `68898946c625b846114ec6a0.png` — "AM HIRE logo: white text on black and red backgrounds." → **AM Hire**
2. `68898a358934ce97f3024673.png` — "Logo: Black outline of a concrete pump truck with "RGS" and "REEVE GUNITE SERVICES" text." → **RGS – Reeve Gunite Services** (concrete pumping)
3. `68898946db482feb57499eab.png` — "Yellow "TOA iM" logo on black background." → **TOA ITM** (building supplies; the alt text mis-reads ITM as "iM")
4. `688e8ca46f7cfeb0d1068734.webp` — "Red OTS logo with a slight drop shadow." → **OTS**
5. `688e8cdbf2006b51e0f6cd0d.png` — "Logo for HireWays, machinery rentals. Yellow text and red accent on a white background." → **HireWays Machinery Rentals**
6. `Screenshot_2025-10-22_105731.png` — no alt. Green card reading **"ZWB – Zane White Business – M: 027 701 2511 – Arborist & Tree Care"** (a screenshot, 820×470, with a tree illustration).

## Customer Testimonials (verbatim, including the site's own punctuation)
★★★★★
"Porirua Hardscapes did an amazing job on our driveway. The attention to detail and quality of work are unmatched. Highly recommend them!"
– John MacKay – Island Bay

★★★★★
"Adam and the team completely restored my faith in tradesman; they delivered a perfect product under budget."
– Gill and Terry – Whitby

★★★★★
"Porirua Hardscapes just blew me away. The exposed aggregate concrete job they completed at my home is nothing short of spectacular a flawless blend of craftsmanship, precision, and pride. It's not just a surface; it's a statement.
From the very first conversation, Adam made everything feel easy and transparent.
His communication was outstanding, and the three walk-throughs ensured we were always aligned. I felt confident and informed every step of the way no guesswork, no surprises, just pure professionalism.
Adam and his crew are absolute legends. A top-tier team of hardworking, respectful guys who clearly love what they do. Their attention to detail, their work ethic, and the way they carried themselves on-site was next level. You can tell they take real pride in their work and it shows in the final result.
The finished product is stunning. I keep walking outside just to admire it. It's elevated the whole look of my property, and I couldn't be more grateful. Massive thanks to Adam and the crew you've earned every bit of this 5-star review.
If you're considering concrete work, stop searching, Porirua Hardscapes is the gold standard."
– Keith Nicol

★★★★★
"Adam and his team are fantastic! Great communication, and good quality work. Goes over and above to make sure the customer is happy. My concreting and retaining walls look amazing! Definitely recommend."
- Joel Johnson

★★★★★
"Adam and his team were seamless. No question was ever a nuisance to them. We had a large amount of concrete pathways done and they went the extra mile with bark and stone prep for future gardens. Highly recommend to all."
- Laura Jefferies

## Contact Us for a Free Quote
Transform your driveway, add new concrete structures, or start your next hardscape project with confidence. Contact Porirua Hardscapes now for a free quote!
[Call Now] [Send an Enquiry]

## Page 2 — `/concrete-services-wellington`

`<title>` Concrete Delivered | Wellington, NZ
Meta: Porirua Hardscapes is the top concrete contractor operating across the Wellington, NZ region. Click here to request a free concreting quote!
Photos on the page (in order): `557623886_…_n.jpg` (hero: fresh driveway pour in front of townhouses), `Messenger_creation_12AF41F8-….jpeg` (freshly laid dark exposed-aggregate driveway at garages), `561260421_…_n.jpg` (new slab with drain), `20250919_070641.jpg` (driveway mesh prep, truck), `20250821_124651.jpg` (plain concrete pad between timber walls).

# Concrete Structures & Driveways in Wellington
At Porirua Hardscapes, we specialise in delivering strong, reliable, and great-looking concrete structures and driveways for homes and businesses across Porirua, Wellington City, Lower Hutt, Upper Hutt, and surrounding suburbs. With over 36 years of industry experience, our locally owned and operated team knows how to build concrete solutions that not only look impressive but also stand up to New Zealand's unique climate and terrain.

## Durable Concrete Solutions for Every Project
Concrete remains one of the most reliable and versatile construction materials available. Whether you need a practical driveway that can withstand years of vehicle traffic or a decorative patio that enhances your outdoor living area, we provide the right combination of durability, style, and expert workmanship. Our services include:
- **Concrete Driveways** — Strong, low-maintenance, and designed to handle everyday use.
- **Patios & Courtyards** — Smooth, attractive spaces for outdoor entertaining.
- **Footpaths & Walkways** — Safe, even, and long-lasting pedestrian access solutions.
- **Slabs & Foundations** — Precision-poured concrete foundations to support your new build.
- **Retaining Walls & Hardscapes** — Structural concrete solutions designed for Wellington's challenging landscapes.

## Concrete Driveways That Last
A driveway is one of the most important hardscape features of any property. It needs to be tough enough to handle constant use, practical for all vehicles, and visually appealing to complement your home or business. At Porirua Hardscapes, we build driveways that are designed to last. We use high-quality concrete mixes, proven installation techniques, and finishes that resist cracking, chipping, and weather damage. Whether you want a plain concrete finish, exposed aggregate, or coloured concrete, we tailor the design to match your property's style and needs.

## Why Choose Porirua Hardscapes for Concrete Services?
Choosing the right team for your concrete project makes all the difference. At Porirua Hardscapes, we combine decades of experience with a hands-on approach to ensure every project is completed to the highest standard.
- **Experienced Team** — We've seen it all and know how to deliver reliable results.
- **Locally Owned & Operated** — Proudly based in Porirua and working across the wider Wellington region.
- **Built to Withstand NZ Conditions** — Our concrete is designed for strength and durability in Wellington's climate.
- **On-Time & On-Budget Delivery** — Reliable service that ensures no surprises.

## FAQ – Concrete Structures & Driveways
- **How long will my new concrete driveway last?** With proper installation and maintenance, a concrete driveway can last 30+ years. At Porirua Hardscapes, we use strong mixes and proven techniques to maximise durability.
- **Can I choose different finishes for my driveway?** Yes. We offer a range of finishes, including plain concrete, exposed aggregate, broom finishes, and coloured concrete. We'll recommend the best option based on your property style and needs.
- **How long before I can use my new driveway?** Typically, you can walk on your driveway within 24–48 hours, but we recommend waiting at least 7 days before parking vehicles on it. Full curing takes around 28 days for maximum strength.
- **Do you take care of excavation and site prep?** Absolutely. Our team manages the entire process—including excavation, drainage considerations, and formwork—so your driveway or slab has a solid, stable foundation.
- **Will my concrete crack over time?** All concrete has the potential to develop minor hairline cracks, but with reinforcement, proper curing, and control joints, we minimise cracking and ensure your driveway remains structurally sound.
- **Do you offer free quotes?** Yes—we provide obligation-free quotes across Porirua, Wellington City, Lower Hutt, Upper Hutt, and surrounding areas.

## Contact Us for a Free Quote
Ready to upgrade your driveway or add new concrete structures to your property? Contact Porirua Hardscapes today to arrange a free quote! Our friendly team will discuss your needs, provide expert advice, and deliver a solution that's built to last.

## Page 3 — `/retaining-wall-construction-wellington`

`<title>` Retaining Wall Builders | Wellington, NZ
Meta: Porirua Hardscapes is the top retaining wall contractor operating across the Wellington, NZ region. Click here to request a free quote!
Photos (in order): `532243848_…_n.jpg` (hero, only 640×480: timber wall under construction with a ladder), `532422803_…_n.jpg` (timber posts set along a bank, worker), `531828062_…_n.jpg` (timber wall with fence above, paver surround and drain), `532884771_…_n.jpg` (close-up of posts and a bank, in progress).

# Retaining Walls in Wellington, NZ
At Porirua Hardscapes, we design and construct durable retaining walls that are built to handle Wellington's unique terrain and weather conditions. Serving Porirua, Wellington City, Lower Hutt, Upper Hutt, and surrounding suburbs, we provide practical solutions for soil retention, levelling, erosion control, and maximising usable outdoor space. Our experienced team combines strong construction techniques with quality materials to deliver retaining walls that not only perform well but also complement your landscape design.

## Strong and Reliable Retaining Wall Solutions
Retaining walls are essential for many properties across Wellington due to sloped sections, soft ground, or the need to create level areas for driveways, gardens, or outdoor living spaces. At Porirua Hardscapes, we take care of the entire process, from site preparation and excavation through to drainage installation and wall construction, ensuring your wall is safe, functional, and built to last. We construct retaining walls using a range of materials, including:
- Timber Retaining Walls – A natural, cost-effective solution for residential landscapes.
- Concrete Retaining Walls – Extremely strong and ideal for heavy loads and long-term durability.
- Block Retaining Walls – A modern and attractive option for structural and decorative use.
Our team will assess your site and recommend the best type of retaining wall to meet your needs, budget, and the requirements of your property.

## Built for Wellington Conditions
Retaining walls in the Wellington region must be carefully designed to cope with rainfall, soil movement, and hilly terrain. We ensure every wall we build has the proper foundations and drainage systems to prevent water buildup and structural failure. By combining practical engineering with quality workmanship, we deliver walls that remain stable and effective for decades. Whether you need a wall to hold back soil, level a building platform, create garden terraces, or prevent erosion, our team provides a solution tailored to your section.

## Why Choose Porirua Hardscapes for Retaining Walls?
- **Proven Results** — Decades of proven work in Wellington's tough landscapes.
- **Locally Owned & Operated** — A team that understands the region's terrain and climate.
- **Quality Materials** — Timber, concrete, and block walls built for strength and longevity.
- **Functional & Attractive Designs** — Retaining walls that improve usability and enhance appearance.

## FAQ – Retaining Walls
- **Do I need a retaining wall on my property?** If your section is sloped, prone to erosion, or needs more usable flat space, a retaining wall may be the best solution. We can assess your site and recommend the most suitable option.
- **What type of retaining wall is best—timber, concrete, or block?** It depends on your site, budget, and aesthetic preferences. Timber is cost-effective and blends well with gardens, concrete is extremely strong and long-lasting, and block provides a modern look with solid performance.
- **Will my retaining wall need drainage?** Yes. Proper drainage is essential for a safe, long-lasting retaining wall. We incorporate drainage systems into all our builds to prevent water pressure from weakening the structure.
- **Do I need council consent for a retaining wall?** In some cases—particularly if the wall is over 1.5 metres high or supporting a driveway or structure—you may require council consent. Our team can advise you and ensure compliance.
- **How long will my retaining wall last?** With the right design, quality materials, and proper drainage, a retaining wall can last 20–50 years or more depending on the type of construction.
- **Do you provide free quotes?** Yes. We offer obligation-free quotes across Porirua, Wellington City, Lower Hutt, Upper Hutt, and surrounding areas.

## Contact Us for a Free Quote
Looking to make the most of your outdoor space with a strong, practical retaining wall? Contact Porirua Hardscapes today to arrange a free quote! Our expert team will design and build a retaining solution that's safe, durable, and tailored to your property.

## Page 4 — `/landscaping-services-wellington`

`<title>` Expert Landscapers | Wellington, NZ
Meta: Porirua Hardscapes is the top landscaping contractor operating across the Wellington, NZ region. Click here to request a free landscaping quote!
Photos (in order): `531828062_…_n.jpg` (hero, same wall/paver photo as the retaining page), `IMG_20251011_172539.jpg` (exposed-aggregate path with a stacked-stone water feature and timber screen), `1000007935_from-png.jpg` (orange Hitachi excavator beside a house, landscape crop), `20250724_133030.jpg` (Kubota mini excavator digging a back yard), `515402244_…_n.jpg` (bare hillside section prepped with drainage coil laid).

# Landscape Construction in Wellington, NZ
At Porirua Hardscapes, we specialise in creating functional, attractive, and long-lasting outdoor spaces across Porirua, Wellington City, Lower Hutt, Upper Hutt, and surrounding suburbs. Our team has the expertise to transform your property into a practical and welcoming environment. Whether you need paving, garden edging, fencing, section clear-outs, or soft landscaping, we provide a one-stop solution for high-quality results tailored to your home or business.

## Complete Landscape Construction Services
Our landscaping team manages projects from concept to completion—delivering outdoor spaces that are both practical and visually appealing. We combine strong construction techniques with thoughtful design to ensure your new landscape looks great and functions well in everyday use. Our services include:
- **Garden Edging & Borders** — Clean, durable edges to define garden beds and pathways.
- **Paving & Courtyards** — Functional hard surfaces for driveways, patios, and walkways.
- **Fencing & Gates** — Secure and stylish solutions to enhance privacy and safety.
- **Full Section Clear-Outs** — Removing overgrowth, waste, and obstacles to prepare your land for a fresh start.
- **Soft Landscaping** — Planting, lawn establishment, and garden design to bring life and greenery to your property.
- **Retaining Walls** — Structural solutions to manage slopes and add usable outdoor space.

## Transforming Outdoor Spaces
We understand that every property is different, which is why we tailor our approach to suit your land, style, and budget. Our team takes care of both the structural groundwork (excavation, retaining, paving) and the finishing details (planting, edging, turfing), so you can enjoy a seamless service from start to finish. Wellington's terrain and weather conditions can be challenging, but with our knowledge and experience, we design and build landscapes that are built to last—providing you with outdoor areas that remain safe, usable, and visually appealing for years to come.

## Why Choose Porirua Hardscapes for Landscape Construction?
- **Decades of Experience** — Decades of proven results in outdoor construction and landscaping.
- **End-to-End Service** — From site preparation to planting, we handle the entire process.
- **Durable Results** — Strong construction methods designed for New Zealand conditions.
- **On-Time & On-Budget** — Projects delivered efficiently without cutting cossrners. *(sic — typo on the old site)*

## FAQ – Landscape Construction
- **Can you handle both hard landscaping and soft landscaping?** Yes. We provide a complete service—from structural work like paving, edging, and retaining walls to soft landscaping such as planting, lawns, and garden beds.
- **Do you offer section clear-outs before landscaping?** Absolutely. We can remove overgrowth, rubbish, and debris to give your property a clean slate before construction or planting begins.
- **How do I know what landscaping design will work for my property?** Our team will assess your site and discuss your goals, budget, and lifestyle needs before recommending a tailored design plan.
- **Is your work suitable for Wellington's weather and terrain?** Yes. We design with durability in mind, using materials and methods proven to withstand Wellington's climate and landscape conditions.
- **Do you provide fencing as part of landscaping?** Yes—we install fencing and gates to complement your landscape design and improve privacy and security.
- **Do you offer free quotes?** Yes—we provide obligation-free quotes across Porirua, Wellington City, Lower Hutt, Upper Hutt, and nearby suburbs.

## Contact Us for a Free Quote
Ready to transform your outdoor space into something practical, attractive, and built to last? Contact Porirua Hardscapes today to arrange a free quote! Our experienced team will work with you to design and build a landscape that adds real value to your property.

## Page 5 — `/excavator-hire-services-wellington`

`<title>` Hire an Excavation Crew | Wellington, NZ
Meta: Porirua Hardscapes is the top excavation contractor operating in the Wellington, NZ region. Click here to request a free truck and excavation hire quote!
Photos (in order): `20250724_133030.jpg` (hero: Kubota mini excavator in a back yard), `IMG_20250729_214044_from-png.jpg` (Kubota excavator excavating a yard against a timber fence and brick house), `557774130_…_n.png` (branded Porirua Hardscapes Hino tip truck, side view), `511996261_…_n.jpg` (orange Hitachi excavator digging beside a house).
Email on this page: adam@poriruahardscapes.co.nz only (no gmail address on the live site).

# Excavator & Truck Services in Wellington
At Porirua Hardscapes, we provide professional excavator and truck services across Porirua, Wellington City, Lower Hutt, Upper Hutt, and surrounding suburbs. Our locally owned and operated team delivers efficient, safe, and reliable earthmoving solutions for residential, commercial, and civil projects. Whether you're preparing a site for a new build, clearing away soil and debris, or moving heavy materials, our fleet of well-maintained machinery and skilled operators ensures the job gets done right—the first time.

## Excavator & Truck Hire with Operators
We don't just hire out machinery—we provide fully operated services. That means you benefit from the expertise of our experienced operators, ensuring the work is completed accurately, safely, and within your project timeframe. Our services include:
- **Site Excavation** — Precise digging for foundations, pools, driveways, and landscaping.
- **Soil & Rubbish Removal** — Efficient clearing of unwanted earth, green waste, and construction debris.
- **Trenching & Drainage Preparation** — Accurate trenching for plumbing, electrical, and drainage systems.
- **Land Clearing & Levelling** — Preparing your site for new builds or landscaping projects.
- **Heavy Material Transport** — Using our trucks to move soil, gravel, aggregate, or demolition waste.
- **Retaining Wall & Hardscape Prep** — Excavation and backfilling to support concrete and retaining wall structures.

## Safe, Efficient, and Reliable
At Porirua Hardscapes, we pride ourselves on professional workmanship and site safety. Every project is carefully planned to minimise disruption and meet compliance requirements. Our operators are trained to work with precision, ensuring excavation is done correctly the first time—saving you both time and money. We also understand Wellington's unique terrain and weather conditions, meaning we know how to manage slopes, drainage challenges, and access limitations effectively.

## Contact Us for a Free Quote
Planning an excavation or earthmoving project? Need a reliable truck and excavator team to handle the heavy lifting? Contact Porirua Hardscapes today to arrange a free quote!

(No FAQ section on this page.)

## Page 6 — `/construction-demolition-services-wellington`

`<title>` House Demolition Solutions | Wellington, NZ
Meta: Porirua Hardscapes is the top demolition contractor operating across the Wellington, NZ region. Click here to request a demolition quote!
Photos (in order): `517951759_…_n.jpg` (hero: demolition timber piled beside a block wall), `20250709_090340.jpg` (red excavator pulling down a timber structure at a block wall), `1000008103.jpg` (tip truck loaded with demolition timber), `518210473_…_n_1_.jpg` (excavator bucket in the demolition debris).

# Residential Demolition Services in Wellington, NZ
When it comes to preparing your site for a fresh start, safe and efficient demolition is essential. At Porirua Hardscapes, we provide professional residential demolition services across Wellington, handling everything from small-scale removals to full-site clear-outs. With decades of experience, modern equipment, and a commitment to safety, we deliver results you can rely on. Our team works throughout Porirua, Wellington City, Lower Hutt, Upper Hutt, and nearby suburbs—helping homeowners clear space for rebuilds, renovations, or new construction projects. From old garages and sheds to complete house demolitions, Porirua Hardscapes takes care of every detail so you can move confidently into the next stage of your project.

## Our Residential Demolition Services
We understand that every property and every project is unique. That's why we offer a wide range of demolition solutions tailored to your specific needs.
- **Full House Demolition** — Safe, controlled demolition of entire homes, including utility disconnection and complete debris removal.
- **Partial Demolition** — Removal of extensions, walls, or interior areas while preserving the rest of the structure for renovations or upgrades.
- **Garage, Shed & Outbuilding Removal** — Quick and efficient demolition of smaller structures such as garages, carports, decks, or sheds.
- **Site Clearance & Preparation** — Once structures are removed, we can clear and level the site to prepare it for construction, landscaping, or future use.
- **Waste Removal & Recycling** — We responsibly manage demolition waste, recycling timber, metal, and concrete wherever possible to reduce environmental impact.

## Why Choose Porirua Hardscapes?
- **Safety First** — Every demolition project is carefully planned and executed with strict safety protocols to protect your property and the surrounding area.
- **Complete Project Management** — From permits to debris removal, we handle every stage, so you don't have to juggle multiple contractors.
- **Experienced Operators** — With over 36 years in the industry, our locally owned and operated business brings unmatched expertise to every demolition job.
- **Modern Equipment** — We use well-maintained trucks, excavators, and tools to ensure efficiency and precision on every site.

## Residential Demolition Across Wellington
Whether you're preparing for a full rebuild, removing an unsafe structure, or simply reclaiming space on your property, Porirua Hardscapes is your trusted demolition partner across the Wellington region. Our team ensures every project is carried out to the highest standards, with minimal disruption and maximum efficiency. We regularly service Porirua, Wellington City, Lower Hutt, Upper Hutt, and surrounding areas, bringing local knowledge and trusted expertise to homeowners throughout the region.

## FAQ – Residential Demolition Wellington
- **How long does a residential demolition take?** The timeframe depends on the size and type of structure. A small shed may be cleared in a day, while a full house demolition can take several days to a week, including debris removal.
- **Do I need a permit for residential demolition?** In most cases, yes. Porirua Hardscapes can assist with the permit process and ensure all council requirements are met before work begins.
- **What happens to the waste materials?** We sort and recycle as much material as possible, including timber, concrete, and metals. Non-recyclable waste is disposed of responsibly at approved facilities.
- **Can you remove asbestos during demolition?** If asbestos is present, we work with licensed asbestos removal specialists to ensure it is safely managed and disposed of in compliance with regulations.
- **How much does residential demolition cost?** Costs vary depending on the size of the structure, site conditions, and waste disposal needs. We provide detailed, competitive quotes upfront, so you know exactly what to expect.

## Demolition Quotes & Enquiries
If you need professional residential demolition services in Wellington, trust Porirua Hardscapes to deliver safe, efficient, and cost-effective results. From small structures to full-site clear-outs, we'll clear the way for your next project.

## Page 7 — `/fencing-services-wellington`

`<title>` Deck & Fence Builders | Wellington, NZ
Meta: Porirua Hardscapes is the top decking and fencing contractor operating across the Wellington, NZ region. Click here to request a free quote!
Photos (in order): `20251002_161155.jpg` (hero: timber planter boxes and steps at a white house), `20250814_150935.jpg` (new pine deck with a timber privacy fence), `GettyImages-1454427587.JPG` (**stock** hardwood deck with outdoor chairs), `f4c80598-….jpg` (timber fence/retaining frame being built at a townhouse).

# Decking & Fencing in Wellington
At Porirua Hardscapes, we design and build custom timber decks and fences for homes and businesses across Porirua, Wellington City, Lower Hutt, Upper Hutt, and surrounding suburbs. With more than 36 years of industry experience, our locally owned and operated team delivers outdoor structures that are practical, attractive, and built to last. Whether you're looking to expand your outdoor living with a new deck or secure your property with a strong, stylish fence, we provide a complete service—from design and construction through to compliance and finishing.

## Custom Decking Solutions
A well-designed deck can transform your outdoor space into an extension of your home. At Porirua Hardscapes, we create timber decks tailored to your section, style, and budget. Our team manages the entire process, including:
- Design & Planning – Deck layouts that make the most of your outdoor area.
- Site Preparation – Excavation, levelling, and foundation work.
- Construction – Strong, durable decks built with quality materials.
- Finishing & Detailing – Steps, railings, and balustrades for safety and style.
Whether you prefer a low-profile entertaining area or an elevated deck with a view, we build decks that are safe, functional, and perfectly matched to your home's style.

## Reliable Fencing Services
Fences play a vital role in privacy, security, and property boundaries, but they also contribute to the overall look of your outdoor space. We build timber fences that balance strength with aesthetics, ensuring a seamless match with your landscape. Our fencing options include:
- Boundary Fencing – Clearly define your property lines.
- Privacy Screens – Create sheltered, private outdoor areas.
- Garden & Decorative Fencing – Stylish additions to enhance your landscaping.
- Gates – Secure, easy-access solutions tailored to your fence design.
We take care of council requirements and compliance so your new fence is built to standard, giving you peace of mind along with a professional finish.

## Why Choose Porirua Hardscapes for Decking & Fencing?
- **36+ Years of Experience** — Decades of proven results in timber construction.
- **Custom Designs** — Decks and fences built to suit your property and lifestyle.
- **Quality Materials & Craftsmanship** — Structures designed to last in NZ conditions.
- **On-Time & On-Budget Delivery** — Reliable service with no unnecessary delays.

## FAQ – Decking & Fencing
- **Do you handle council compliance for decks and fences?** Yes. We take care of all compliance and building requirements, so your structure is built to code.
- **What timber options do you offer for decking?** We use a range of treated pine, hardwoods, and composite options depending on your budget, design, and maintenance preferences.
- **How long will my new deck last?** With proper construction and maintenance, a timber deck can last 20+ years. We use quality materials and proven methods to ensure longevity.
- **Do you also build gates?** Yes. We custom-build gates to match your fencing, ensuring secure and easy access to your property.
- **Can you integrate decks with landscaping?** Absolutely. As a full-service hardscape company, we can combine decking with paving, retaining walls, and landscaping for a seamless outdoor finish.
- **Do you offer free quotes?** Yes—we provide obligation-free quotes for decking and fencing projects across Porirua, Wellington City, Lower Hutt, Upper Hutt, and nearby suburbs.

## Contact Us for a Free Quote
Ready to enhance your outdoor living with a new deck or fence? Contact Porirua Hardscapes today to arrange a free quote! Our skilled team will design and build a structure that suits your property, style, and budget—delivering results you'll enjoy for years to come.

## Page 8 — `/hardscaping-services-wellington` ("Partners")

`<title>` Concrete Delivered | Wellington, NZ (same title as the concrete page)
Meta: Porirua Hardscapes provides reliable contracting services across the Wellington, NZ region. Click here to learn more about our partners.
Hero background: `GettyImages-1175808366.JPG` (**stock**: worker in a red check shirt and hi-vis facing a loader).

# Our Partners
The same six logos as the home page (AM Hire, RGS Reeve Gunite Services, TOA ITM, OTS, HireWays, ZWB Zane White Business), plus `557541920_…_n.jpg` — the branded Hino tip truck and ute parked nose-on. No partner descriptions or links; the logos are not hyperlinked.

## Contact Us
[Call Now] [Send an Enquiry]

## Page 9 — `/new-landscaping-projects-wellington` ("Projects" / "Project Videos")

`<title>` Landscaping & Concreting Projects | Wellington, NZ
Meta: Porirua Hardscapes is the top hardscaping contractor operating across the Wellington, NZ region. Click here to view our work.
Hero background: `IMG_20250729_214044.jpg` (Kubota excavator digging a back yard, brick house).

## Our Work
A 42-tile photo gallery with **no captions, titles or suburbs** (every tile's caption container is empty and hidden). Gallery order, by file:
`Messenger_creation_47DE10B9-….jpeg`, `Screenshot_20251004_155224_Messenger.jpg`, `IMG_20251011_172539.jpg`, `Messenger_creation_12AF41F8-….jpeg`, `IMG_20251009_204654.jpg`, `IMG_20251009_204651.jpg`, `IMG_20250928_130429.jpg`, `IMG_20250729_214044.jpg`, `IMG_20250719_190240.jpg`, `f4c80598-….jpg`, `20251002_161220.jpg`, `20251002_161155.jpg`, `20251002_161210.jpg`, `20250919_080713.jpg`, `20250919_070641.jpg`, `20250916_131024.jpg`, `20250919_070036.jpg`, `20250916_130049.jpg`, `20250828_104714.jpg`, `20250822_115603.jpg`, `20250828_104631.jpg`, `20250818_153217.jpg`, `20250821_124651.jpg`, `20250814_152651.jpg`, `20250814_150935.jpg`, `20250715_144531.jpg`, `20250724_133030.jpg`, `20250715_144528.jpg`, `20250626_115818.jpg`, `20250626_110339.jpg`, `20250626_115812.jpg`, `20250626_080825.jpg`, `20250616_141235.jpg`, `853528f0-….jpg`, `20250606_103423.jpg`, `IMG_20250928_130429.jpg` (served twice under a second name), `20250709_090340.jpg`, `1000007935-01610606.jpg`, `1000008103.jpg`, `1000007841.jpg`, `PH_Pic1.jpg`, `1000007979.jpg`.

## Project Videos
Six self-hosted MP4s (CDN returns 403 anonymously; only the poster frames were saved):

| Poster saved | Video URL (not downloadable) | Poster shows |
|---|---|---|
| `sGu9cKnJSZaal3M9lazt_VID-20250709-WA0000.v2.0000000.jpg` (1280×720) | `https://vid.cdn-website.com/13f4aadd/videos/sGu9cKnJSZaal3M9lazt_VID-20250709-WA0000-v.mp4` | Fresh slab with concrete steps, boxing |
| `putVwpzhRmuNdrtx294S_Messenger_creation_AFE049E5-….v2.0000000.jpg` (432×768) | `…/putVwpzhRmuNdrtx294S_Messenger_creation_AFE049E5-DE80-48C6-B7F4-BA295EDA871E-v.mp4` | Cobble/paver path with stamped surround |
| `XZFmw4OSeCDOCaGiAmwj_Messenger_creation_CFD9060A-….v2.0000000.jpg` (432×768) | `…/XZFmw4OSeCDOCaGiAmwj_Messenger_creation_CFD9060A-B1A1-45B1-9571-5AC58CD34196-v.mp4` | Exposed aggregate close-up (white stone) |
| `C1SOSpDRTq7oKiG0wtjK_Messenger_creation_2928F9D7-….v2.0000000.jpg` (432×768) | `…/C1SOSpDRTq7oKiG0wtjK_Messenger_creation_2928F9D7-A014-4D66-BF20-4138164D2823-v.mp4` | Exposed aggregate close-up (dark) |
| `WO0zWdaURLCmnxClR9cV_Messenger_creation_317D21D3-….v2.0000000.jpg` (432×768) | `…/WO0zWdaURLCmnxClR9cV_Messenger_creation_317D21D3-C758-4C48-A83D-4BAF017967D8-v.mp4` | Fresh slab in boxing against a fence |
| `5cWJc2bQq2M9BP1NSGqQ_20250930_084753.v2.0000000.jpg` (1080×1920) | `…/5cWJc2bQq2M9BP1NSGqQ_20250930_084753-v.mp4` | Fresh driveway pour at a new townhouse |

Ask Adam for the original phone videos (they are Messenger/WhatsApp exports) if the new site wants a video section.

## Page 10 — `/landscaping-and-construction-quotes` ("Contact Us")

`<title>` Landscaping & Concrete Quotes | Wellington, NZ
Meta: Porirua Hardscapes offers affordable contracting services across the Wellington, NZ region. Click here to contact us.

# Contact Porirua Hardscapes
## Contact Details
Phone — 027 244 4501
Email: — adam@poriruahardscapes.co.nz
Location — Porirua, Wellington
## Send an Enquiry
Form fields: First Name, Last Name, Phone, Email, Message. Success text: "Thank you for contacting us. We will get back to you as soon as possible." Error text: "Oops, there was an error sending your message. Please try again later."
No map, no hours table, no address.

## Page 11 — `/t/tou-and-privacy`

# Terms and Conditions of Use (TOU) and Privacy Policy
Porirua Hardscapes provides the Terms and Conditions of Use (TOU) for our website below. Questions concerning these TOU may be submitted to adam@poriruahardscapes.co.nz.
Porirua Hardscapes's Privacy Policy is below. Questions concerning this policy may be submitted to adam@poriruahardscapes.co.nz.
(The TOU and Privacy bodies themselves are Duda's generic boilerplate loaded by script; nothing client-specific.)

## Sitemap
`https://www.poriruahardscapes.co.nz/sitemap.xml` lists exactly 10 URLs: `/`, `/concrete-services-wellington`, `/retaining-wall-construction-wellington`, `/landscaping-services-wellington`, `/excavator-hire-services-wellington`, `/construction-demolition-services-wellington`, `/fencing-services-wellington`, `/new-landscaping-projects-wellington`, `/landscaping-and-construction-quotes`, `/hardscaping-services-wellington` (lastmod 2025-10-21 to 2025-11-21). **`/hardscaping-services-wellington` is missing from the README's 301 map** — add it → `/about.html` (that is where the partner logos live in the rebuild).

## Downloaded images (78 files, 50 MB, all under 5 MB)

Full detail in `assets/img/_from-old-site/manifest.tsv`. Three byte-identical duplicates the old site served under two names were dropped (noted in the manifest). Four opaque PNG photos over 5 MB were converted to JPEG q90 (`*_from-png.jpg`, `511996261_…_n.jpg`, `Messenger_creation_EC769C59-….jpg`); nothing was downscaled, all are at the CDN's original pixel size. "What it shows" is from viewing the file; none of the old pages carried suburb names, so suburbs below are unknown unless stated.

### Logos and brand

| File | Source | Size | Shows |
|---|---|---|---|
| `logo_porirua-hardscapes_main.png` | `…/dms3rep/multi/logo_porirua-hardscapes_main.png` | 1859×893 PNG, transparent | Main logo, black PORIRUA / yellow HARDSCAPES bar |
| `opengraph.png` | `…/dms3rep/multi/opengraph.png` | 1200×630 | Logo centred on white (old og:image) |
| `facebook-profile-picture-160.png` | Facebook page plugin | 160×160 | FB profile picture: branded Hino tip truck |
| `68898946c625b846114ec6a0.png` | home + partners page | 591×104 PNG, transparent | **AM Hire** logo |
| `68898a358934ce97f3024673.png` | home + partners | 300×250 PNG | **RGS Reeve Gunite Services** logo (pump truck outline, black on white) |
| `68898946db482feb57499eab.png` | home + partners | 250×103 PNG | **TOA ITM** logo (yellow on black) |
| `688e8ca46f7cfeb0d1068734.webp` | home + partners | 285×83 WEBP | **OTS** logo (red italic) |
| `688e8cdbf2006b51e0f6cd0d.png` | home + partners | 302×51 PNG, transparent | **HireWays Machinery Rentals** logo |
| `Screenshot_2025-10-22_105731.png` | home + partners | 820×470 PNG | **ZWB Zane White Business, Arborist & Tree Care, M: 027 701 2511** (screenshot of a business card, green) |

### Crew, gear and people

| File | Source page(s) | Size | Shows |
|---|---|---|---|
| `Messenger_creation_EC769C59-05A7-48B7-8F3B-BF50D27FA8BA.jpg` | home hero | 1622×1347 | Three crew placing concrete from a line pump beside a garden, truck behind — best "crew at work" shot |
| `6882cd19bfd987112f52beca.webp` | home card | 625×438 | Two crew in hi-vis with a yellow stump grinder, tip truck and orange excavator in front of a new house |
| `557541920_122141627162870312_5799603070288247901_n.jpg` | partners page (also the FB profile pic) | 1514×1478 | Branded **PORIRUA HARDSCAPES** Hino tip truck (plate FJF808) nose-on with branded ute and a second tipper |
| `557774130_122141451296870312_8879009669594912150_n.png` | excavator page | 1536×1696 PNG | Branded Hino tip truck three-quarter view with the logo and phone on the door |
| `557623886_122141112074870312_39215170282799196_n.jpg` | concrete hero / home card | 1200×1600 | Crew screeding a fresh driveway pour in front of new townhouses |
| `20250919_070036.jpg` | gallery | 1920×2560 | Worker setting out mesh on a driveway in front of a garage, tipper behind |
| `GettyImages-1175808366.JPG` | partners hero | 1920×1280 | **STOCK** (Getty) — do not reuse |
| `GettyImages-1454427587.JPG` | fencing page | 1920×1280 | **STOCK** (Getty) hardwood deck — do not reuse |
| `GettyImages-1141043527.JPG` | section background on every page | 1920×1320 | **STOCK** (Getty) white brushed texture — do not reuse |

No photo of Adam on his own exists on the old site. The nearest are the crew shots above (faces small / backs turned).

### Excavation, trucks and site prep

| File | Source page(s) | Size | Shows |
|---|---|---|---|
| `20250724_133030.jpg` | excavator hero, landscaping, gallery | 1920×2487 | Orange Kubota mini excavator digging a back yard by a grey fence (portrait) |
| `IMG_20250729_214044.jpg` | projects hero, gallery | 1920×2377 | Kubota excavator excavating a yard, timber fence and brick house (portrait) |
| `IMG_20250729_214044_from-png.jpg` | excavator page | 1920×1832 | Same scene, landscape crop |
| `1000007935-01610606.jpg` | gallery | 1920×2560 | Orange Hitachi excavator digging beside a blue-grey house, blue sky (portrait) |
| `1000007935_from-png.jpg` | landscaping page | 1920×1688 | Same scene, landscape crop |
| `511996261_122118288308870312_9196653803756898575_n.jpg` | excavator page | 1536×1373 | Hitachi excavator bucket beside the house, landscape |
| `PH_Pic1.jpg` | gallery | 1920×2560 | Hitachi excavator digging a drive beside a house with cars on the street |
| `1000007841.jpg` | gallery | 1920×2560 | Excavator ripping out a flax / stump against a weatherboard house (section clearing) |
| `20250822_115603.jpg` | gallery | 1920×2560 | Kubota mini excavator being loaded onto the tipper on a street of townhouses |
| `20250616_141235.jpg` | gallery | 1200×1600 | Blue excavator on a steep gravel driveway base with a view over the suburb (hillside site prep) |
| `1000007979.jpg` | gallery | 1200×1600 | Long drainage/service trench along a street verge, portaloo and ute |
| `20250715_144528.jpg` | gallery | 1920×2560 | Back section stripped and levelled, fences around |
| `20250715_144531.jpg` | gallery | 1920×2560 | Red excavator on the levelled section next to a block wall |
| `688acd2708dbc35e2921b7f6.webp` | home card | 625×438 | Kubota excavator digging by a red-roofed house and new fence |
| `515402244_122120691320870312_6780183097037475448_n.jpg` | landscaping page | 1536×2048 | Hillside section prepped to bare earth with drainage coil laid, view to the harbour |
| `20250606_103423.jpg` | gallery | 1920×2560 | Foundation slab with rebar starters and boxing, portaloo (commercial-looking) |
| `853528f0-1065-4de3-ad2e-eec4810b66f3.jpg` | gallery | 1920×2560 | Rebar wall starters in a fresh slab, portaloo and townhouses |

### Concrete: driveways, slabs, paths

| File | Source page(s) | Size | Shows |
|---|---|---|---|
| `IMG_20250928_130429.jpg` | home card, gallery | 1920×2560 | Freshly poured driveway / pad at a new black-clad townhouse (also served as `796f95c1-….jpg`) |
| `5cWJc2bQq2M9BP1NSGqQ_20250930_084753.v2.0000000.jpg` | video poster | 1080×1920 | Same townhouse pour, portrait |
| `Messenger_creation_12AF41F8-AE8F-478C-AE46-0F63135CB51A.jpeg` | concrete page, gallery | 1920×1440 | Newly laid dark exposed-aggregate driveway in front of double garages, cones — good finished-driveway shot |
| `20250919_070641.jpg` | concrete page, gallery | 1920×2560 | Driveway boxed with mesh in front of the garage, tipper on the street |
| `20250919_080713.jpg` | gallery | 1920×2560 | Same driveway being poured and floated |
| `561260421_122142762956870312_6755533426927274222_n.jpg` | concrete page, home card | 1536×2048 | Fresh slab with a drain grate, posts, in front of a dark townhouse |
| `20250821_124651.jpg` | concrete page, gallery | 1920×2560 | Finished plain-concrete parking pad between two timber retaining walls |
| `20250626_080825.jpg` | gallery | 1920×2560 | Slab prep: mesh on polythene, drainage coil, timber retaining wall behind (in-progress shot) |
| `20250626_110339.jpg` | gallery | 1920×2560 | Same slab just poured |
| `20250626_115812.jpg` | gallery | 1920×2560 | Same slab being bull-floated |
| `20250626_115818.jpg` | gallery | 1920×2560 | Same slab finished, boxing still on |
| `688acd7b29d04a5d9ce0ea3c.webp` | home card | 625×438 | Finished slab in boxing against a timber fence, landscape |
| `sGu9cKnJSZaal3M9lazt_VID-20250709-WA0000.v2.0000000.jpg` | video poster | 1280×720 | Fresh slab with concrete steps, landscape |
| `WO0zWdaURLCmnxClR9cV_….v2.0000000.jpg` | video poster | 432×768 | Fresh slab in boxing |
| `20250828_104631.jpg` | gallery | 1920×2560 | Finished concrete side path between a white house and a timber fence |
| `20250828_104714.jpg` | gallery | 1920×1571 | Same path, landscape, bark edging |
| `20250916_130049.jpg` | gallery | 1920×2560 | Path prep: mesh and boxing beside a timber retaining wall |
| `20250916_131024.jpg` | gallery | 1920×2560 | Path prep: mesh beside a black house |
| `IMG_20250719_190240.jpg` | gallery | 1920×3113 | Path prep with mesh, boxing and block edging (tall portrait) |
| `Messenger_creation_47DE10B9-77A7-4FED-AB1E-C9B342E10AB9.jpeg` | gallery | 1536×2048 | Path prep on a hillside: mesh in boxing, timber boards foreground |
| `Screenshot_20251004_155224_Messenger.jpg` | gallery | 948×1479 | Fresh path pour between a house and a wall, wet (phone screenshot) |
| `20250818_153217.jpg` | gallery | 1920×2560 | **Exposed aggregate** path (dark with white stone) at a weatherboard house's steps |
| `IMG_20251011_172539.jpg` | landscaping page, gallery | 1200×1600 | **Exposed aggregate** path with a stacked-stone water feature and timber screen |
| `XZFmw4OSeCDOCaGiAmwj_….v2.0000000.jpg` | video poster | 432×768 | Exposed aggregate close-up, white stone |
| `C1SOSpDRTq7oKiG0wtjK_….v2.0000000.jpg` | video poster | 432×768 | Exposed aggregate close-up, dark |
| `IMG_20251009_204651.jpg` | gallery | 320×269 (tiny) | Large-format paved patio with black fence and flax |
| `IMG_20251009_204654.jpg` | gallery | 241×320 (tiny) | Same patio with a white shed — too small to use, ask Adam for originals |
| `putVwpzhRmuNdrtx294S_….v2.0000000.jpg` | video poster | 432×768 | Cobble/paver path with stamped surround |

### Retaining walls

| File | Source page(s) | Size | Shows |
|---|---|---|---|
| `531828062_122131197578870312_6462694277206069858_n.jpg` | retaining + landscaping pages | 1536×2048 | Finished timber retaining wall with a new fence above, paver surround and drain (also served as `…-6b41002e.jpg`) |
| `532243848_122131195832870312_1935948480201991667_n.jpg` | retaining hero, home card | 640×480 (small) | Timber retaining wall under construction, ladder |
| `532422803_122131197290870312_6259447623923245651_n.jpg` | retaining page | 1536×2048 | Timber posts concreted along a cut bank, worker, level on the ground (in-progress) |
| `532884771_122131196726870312_8060723296364156733_n.jpg` | retaining page | 1536×2048 | Close-up of a post and the bank, drainage trench (in-progress) |
| `f4c80598-48a0-4cce-91c4-dfaf806aa5d8.jpg` | fencing page, gallery | 1920×2560 | Timber wall / fence framing going up at a townhouse |

### Decks, fences, landscaping

| File | Source page(s) | Size | Shows |
|---|---|---|---|
| `20250814_150935.jpg` | fencing page, home card, gallery | 1920×2560 | New pine deck with timber privacy fence (also served as `…-933ca435.jpg`) |
| `20250814_152651.jpg` | gallery | 1920×2560 | New timber fence and gate along a gravel side path |
| `20251002_161155.jpg` | fencing hero, gallery | 1920×2560 | Timber planter boxes / garden beds with steps at a white house |
| `20251002_161210.jpg` | gallery | 1920×2560 | Same planters, ute in the drive |
| `20251002_161220.jpg` | gallery | 1920×2560 | Same planters, other angle |

### Demolition

| File | Source page(s) | Size | Shows |
|---|---|---|---|
| `20250709_090340.jpg` | demolition page, gallery | 1920×2560 | Red excavator pulling down a timber structure beside a block wall |
| `517951759_122122729760870312_5048287370008235196_n.jpg` | demolition hero | 1536×2048 | Demolition timber piled against the block wall |
| `518210473_122122729718870312_9110985421222701981_n_1_.jpg` | demolition page | 1536×2048 | Excavator bucket in the debris |
| `688acd26ba7d04239929de8d.webp` | home card | 625×438 | Same demolition, landscape |
| `1000008103.jpg` | demolition page, gallery | 1920×2560 | Tipper loaded with demolition timber in a back yard |

## Proposed mapping to README placeholder paths

Portrait phone photos (1920×2560) will need cropping for landscape slots; the crop suggestion is in the note. Nothing has been copied yet.

**Shared / homepage**

| Placeholder | Proposed file | Note |
|---|---|---|
| `assets/img/og.jpg` | `Messenger_creation_12AF41F8-….jpeg` + logo | Best finished driveway; keep the branded og.jpg if preferred |
| `assets/img/hero-driveway.jpg` | `Messenger_creation_12AF41F8-AE8F-478C-AE46-0F63135CB51A.jpeg` | Finished exposed-agg driveway. Alternative: `20250818_153217.jpg` (exposed agg path, portrait, fits the "portrait-ish" crop) |
| `assets/img/svc-concrete.jpg` | `IMG_20250928_130429.jpg` | Driveway pour at townhouse |
| `assets/img/svc-retaining.jpg` | `531828062_…_n.jpg` | Finished timber wall |
| `assets/img/svc-excavation.jpg` | `20250822_115603.jpg` | Excavator + tipper together |
| `assets/img/svc-decks.jpg` | `20250814_150935.jpg` | Deck and fence |
| `assets/img/svc-landscaping.jpg` | `IMG_20251011_172539.jpg` | Path + water feature |
| `assets/img/svc-demolition.jpg` | `20250709_090340.jpg` | Excavator demolishing |
| `assets/img/adam.jpg` | — | **No photo of Adam on the old site.** Ask him for one. Stop-gap: `557623886_…_n.jpg` (crew screeding) |
| `assets/img/crew-1.jpg` | `Messenger_creation_EC769C59-….jpg` | Crew placing concrete (square crop on the three men) |
| `assets/img/gear-1.jpg` | `557541920_…_n.jpg` | Branded truck + ute, nearly square already |
| `assets/img/proj-1.jpg` | `Messenger_creation_12AF41F8-….jpeg` | Exposed agg driveway (suburb unknown; README says Whitby — confirm) |
| `assets/img/proj-2.jpg` | `531828062_…_n.jpg` | Timber retaining wall (suburb unknown; README says Tawa — confirm) |
| `assets/img/proj-3.jpg` | `IMG_20250928_130429.jpg` | Driveway at townhouse (README says Island Bay — confirm; John MacKay's review is Island Bay) |
| `assets/img/services-crew-on-site-hero.jpg` | `557623886_…_n.jpg` | Crew screeding driveway |
| `assets/img/adam-on-site.jpg` | — | Ask Adam |
| `assets/img/crew-boxing-driveway.jpg` | `20250919_070036.jpg` | Worker with mesh at garage driveway |
| `assets/img/gear-digger-truck.jpg` | `20250822_115603.jpg` or `6882cd19….webp` (small) | Digger on tipper |

**Service pages**

| Placeholder | Proposed file |
|---|---|
| `concrete-driveway-exposed-aggregate-hero.jpg` | `Messenger_creation_12AF41F8-….jpeg` |
| `concrete-exposed-aggregate-whitby.jpg` | `20250818_153217.jpg` (suburb unconfirmed) |
| `concrete-driveway-island-bay.jpg` | `20250919_080713.jpg` (suburb unconfirmed) |
| `concrete-patio-path-porirua.jpg` | `20250828_104714.jpg` (side path, landscape) |
| `retaining-wall-timber-hillside-hero.jpg` | `532422803_…_n.jpg` (posts on bank) |
| `retaining-timber-tawa-1.jpg` | `531828062_…_n.jpg` |
| `retaining-drainage-scoria.jpg` | `20250626_080825.jpg` (drainage coil + mesh) or `532884771_…_n.jpg` (post + trench) |
| `retaining-block-wall-whitby.jpg` | — none on the old site (block walls appear only as demolition backdrops) |
| `excavation-digger-tip-truck-hero.jpg` | `20250822_115603.jpg` |
| `excavation-site-prep-slab.jpg` | `20250606_103423.jpg` |
| `excavation-drainage-trench.jpg` | `1000007979.jpg` |
| `excavation-tip-truck-cartage.jpg` | `1000008103.jpg` (loaded tipper) |
| `deck-timber-privacy-fence-hero.jpg` | `20250814_150935.jpg` |
| `deck-pine-ground-level.jpg` | `20250814_150935.jpg` (only deck photo; crop differently) |
| `fence-boundary-paling.jpg` | `20250814_152651.jpg` |
| `deck-hillside-balustrade.jpg` | — none (the old site used a Getty stock deck here; do not reuse) |
| `landscaping-courtyard-garden-hero.jpg` | `IMG_20251011_172539.jpg` |
| `landscaping-courtyard-paving.jpg` | `IMG_20251009_204651.jpg` is the right subject but only 320 px — ask Adam for the original |
| `landscaping-lawn-garden-beds.jpg` | `20251002_161155.jpg` (planter boxes) |
| `landscaping-section-makeover.jpg` | `515402244_…_n.jpg` (hillside section prepped) |
| `demolition-garage-site-clearance-hero.jpg` | `20250709_090340.jpg` |
| `demolition-garage-porirua.jpg` | `518210473_…_n_1_.jpg` |
| `demolition-slab-breakout.jpg` | `517951759_…_n.jpg` (timber, not slab; nearest available) |
| `demolition-site-cleared.jpg` | `20250715_144528.jpg` |

**Projects** (`assets/img/projects/`) — the old gallery has no job names, so pair these with real jobs from Adam before publishing:

| Placeholder | Proposed file |
|---|---|
| `projects-hero.jpg` | `Messenger_creation_12AF41F8-….jpeg` |
| `exposed-aggregate-driveway-whitby.jpg` | `20250818_153217.jpg` |
| `timber-retaining-wall-tawa.jpg` | `531828062_…_n.jpg` |
| `driveway-replacement-island-bay.jpg` | `IMG_20250928_130429.jpg` |
| `site-prep-churton-park.jpg` | `20250616_141235.jpg` |
| `kwila-deck-plimmerton.jpg` | `20250814_150935.jpg` (pine, not kwila — rename the tile) |
| `courtyard-paving-paremata.jpg` | `IMG_20251009_204651.jpg` (too small) — or `20250821_124651.jpg` (concrete pad) |
| `garage-demolition-titahi-bay.jpg` | `1000008103.jpg` |
| `block-retaining-wall-johnsonville.jpg` | — none; drop or swap for `532422803_…_n.jpg` timber posts |
| `coloured-patio-pauatahanui.jpg` | — none; nearest `20250828_104714.jpg` |
| `section-clearing-pukerua-bay.jpg` | `1000007841.jpg` (stump removal) |
| `boundary-fence-camborne.jpg` | `20250814_152651.jpg` |
| `section-makeover-upper-hutt.jpg` | `515402244_…_n.jpg` |
| `before-driveway-1.jpg` / `after-driveway-1.jpg` | `20250919_070641.jpg` (boxed + mesh) / `20250919_080713.jpg` (poured) — same driveway, same angle; a true before/after pair |
| `before-retaining-1.jpg` / `after-retaining-1.jpg` | `532422803_…_n.jpg` (posts in) / `531828062_…_n.jpg` (finished) — different jobs, so label as "in progress / finished" not before/after. Also `20250626_080825.jpg` → `20250626_115818.jpg` is a clean slab prep → finished pair |

**About**

| Placeholder | Proposed file |
|---|---|
| `about-crew-gear.jpg` | `6882cd19bfd987112f52beca.webp` (crew + gear in one frame, but only 625 px) or `557541920_…_n.jpg` (gear, no people) |
| `adam-portrait.jpg`, `team/adam.jpg`, `team/crew-lead.jpg`, `team/operator.jpg` | — none; ask Adam |
| `partners/partner-1.png` | `68898946c625b846114ec6a0.png` — AM Hire |
| `partners/partner-2.png` | `68898a358934ce97f3024673.png` — RGS Reeve Gunite Services |
| `partners/partner-3.png` | `68898946db482feb57499eab.png` — TOA ITM |
| `partners/partner-4.png` | `688e8ca46f7cfeb0d1068734.webp` — OTS (convert to PNG) |
| `partners/partner-5.png` | `688e8cdbf2006b51e0f6cd0d.png` — HireWays |
| `partners/partner-6.png` | `Screenshot_2025-10-22_105731.png` — ZWB Zane White Business (a screenshot; ask Zane / Adam for a proper logo) |
| `sponsors/sponsor-1..4.png` | — **no sponsors anywhere on the old site.** Remove the section unless Adam names clubs. |

**Contact**

| Placeholder | Proposed file |
|---|---|
| `contact-site-visit.jpg` | `532422803_…_n.jpg` (worker on a site with a level) or `20250919_070036.jpg` |
| `service-area-map.jpg` | — use a Google Maps iframe as the README suggests |

## Still needed from Adam / Facebook (logged in)

- A photo of Adam and any crew names / head-shots.
- Suburb for each gallery photo (none on the old site).
- The six project videos (originals) if wanted.
- A proper ZWB / Zane White Business logo file.
- Sponsorships, if any.
- Anything from the Facebook page (668 followers): recent job posts, reviews, cover photo — none of it is reachable without a login.
