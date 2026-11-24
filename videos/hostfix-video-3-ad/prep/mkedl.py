"""Jump-cut EDL: remove every pause between phrases. Pause candidates come from ASR word starts (gap > 0.45s);
the exact speech end/onset around each pause is found from short-window energy (voice ~ -10..-20 dB, outdoor
ambience ~ -25..-35 dB). Boundaries snap outward to 1/30s frames so picture and sound stay locked."""
import json, subprocess, numpy as np
raw = subprocess.run(["ffmpeg","-v","error","-i","src/v3.mov","-ac","1","-ar","16000","-f","f32le","-"], capture_output=True).stdout
x = np.frombuffer(raw, np.float32); HOP, WIN = 160, 480
db = np.array([20*np.log10(np.sqrt(np.mean(x[i:i+WIN]**2))+1e-9) for i in range(0, len(x)-WIN, HOP)])
def E(t): return db[int(t*100)]
rawh = subprocess.run(["ffmpeg","-v","error","-i","src/v3.mov","-af","highpass=f=3500,highpass=f=3500","-ac","1","-ar","16000","-f","f32le","-"], capture_output=True).stdout
xh = np.frombuffer(rawh, np.float32)
hf = np.array([20*np.log10(np.sqrt(np.mean(xh[i:i+320]**2))+1e-9) for i in range(0, len(xh)-320, HOP)])
def HF(t): return hf[int(t*100)]
def tail(t):   # keep fricative / plosive release tails ("s", "t") until the hiss is gone
    lim = t + 0.25
    while t < lim and max(HF(t + k * 0.01) for k in range(16)) > -50: t += 0.01
    return t
def head(t):   # include a leading "s"/"f" hiss
    lim = t - 0.2
    while t > lim and HF(t - 0.02) > -50: t -= 0.01
    return t
W = json.load(open("words.json"))
A, B, F = 0.0, 34.40, 30
TH, PRE, POST, GAP = -24, 0.06, 0.10, 0.50
THE = -29   # speech-end threshold (soft word endings like "five")
segs, s0 = [], None
# first onset
t = A
while E(t) < TH: t += 0.01
s0 = t - PRE
for i in range(len(W) - 1):
    a, b = W[i]["start"], W[i + 1]["start"]
    if b - a < GAP or a < A: continue
    # speech end: first point after the word where energy stays under TH for 80 ms
    t = a + 0.10
    while t < b and not (all(E(t + k*0.01) < THE for k in range(10)) or all(E(t + k*0.01) < TH for k in range(25))): t += 0.01
    t_end = t
    # next onset: start of the loud run that contains the next word (breaths before it are left out)
    t = b + 0.10
    if E(t) < TH:
        while E(t) < TH and t < b + 0.4: t += 0.01
    while E(t - 0.01) >= TH and t > t_end + 0.05: t -= 0.01
    t = min(t, b)                          # soft onsets: never start after the ASR word start
    if t - t_end < 0.20: continue          # pause too short to bother
    wd = W[i]["text"].rstrip(".,?!").lower()
    fric = wd[-1:] in set("stxzfkpc") or wd.endswith("ce")   # only hissy / plosive endings get the HF tail
    segs.append([s0, (tail(t_end) if fric else t_end) + POST]); s0 = head(t) - PRE
# last word end
t = B - 0.02
while E(t) < TH: t -= 0.01
segs.append([s0, tail(t + 0.03) + POST])
edl = []
for a, b in segs:
    fa, fb = int(np.floor(a * F)), int(np.ceil(b * F))
    if edl and fa <= edl[-1][1]: edl[-1][1] = fb
    else: edl.append([fa, fb])
# drop the first "How many hours a week..." take (src ~6.0-10.4); the second take is kept
edl = [p for p in edl if not (p[0] >= 5.7 * F and p[1] <= 11.2 * F)]
m = [edl[0]]
for a, b in edl[1:]:
    if a - m[-1][1] < 6: m[-1][1] = b
    else: m.append([a, b])
edl = m
json.dump({"EDL_FRAMES": edl}, open("edl.json", "w"))
for a, b in edl: print(f"{a/F:6.2f}-{b/F:6.2f} ({(b-a)/F:.2f})")
print("total", round(sum(b-a for a, b in edl)/F, 2), "s (was 32.2), cuts:", len(edl) - 1)
