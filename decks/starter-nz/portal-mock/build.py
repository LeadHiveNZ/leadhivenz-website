import sys; sys.path.insert(0,'.')
from snips import *
won_chip='<span class="chip chip-good">Job won · $3,200</span>'
won_chip2='<span class="chip chip-good">Job won · $420</span>'
# ---------- HOME ----------
home = brandbar() + '<div class="px">' + f'''
<div style="display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:12px;margin-top:24px">
 <div><h1>Kia ora Mike</h1><div class="sub">Mike's Plumbing · Auckland</div></div>
 <span class="msel">Sep 2026 <svg class="ic" style="width:16px;height:16px" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg></span>
</div>
<div class="hero" style="margin-top:20px">
 <div class="ey">September 2026</div>
 <div style="display:flex;align-items:baseline;margin-top:8px"><span class="big">22</span><span class="bl">leads</span></div>
 <div class="plan">Starter plan · 15 to 25 leads a month</div>
 <div class="meter"><div class="fill" style="width:88%"></div><div class="tick" style="left:60%"></div></div>
 <div class="mlab"><span style="position:absolute;left:0">0</span><span style="position:absolute;left:60%;transform:translateX(-50%)">15 = target</span><span style="position:absolute;right:0">25</span></div>
 <div class="chips"><span class="chip chip-good"><i></i>On target</span><span class="chip chip-gold">{I_STAR}$5,750 in jobs you've tagged won</span></div>
</div>
<div class="grid2">
 <div class="card kpi"><div class="l">Phone calls</div><div class="v">18</div><div class="f dn">{I_DN}6 vs Aug</div></div>
 <div class="card kpi"><div class="l">Web enquiries</div><div class="v">4</div><div class="f up">{I_UP}1 vs Aug</div></div>
 <div class="card kpi"><div class="l">Answered</div><div class="v">14<small>78%</small></div><div class="f dn">{I_DN}1 pts vs Aug</div></div>
 <div class="card kpi"><div class="l">Missed calls</div><div class="v">4<small>22%</small></div><div class="f up">{I_DN}1 vs Aug</div></div>
 <div class="card kpi"><div class="l">Average call</div><div class="v">3m 21s</div></div>
 <div class="card kpi"><div class="l">Jobs won</div><div class="v">4</div><div class="f mu">$5,750 tagged</div></div>
</div>
<div class="sh"><h2>Note from Joe</h2><span class="link">Full report</span></div>
<div class="card note"><div class="who"><div class="j">J</div><div><div class="d" style="font-weight:700">Joe · LeadHive</div><div style="font-size:13px;color:var(--ink-3)">Sep 2026 · published 2 Oct 2026</div></div></div>
<p>A steady month. 22 leads, inside the plan. The one thing to work on is answering: 4 calls went to voicemail or rang out, all between 12 and 2pm. The jobs you tagged as won this month came to $5,750, from a $1,500 plan.</p></div>
<div class="sh"><h2>Leads by month</h2><span style="font-size:14px;color:var(--ink-3)">calls + web enquiries</span></div>
''' + chart([('Jun',18,''),('Jul',22,''),('Aug',27,''),('Sep',22,'blue')],30,10) + '''
<div class="sh"><h2>Sep 2026 by week</h2></div>
''' + chart([('Wk 1',8,'gold'),('Wk 2',7,''),('Wk 3',1,''),('Wk 4',6,''),('Wk 5',0,'')],10,5) + '''
<div class="sh"><h2>Latest leads</h2><span class="link">See all 22</span></div>
<div class="card" style="overflow:hidden">''' + lead_row('call','021 387 2666','leaking tap repair','4:04pm','4:19',won_chip2,True) + lead_row('call','022 546 9371','Good call. Booked same day.','5:18pm','1:56',won_chip,True) + lead_row('call','021 741 5125','leaking tap repair','9:14am','0:59','',True) + '''</div>
<p class="foot">Numbers come from your call tracking line and website form. Spam you tag is left out.</p>
</div>''' + tabs('home')
open('home.html','w').write(page(home))

