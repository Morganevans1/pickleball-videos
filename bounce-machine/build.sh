#!/usr/bin/env bash
# Builds "The Bounce Machine" :30 from source -> out/BounceMachine_30.mp4
# Needs: node + playwright (Chromium), python3 + numpy + scipy, ffmpeg, and ../find-your-bounce (shared synths).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p out/seg
FRAMES=900; JOBS=${JOBS:-4}

echo "== sound cues + soundtrack"
node render.js cues out/cues.json
python3 audio.py out/cues.json out/soundtrack.wav

if [[ -z "${SKIP_RENDER:-}" ]]; then
  echo "== picture ($JOBS parallel renderers)"
  per=$(( (FRAMES + JOBS - 1) / JOBS )); : > out/segs.txt
  for i in $(seq 0 $((JOBS - 1))); do
    s=$((i * per)); e=$(( (i + 1) * per )); (( e > FRAMES )) && e=$FRAMES
    echo "file 'seg/seg$i.mkv'" >> out/segs.txt
    node render.js video "out/seg/seg$i.mkv" $s $e > "out/seg/seg$i.log" 2>&1 &
  done
  wait
fi

echo "== loudness (-16 LUFS, -1.5 dBTP)"
m=$(ffmpeg -hide_banner -nostats -i out/soundtrack.wav -af "loudnorm=I=-16:TP=-1.5:LRA=20:print_format=json" -f null - 2>&1 | sed -n '/^{/,/^}/p')
get() { echo "$m" | python3 -c "import json,sys;print(json.load(sys.stdin)['$1'])"; }
ffmpeg -v error -y -i out/soundtrack.wav -af "loudnorm=I=-16:TP=-1.5:LRA=20:measured_I=$(get input_i):measured_TP=$(get input_tp):measured_LRA=$(get input_lra):measured_thresh=$(get input_thresh):offset=$(get target_offset):linear=true" -ar 48000 -c:a pcm_s24le out/soundtrack_web.wav

echo "== encode"
ffmpeg -v error -y -f concat -safe 0 -i out/segs.txt -i out/soundtrack_web.wav -map 0:v -map 1:a \
  -vf "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p" -c:v libx264 -preset slow -crf 17 -maxrate 14M -bufsize 28M \
  -profile:v high -r 30 -g 15 -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -c:a aac -b:a 320k -ar 48000 -movflags +faststart -shortest out/BounceMachine_30.mp4
ls -la out/BounceMachine_30.mp4
