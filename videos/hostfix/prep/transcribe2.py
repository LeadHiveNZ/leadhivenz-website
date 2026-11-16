import json, wave, numpy as np, sherpa_onnx
d="models/sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8"
rec = sherpa_onnx.OfflineRecognizer.from_transducer(encoder=f"{d}/encoder.int8.onnx", decoder=f"{d}/decoder.int8.onnx", joiner=f"{d}/joiner.int8.onnx", tokens=f"{d}/tokens.txt", num_threads=4, model_type="nemo_transducer")
w=wave.open("audio16k.wav"); sr=w.getframerate(); n=w.getnframes()
samples=np.frombuffer(w.readframes(n),dtype=np.int16).astype(np.float32)/32768.0
chunk=30*sr; words=[]
for off in range(0,len(samples),chunk):
    seg=samples[off:off+chunk]
    s=rec.create_stream(); s.accept_waveform(sr,seg); rec.decode_stream(s)
    cur=None
    for t,tt in zip(s.result.tokens,s.result.timestamps):
        t0=tt+off/sr
        if t.startswith(" ") or cur is None:
            if cur: words.append(cur)
            cur={"text":t.strip(),"start":t0,"end":t0+0.2}
        else:
            cur["text"]+=t; cur["end"]=t0+0.2
    if cur: words.append(cur)
for i in range(len(words)-1):
    words[i]["end"]=min(words[i+1]["start"], words[i]["start"]+0.6)
json.dump(words,open("transcript.json","w"),indent=0)
