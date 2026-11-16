import json, sys, numpy as np, subprocess, sherpa_onnx
d="models/sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8"
rec = sherpa_onnx.OfflineRecognizer.from_transducer(encoder=f"{d}/encoder.int8.onnx", decoder=f"{d}/decoder.int8.onnx", joiner=f"{d}/joiner.int8.onnx", tokens=f"{d}/tokens.txt", num_threads=4, model_type="nemo_transducer")
rngs = json.load(open("edl.json"))["EDL"] if len(sys.argv) < 2 else json.loads(sys.argv[1])
for a,b in rngs:
    raw=subprocess.run(["ffmpeg","-v","error","-ss",str(a),"-t",str(b-a),"-i","src.mov","-ac","1","-ar","16000","-f","f32le","-"],capture_output=True).stdout
    x=np.frombuffer(raw,np.float32)
    s=rec.create_stream(); s.accept_waveform(16000,np.concatenate([np.zeros(4000,np.float32),x,np.zeros(4000,np.float32)])); rec.decode_stream(s)
    print(f"{a:6.2f}-{b:6.2f}: {s.result.text}")