# ---------- LEADS ----------
sel='<span class="msel dark">Sep 2026 <svg class="ic" style="width:16px;height:16px" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg></span>'
leads = topbar('Leads',"Mike's Plumbing",False,sel) + '''
<div class="filters"><span class="chip on">All 22</span><span class="chip">To tag 14</span><span class="chip">Missed 4</span><span class="chip">Web forms 4</span><span class="chip">Recorded 14</span></div>
<div class="px">
<div class="tagcta"><div><b>Tag what happened with each lead</b><small>Won, quoted, not a lead or spam. It takes a second and it shows your real return.</small></div><span class="btn btn-navy sm">Start</span></div>
<div class="card" style="overflow:hidden">
<div class="day">MON, 28 SEP</div>''' + lead_row('call','021 387 2666','leaking tap repair','4:04pm','4:19',won_chip2,True) + '''
<div class="day">SUN, 27 SEP</div>''' + lead_row('call','022 546 9371','Good call. Booked same day.','5:18pm','1:56',won_chip,True) + lead_row('missed','021 278 6602','Missed call · burst pipe plumber','12:27pm','') + '''
<div class="day">SAT, 26 SEP</div>''' + lead_row('call','021 741 5125','leaking tap repair','9:14am','0:59','',True) + '''
<div class="day">THU, 24 SEP</div>''' + lead_row('call','022 594 7461','burst pipe plumber','6:41pm','4:07','<span class="chip chip-blue">Quoted</span>',True) + '''
<div class="day">WED, 23 SEP</div>''' + lead_row('call','022 367 4663','burst pipe plumber','8:06am','3:13','',True) + '''
<div class="day">SAT, 19 SEP</div>''' + lead_row('call','022 354 2786','gas hob disconnect','2:00pm','4:00','',True) + '''
<div class="day">SUN, 13 SEP</div>''' + lead_row('web','Sione L.','Henderson · Need a dishwasher plumbed in this week','11:00am','Web form') + '''
</div>
<p class="foot">Tap a lead to hear the call, see Joe's note or tag the outcome.</p>
</div>''' + tabs('leads')
open('leads.html','w').write(page(leads))

# ---------- LEAD DETAIL ----------
detail = topbar('Phone call','27 Sep 2026, 5:18pm',True) + f'''
<div class="p5" style="display:grid;gap:16px">
<div class="card p5">
 <div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:start"><div><div class="sub">Caller</div><div class="caller">022 546 9371</div></div><span class="chip chip-good"><i></i>Answered</span></div>
 <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:20px"><span class="btn btn-navy">{I_PHONE}Call back</span><span class="btn btn-ghost">Text</span></div>
 <div class="fact"><div><div class="k">Duration</div><div class="v">1m 56s</div></div><div><div class="k">Source</div><div class="v">Google Ads</div></div><div><div class="k">Search</div><div class="v">burst pipe plumber</div></div><div><div class="k">Caller location</div><div class="v">Takapuna</div></div></div>
</div>
<div class="card p5">
 <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:16px"><div><div class="d" style="font-size:20px;font-weight:700">Call recording</div><div class="sub">Recorded on your tracking line</div></div><span class="link">Download</span></div>
 <div class="audio"><span class="pb">{I_PLAY}</span><div class="trk"><i></i><b></b></div><span>0:44 / 1:56</span></div>
</div>
<div class="card note"><div class="who"><div class="j">J</div><div><div class="d" style="font-weight:700">Joe · LeadHive</div></div></div><p>Good call. Booked same day.</p></div>
<h2 class="d" style="font-size:20px;font-weight:700;padding-top:8px">What happened with this lead?</h2>
<div class="card" style="padding:20px">
 <div class="segs">
  <span class="seg"><svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>New</span>
  <span class="seg"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Quoted</span>
  <span class="seg on"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/></svg>Won</span>
  <span class="seg"><svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg>Not a lead</span>
  <span class="seg"><svg class="ic" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>Spam</span>
 </div>
 <label class="label">Job value (ex GST, roughly)</label><div class="field">$ 3200</div>
 <label class="label">Your note (optional)</label><div class="field ph">e.g. Booked for Tuesday, quoted $420</div>
 <span class="btn btn-gold" style="width:100%;margin-top:16px">Save</span>
 <p class="sub" style="margin-top:16px;font-size:15px">Tagging takes a second and it's how we work out your real return. Joe also uses it to cut the searches that bring in the duds.</p>
</div>
</div>''' + tabs('leads')
open('detail.html','w').write(page(detail))

