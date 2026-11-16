import json, subprocess, numpy as np
raw = subprocess.run(["ffmpeg","-v","error","-i","src.mov","-ac","1","-ar","16000","-f","f32le","-"], capture_output=True).stdout
x = np.frombuffer(raw, np.float32); w = 160
db = np.array([20*np.log10(np.sqrt(np.mean(x[i:i+w]**2))+1e-9) for i in range(0, len(x)-w, w)])
# kept takes (source seconds, inside one clip each); clip 2's first take (4.1-8.0) is a false start
KEEP = [(0.00, 4.10), (9.40, 16.00), (16.03, 22.55), (22.58, 28.93), (28.95, 33.54), (33.56, 38.42), (38.44, 43.40)]
TH, MINGAP, PAD = -38, 0.26, 0.06
edl = []
for a, b in KEEP:
    i0, i1 = int(a/0.01), int(b/0.01)
    loud = db[i0:i1] > TH
    idx = np.nonzero(loud)[0]
    s, e = idx[0], idx[-1]
    runs, start = [], s
    k = s
    while k <= e:
        if not loud[k]:
            j = k
            while j <= e and not loud[j]: j += 1
            if (j - k) * 0.01 >= MINGAP:
                runs.append((start, k)); start = j
            k = j
        else:
            k += 1
    runs.append((start, e + 1))
    for r0, r1 in runs:
        edl.append([round(max(a, (i0 + r0)*0.01 - PAD), 2), round(min(b, (i0 + r1)*0.01 + PAD + 0.04), 2)])
json.dump({"EDL": edl, "D": 0.03}, open("edl.json", "w"))
for p in edl: print(p, round(p[1]-p[0], 2))
print("total", round(sum(b-a for a, b in edl), 2))
