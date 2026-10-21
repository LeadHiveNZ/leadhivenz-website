HEX='<svg width="34" height="34" viewBox="0 0 100 100"><path fill="oklch(0.77 0.16 72)" d="M50 4 90 27v46L50 96 10 73V27z"/><path fill="oklch(0.2 0.04 262)" d="M50 26 71 38v24L50 74 29 62V38z"/><path fill="oklch(0.77 0.16 72)" d="M50 40 59 45v10L50 60 41 55V45z"/></svg>'
I_HOME='<svg class="ic" viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>'
I_LIST='<svg class="ic" viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>'
I_BAR='<svg class="ic" viewBox="0 0 24 24"><path d="M3 3v18h18M18 17V9M13 17V5M8 17v-3"/></svg>'
I_USER='<svg class="ic" viewBox="0 0 24 24"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
I_PHONE='<svg class="ic" viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7A2 2 0 0 1 22 16.9z"/></svg>'
I_MISSED='<svg class="ic" viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7A2 2 0 0 1 22 16.9zM23 1l-6 6M17 1l6 6"/></svg>'
I_FILE='<svg class="ic" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>'
I_PLAY='<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 4l14 8-14 8z"/></svg>'
I_CHEV='<svg class="ic chev" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>'
I_BACK='<svg class="ic" viewBox="0 0 24 24" style="width:24px;height:24px"><path d="m15 18-6-6 6-6"/></svg>'
I_STAR='<svg viewBox="0 0 24 24" width="16" height="16" fill="oklch(0.77 0.16 72)"><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/></svg>'
I_UP='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 19V5M5 12l7-7 7 7"/></svg>'
I_DN='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>'
I_DOWN='<svg class="ic" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>'
def tabs(on, badge=3):
    t=lambda k,i,l: f'<a class="tab {"on" if on==k else ""}">{i}{("<span class=bd>%d</span>"%badge) if (k=="leads" and badge) else ""}{l}</a>'
    return '<nav class="tabs">'+t('home',I_HOME,'Home')+t('leads',I_LIST,'Leads')+t('reports',I_BAR,'Reports')+t('account',I_USER,'Account')+'</nav>'
def brandbar(initials='MP'):
    return f'<header class="bar"><span class="wm">{HEX}<span>Lead<b>Hive</b></span></span><span class="avatar">{initials}</span></header>'
def topbar(title, sub=None, back=False, right=''):
    return f'<header class="top"><div><div class="tt">{I_BACK if back else ""}{title}</div>{f"<div class=ts style=margin-left:{34 if back else 0}px>{sub}</div>" if sub else ""}</div>{right}</header>'
def lead_row(kind, title, second, time, dur, chip='', rec=False):
    tile={'call':('t-blue',I_PHONE),'missed':('t-bad',I_MISSED),'web':('t-gold',I_FILE)}[kind]
    return f'<div class="row"><div class="tile {tile[0]}">{tile[1]}</div><div style="min-width:0"><div class="ti">{title}</div><div class="se">{chip}<span style="overflow:hidden;text-overflow:ellipsis">{second}</span></div></div><div class="rt"><div class="t">{time}</div><div class="dur">{dur}</div></div>{("<span class=play>"+I_PLAY+"</span>") if rec else I_CHEV}</div>'
def chart(data, top, step):
    ticks=''.join(f'<div class="gl" style="bottom:{t/top*100:.1f}%"><span>{t}</span></div>' for t in range(step, top+1, step))
    cols=''.join(f'<div class="col"><b>{v}</b><div class="{tone}" style="height:{v/top*100:.1f}%"></div></div>' for l,v,tone in data)
    labs=''.join(f'<span>{l}</span>' for l,v,tone in data)
    return f'<div class="card chart"><div class="area">{ticks}<div class="gl" style="bottom:0"></div><div class="cols">{cols}</div></div><div class="labs">{labs}</div></div>'
def page(body, css_extra=''):
    return f'<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="base.css"><style>{css_extra}</style></head><body><div class="app">{body}</div></body></html>'
