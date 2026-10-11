import json, subprocess, sys, numpy as np
SR=48000
def load(f):
    raw=subprocess.run(["ffmpeg","-v","error","-i",f,"-ac","2","-ar",str(SR),"-f","f32le","-"],capture_output=True).stdout
    return np.frombuffer(raw,dtype=np.float32).reshape(-1,2).mean(1)
orig, pauses = sys.argv[1], sys.argv[2]
o=load(orig); N=2048; F=len(o)//N
spec=lambda x: np.abs(np.fft.rfft(x[:F*N].reshape(F,N)*np.hanning(N),axis=1))**2
So=spec(o); fr=np.fft.rfftfreq(N,1/SR); e=So.sum(1); loud=e>=np.quantile(e,0.70)
pm=np.zeros(F,bool)
for a,b in json.load(open(pauses)): pm[int(a*SR/N):int(b*SR/N)]=True
print(f"{'candidate':24s} voice 250-4k  4-8k   8-14k | pauses all  birds 2.5-8k  whine")
for f in sys.argv[3:]:
    c=load(f); c=np.pad(c,(0,max(0,F*N-len(c))))[:F*N]; Sc=spec(c)
    d=lambda m,a,b: 10*np.log10(Sc[m][:,(fr>=a)&(fr<b)].sum()/So[m][:,(fr>=a)&(fr<b)].sum())
    print(f"{f.split('/')[-1][:24]:24s} {d(loud,250,4000):+9.2f} {d(loud,4000,8000):+6.2f} {d(loud,8000,14000):+6.2f} | {d(pm,100,14000):+9.1f} {d(pm,2500,8000):+11.1f} {d(pm,1050,1250):+6.1f}")
