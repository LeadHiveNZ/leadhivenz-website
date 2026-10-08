import subprocess, json, sys
proj, src, extra = sys.argv[1], sys.argv[2], (sys.argv[3] if len(sys.argv) > 3 else "")
cfg = json.load(open(f"{proj}/edl-in.json")); EDL, D = cfg["EDL"], cfg["D"]
parts = [f"[0:a]{extra}atrim=start={a}:end={b},asetpts=PTS-STARTPTS[s{i}];" for i, (a, b) in enumerate(EDL)]
chain = ""; prev = "s0"
for i in range(1, len(EDL)):
    chain += f"[{prev}][s{i}]acrossfade=d={D}:c1=tri:c2=tri[x{i}];"; prev = f"x{i}"
fc = "".join(parts) + chain + f"[{prev}]loudnorm=I=-16:TP=-1.5:LRA=11[mix]"
subprocess.run(["ffmpeg","-v","error","-y","-i",src,"-filter_complex",fc,"-map","[mix]","-ar","48000","-c:a","aac","-b:a","192k",f"{proj}/assets/mix.m4a"],check=True)
print(proj, "audio", round(sum(b-a for a,b in EDL)-D*(len(EDL)-1),3))
