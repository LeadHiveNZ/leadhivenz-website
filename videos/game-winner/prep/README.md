# Media prep (ffmpeg)

Source: 720x1280 game-film compilation, 47.1 s. All media in `assets/` is rebuilt from it with:

GRADE = hqdn3d=1.5:1.2:3:3, scale=1080:1920:flags=lanczos, unsharp=5:5:0.55:5:5:0,
        eq=contrast=1.13:saturation=1.18:brightness=-0.015:gamma=0.97,
        colorbalance=rs=-0.04:gs=-0.01:bs=0.05:rh=0.03:bh=-0.03, format=yuv420p
ENC   = -c:v libx264 -preset slow -crf 14 -g 6 -bf 0 -an
MI    = minterpolate=fps=120:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1

- full.mp4        : whole source, GRADE
- intro_slow.mp4  : -ss 0.00 -t 1.00, MI, setpts=PTS/0.3125, fps=30, GRADE
- shot_slow.mp4   : -ss 28.95 -t 1.45, MI, setpts=PTS/0.3125, fps=30, GRADE
- rim_slow.mp4    : -ss 29.68 -t 0.70, MI, setpts=PTS/0.34, fps=30, GRADE
- freeze_release.jpg / freeze_swish.jpg : shot_slow.mp4 at 0.35 s / 3.62 s

Then: python3 -I build.py && python3 -I audio.py assets/soundtrack.wav,
render muted, mux the soundtrack as AAC 192k.
