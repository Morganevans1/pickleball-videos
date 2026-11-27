#!/usr/bin/env bash
# Builds "Find Your Bounce" :30 from source.
#   ./build.sh            full render (picture + sound) -> out/*.mp4
# Needs: node + playwright (Chromium), python3 + numpy + scipy, ffmpeg.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p out/seg
FRAMES=900; JOBS=${JOBS:-4}

echo "== assets"
if [[ ! -f assets/footage/f_148.jpg ]]; then
  mkdir -p assets/footage
  # vertical club clip is pillarboxed inside 1920x1080; keep the 804x1080 picture area
  ffmpeg -v error -y -i ../OS_1.mp4 -vf "crop=804:1080:558:0" -q:v 2 assets/footage/f_%03d.jpg
fi

echo "== soundtrack"
python3 audio.py out/soundtrack.wav

if [[ -z "${SKIP_RENDER:-}" ]]; then
  echo "== picture ($JOBS parallel renderers)"
  per=$(( (FRAMES + JOBS - 1) / JOBS ))
  : > out/segs.txt
  for i in $(seq 0 $((JOBS - 1))); do
    s=$((i * per)); e=$(( (i + 1) * per )); (( e > FRAMES )) && e=$FRAMES
    echo "file 'seg/seg$i.mkv'" >> out/segs.txt
    node render.js video "out/seg/seg$i.mkv" $s $e > "out/seg/seg$i.log" 2>&1 &
  done
  wait
fi

loudnorm() { # $1 in  $2 out  $3 integrated LUFS  $4 true-peak dBTP
  local m
  m=$(ffmpeg -hide_banner -nostats -i "$1" -af "loudnorm=I=$3:TP=$4:LRA=20:print_format=json" -f null - 2>&1 | sed -n '/^{/,/^}/p')
  local mi mtp mlra mth off
  mi=$(echo "$m" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d["input_i"])')
  mtp=$(echo "$m" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d["input_tp"])')
  mlra=$(echo "$m" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d["input_lra"])')
  mth=$(echo "$m" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d["input_thresh"])')
  off=$(echo "$m" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d["target_offset"])')
  ffmpeg -v error -y -i "$1" -af "loudnorm=I=$3:TP=$4:LRA=20:measured_I=$mi:measured_TP=$mtp:measured_LRA=$mlra:measured_thresh=$mth:offset=$off:linear=true" -ar 48000 -c:a pcm_s24le "$2"
}
echo "== loudness"
loudnorm out/soundtrack.wav out/soundtrack_broadcast.wav -24 -2
loudnorm out/soundtrack.wav out/soundtrack_web.wav -16 -1.5

echo "== encode"
VF="scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,noise=c0s=3:c0f=t+u"
COLOR="-colorspace bt709 -color_primaries bt709 -color_trc bt709"
enc() { # $1 audio  $2 out  $3.. x264 rate args
  local a=$1 o=$2; shift 2
  ffmpeg -v error -y -f concat -safe 0 -i out/segs.txt -i "$a" -map 0:v -map 1:a -vf "$VF" \
    -c:v libx264 -preset slow "$@" -profile:v high -level 4.2 -r 30 -g 15 -bf 2 $COLOR \
    -c:a aac -b:a 320k -ar 48000 -movflags +faststart -shortest "$o"
}
# Broadcast master: -24 LKFS / -2 dBTP (ATSC A/85), ~20 Mbps 1080p30
enc out/soundtrack_broadcast.wav out/FindYourBounce_30_broadcast.mp4 -crf 16 -maxrate 20M -bufsize 40M
# Web / social / review copy: -16 LUFS, ~8 Mbps
enc out/soundtrack_web.wav out/FindYourBounce_30_web.mp4 -crf 19 -maxrate 8M -bufsize 16M
rm -f out/picture.mp4
ls -la out/*.mp4
