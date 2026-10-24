(function(){
  // Multi-page: point cross-page anchors at this page when the target is here, and mark the active nav link
  var here=(location.pathname.split('/').pop()||'index.html');
  Array.prototype.forEach.call(document.querySelectorAll('a[href]'),function(a){
    var h=a.getAttribute('href'), i=h.indexOf('#');
    if(i>0&&h.slice(0,i)===here&&document.getElementById(h.slice(i+1)))a.setAttribute('href',h.slice(i));
    else if(i>0&&document.getElementById(h.slice(i+1))&&h.slice(0,i)==='index.html')a.setAttribute('href',h.slice(i));
    if(a.closest('.nav, .mnav')&&h.split('#')[0]===here)a.classList.add('active');
  });
  var $=function(s,c){return (c||document).querySelector(s)}, $$=function(s,c){return Array.prototype.slice.call((c||document).querySelectorAll(s))};

  // Mobile menu
  var burger=$('.burger'), mnav=$('#mnav');
  if(burger&&mnav)burger.addEventListener('click',function(){var o=mnav.classList.toggle('open');burger.setAttribute('aria-expanded',o)});
  $$('#mnav a').forEach(function(a){a.addEventListener('click',function(){mnav.classList.remove('open');burger.setAttribute('aria-expanded',false)})});

  // Dates: default tonight -> tomorrow
  function iso(d){return new Date(d.getTime()-d.getTimezoneOffset()*6e4).toISOString().slice(0,10)}
  var t=new Date(), tm=new Date(Date.now()+864e5), ci=$('#ci'), co=$('#co');
  if(ci&&co){ci.value=iso(t); co.value=iso(tm); ci.min=iso(t); co.min=iso(tm);
  ci.addEventListener('change',function(){var d=new Date(ci.value);d.setDate(d.getDate()+1);co.min=iso(d);if(co.value<=ci.value)co.value=iso(d)});}
  $$('input[type=date]').forEach(function(i){if(!i.min)i.min=iso(t)});

  // Book this room -> preselect
  var rt=$('#rt'), card=$('.bk-card');
  if(rt&&card)$$('[data-room]').forEach(function(b){b.addEventListener('click',function(e){
    e.preventDefault(); rt.value=b.getAttribute('data-room');
    $('#book').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
    card.classList.remove('flash'); void card.offsetWidth; card.classList.add('flash');
    setTimeout(function(){rt.focus({preventScroll:true})},700);
  })});

  // Modal
  var modal=$('#modal'), lastFocus;
  function openModal(title,text,sum){
    lastFocus=document.activeElement;
    $('#md-h').textContent=title; $('#md-p').textContent=text;
    var s=$('#md-sum'); s.innerHTML=sum||''; s.classList.toggle('show',!!sum);
    modal.classList.add('open'); $('.x',modal).focus();
  }
  function closeModal(){modal.classList.remove('open'); if(lastFocus)lastFocus.focus()}
  modal.addEventListener('click',function(e){if(e.target===modal||e.target.closest('.x')||e.target.closest('[data-close]'))closeModal()});
  function fmt(v){if(!v)return '–';var d=new Date(v+'T00:00');return d.toLocaleDateString('en-NZ',{weekday:'short',day:'numeric',month:'short'})}
  if($('#bkForm'))$('#bkForm').addEventListener('submit',function(e){
    e.preventDefault();
    var room=rt.options[rt.selectedIndex].text;
    var n=Math.max(1,Math.round((new Date(co.value)-new Date(ci.value))/864e5)||1);
    openModal('Website preview','In the live site this connects to the motel’s booking engine (or Booking.com).',
      '<b>Your search</b><br>'+fmt(ci.value)+' → '+fmt(co.value)+' · '+n+' night'+(n>1?'s':'')+'<br>'+$('#gu').value+' · '+room.replace(/</g,'&lt;'));
  });
  $$('form[data-preview]').forEach(function(f){f.addEventListener('submit',function(e){
    e.preventDefault();
    var car=f.getAttribute('data-preview')==='car';
    openModal(car?'Quote request (preview)':'Enquiry (preview)',
      car?'In the live site this goes straight to the 747 Car Hire team, who reply with a quote within the hour during business hours.'
         :'In the live site this enquiry is emailed straight to 747motel@gmail.com.');
  })});

  // Lightbox
  var lb=$('#lb'), lbImg=lb&&$('img',lb), lbCap=lb&&$('.lb-cap',lb), items=$$('#gallery-grid button'), idx=0;
  function show(i){idx=(i+items.length)%items.length;var im=$('img',items[idx]);lbImg.src=im.src;lbImg.alt=im.alt;lbCap.textContent=items[idx].getAttribute('data-cap')+'  ·  '+(idx+1)+' / '+items.length}
  items.forEach(function(b,i){b.addEventListener('click',function(){lastFocus=b;show(i);lb.classList.add('open');$('.lb-x',lb).focus()})});
  function closeLb(){lb.classList.remove('open');if(lastFocus)lastFocus.focus()}
  if(lb)lb.addEventListener('click',function(e){
    if(e.target.closest('.lb-x')||e.target===lb)closeLb();
    else if(e.target.closest('.lb-prev'))show(idx-1);
    else if(e.target.closest('.lb-next'))show(idx+1);
  });
  document.addEventListener('keydown',function(e){
    if(lb&&lb.classList.contains('open')){if(e.key==='Escape')closeLb();if(e.key==='ArrowLeft')show(idx-1);if(e.key==='ArrowRight')show(idx+1)}
    else if(modal.classList.contains('open')&&e.key==='Escape')closeModal();
  });

  // Mobile action bar appears once the hero is passed
  var mbar=$('.mbar');
  function onScroll(){if(mbar)mbar.classList.toggle('show',window.scrollY>(document.querySelector('.hero')?window.innerHeight*.6:200))}
  window.addEventListener('scroll',onScroll,{passive:true}); onScroll();

  // Reveal on scroll
  var rv=$$('.rv'), bars=$$('.bar i');
  function fillBars(){bars.forEach(function(b){b.style.width=b.getAttribute('data-w')+'%'})}
  if(!('IntersectionObserver' in window)||matchMedia('(prefers-reduced-motion: reduce)').matches){
    rv.forEach(function(el){el.classList.add('in')}); fillBars();
  } else {
    var io=new IntersectionObserver(function(es){es.forEach(function(en){if(en.isIntersecting){en.target.classList.add('in');if(en.target.classList.contains('score-card'))fillBars();io.unobserve(en.target)}})},{rootMargin:'0px 0px -8% 0px',threshold:.08});
    rv.forEach(function(el){io.observe(el)});
  }
})();