# ---------- REPORT ----------
report = topbar('September 2026 report',"Mike's Plumbing",True) + f'''
<div class="p5">
<div class="hero">
 <div class="ey">September 2026</div>
 <div style="display:flex;align-items:baseline;margin-top:8px"><span class="big">22</span><span class="bl">leads</span></div>
 <div class="plan">Starter plan · target 15 to 25</div>
 <div class="chips"><span class="chip chip-good"><i></i>On target</span><span class="chip chip-navy">-5 vs Aug 2026</span></div>
</div>
<div class="card" style="margin-top:16px;padding:8px 20px">
 <div class="rowk"><span>Phone calls</span><b>18</b></div>
 <div class="rowk"><span>Answered</span><b>14<small>(78%)</small></b></div>
 <div class="rowk"><span>Missed or voicemail</span><b>4<small>(22%)</small></b></div>
 <div class="rowk"><span>Web enquiries</span><b>4</b></div>
 <div class="rowk"><span>Average call length</span><b>3m 21s</b></div>
 <div class="rowk"><span>Jobs tagged won</span><b>4 · $5,750</b></div>
 <div class="rowk"><span>Quotes out</span><b>3</b></div>
</div>
<div class="goodbox"><b>$5,750 in won jobs from a $1,500 plan</b><p>That's 3.8x, counting only the 4 jobs you tagged. Quotes still out aren't included.</p></div>
<div class="sh"><h2>Leads by week</h2></div>
''' + chart([('Wk 1',8,'gold'),('Wk 2',7,''),('Wk 3',1,''),('Wk 4',6,''),('Wk 5',0,'')],10,5) + f'''
<div class="sh"><h2>Joe's summary</h2></div>
<div class="card note"><div class="who"><div class="j">J</div><div><div class="d" style="font-weight:700">Joe · LeadHive</div><div style="font-size:13px;color:var(--ink-3)">Published 2 Oct 2026</div></div></div>
<p>A steady month. 22 leads, inside the plan. The one thing to work on is answering: 4 calls went to voicemail or rang out, all between 12 and 2pm. The jobs you tagged as won this month came to $5,750, from a $1,500 plan.</p></div>
<div class="sh"><h2>What I'm changing</h2></div>
<div class="card" style="padding:8px 20px">
 <div class="pt"><span class="n">1</span><div><b>Missed call follow-up</b><p>22% of calls weren't answered. I've shifted the ad schedule so fewer calls land over lunch, but a quick call-back on the missed ones is the easiest money in this report.</p></div></div>
 <div class="pt"><span class="n">2</span><div><b>Scaling what's working</b><p>'Emergency plumber Auckland' and 'blocked drain' are still the winners. More budget there, less on the broad 'plumber near me' term.</p></div></div>
 <div class="pt"><span class="n">3</span><div><b>Keyword refinement</b><p>Search term review done weekly. 9 new negatives this month.</p></div></div>
</div>
<span class="btn btn-ghost" style="width:100%;margin-top:24px">{I_DOWN}Download PDF report</span>
<span class="btn btn-navy" style="width:100%;margin-top:12px">See every lead from Sep 2026</span>
<p class="foot" style="margin-top:20px">Questions? Text Joe, he reads every reply.</p>
</div>''' + tabs('reports')
open('report.html','w').write(page(report))
print('built')
