import numpy as np, wave, json, sys
wav, edl_path, out_path = sys.argv[1:4]
w=wave.open(wav); sr=w.getframerate(); x=np.frombuffer(w.readframes(w.getnframes()),dtype=np.int16).astype(np.float32)/32768
STEP=0.02; THR=-30
def level(t):
    seg=x[int(t*sr):int((t+STEP)*sr)]
    return 20*np.log10(np.sqrt((seg**2).mean())+1e-9) if len(seg) else -99
cfg=json.load(open(edl_path)); EDL=cfg["EDL"]; new=[]
for i,(a,b) in enumerate(EDL):
    # end: last loud frame in [b-0.5, b+0.6]
    ts=np.arange(b-0.5,b+0.6,STEP); loud=[t for t in ts if level(t)>THR]
    nb = (max(loud)+STEP+0.10) if loud else b
    # start: first loud frame in [a-0.5, a+0.6]
    ts=np.arange(max(0,a-0.5),a+0.6,STEP); loud=[t for t in ts if level(t)>THR]
    na = (min(loud)-0.12) if loud else a
    if i>0: na=max(na,new[-1][1]+0.02)
    print(f"seg{i}: start {a:.2f}->{na:.2f}  end {b:.2f}->{nb:.2f}   {'<-- changed' if abs(na-a)>0.05 or abs(nb-b)>0.05 else ''}")
    new.append((round(na,2),round(nb,2)))
cfg["EDL"]=new; json.dump(cfg,open(out_path,"w")); print(new)
