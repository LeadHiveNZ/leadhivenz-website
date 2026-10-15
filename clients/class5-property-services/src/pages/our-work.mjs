import { site } from '../data/site.mjs';
import { icon } from '../partials/icons.mjs';
import { img } from '../partials/util.mjs';
import { pageHero, sectionHead, beforeAfter } from '../partials/components.mjs';
import { graph, crumbsSchema } from '../partials/schema.mjs';

const items = [
  ['new-fence', 'New paling fence', 'Built along a back boundary with posts concreted in and painted.', 'A newly built timber paling fence with painted posts along a back lawn', 'wide', '/images/new-fence-build.jpg'],
  ['timber-gate', 'Timber side gate', 'Braced side gate built to fit the gap, with new hinges and a bolt latch.', 'A new braced timber side gate fitted between a brick wall and an old paling fence', 'tall', '/images/timber-gate.jpg'],
  ['fence-after', 'Fence restoration: after', 'Washed back and stained, letterbox included.', 'A timber fence freshly stained a red-brown colour beside a driveway', 'wide', '/images/fence-after.jpg'],
  ['fence-before', 'Fence restoration: before', 'Grey, weathered and tired, but sound.', 'A grey, weathered timber paling fence along a footpath before restoration', 'wide', '/images/fence-before.jpg'],
];

export function ourWork() {
  const path = '/our-work/';
  const crumbs = [['Home', '/'], ['Our work', path]];
  const body = `${pageHero({ crumbs, eb: 'Our work', h1: 'Our work around Christchurch', lede: 'Real jobs, photographed on the day. Fences, gates and timber work by Class 5 Property Services.', chips: false })}

<section class="sec sec-white" aria-labelledby="ba-h">
  <div class="wrap">
    ${sectionHead({ eb: 'Before & after', h2: 'Fence restoration, Christchurch', id: 'ba-h', split: true, lede: 'A long run of grey, weathered palings, washed back, prepared and stained. Drag the handle to compare.' })}
    ${beforeAfter({ lazy: false })}
  </div>
</section>

<section class="sec sec-off" aria-labelledby="gallery-h">
  <div class="wrap">
    ${sectionHead({ eb: 'Gallery', h2: 'Recent jobs', id: 'gallery-h', split: true, lede: 'Tap a photo to see it full size.' })}
    <ul class="gallery">
${items.map(([base, t, d, alt, shape, full]) => `      <li class="g-item g-${shape} reveal"><a href="${full}" data-lightbox aria-label="View larger photo: ${t}">${img(base, { alt, sizes: shape === 'tall' ? '(min-width: 1024px) 33vw, 100vw' : '(min-width: 1024px) 66vw, 100vw' })}</a><div class="g-cap"><h3>${t}</h3><p>${d}</p></div></li>`).join('\n')}
    </ul>
  </div>
</section>

<dialog class="lightbox" id="lightbox" aria-label="Photo viewer">
  <button class="lb-close" type="button" aria-label="Close photo">${icon('close')}</button>
  <div class="lb-body"></div>
</dialog>`;
  return {
    path,
    title: 'Our Work | Fences, Gates & Repairs | Class 5 Christchurch',
    desc: 'Recent work by Class 5 Property Services in Christchurch: fence restoration before and after, new paling fences and timber side gates.',
    body,
    jsonld: graph(crumbsSchema(crumbs)),
  };
}
