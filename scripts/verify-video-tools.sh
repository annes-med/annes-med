#!/usr/bin/env bash
# Smoke-test every installed video tool on generated sample media
T=$(mktemp -d); cd "$T"; F=0
ok(){ echo "OK   $1"; }; ko(){ echo "FAIL $1"; F=1; }
t(){ n=$1; shift; "$@" >/dev/null 2>&1 && ok "$n" || ko "$n"; }
t "ffmpeg x264/aac" ffmpeg -y -f lavfi -i testsrc2=size=1280x720:rate=30 -f lavfi -i sine -t 4 -c:v libx264 -c:a aac a.mp4
t "ffmpeg x265"     ffmpeg -y -f lavfi -i smptebars=size=1280x720:rate=30 -t 3 -c:v libx265 b.mp4
t "ffmpeg vp9/opus" ffmpeg -y -i a.mp4 -t 2 -c:v libvpx-vp9 -c:a libopus c.webm
t "ffmpeg xfade"    ffmpeg -y -i a.mp4 -i b.mp4 -filter_complex "[0:v][1:v]xfade=transition=fade:duration=1:offset=3[v]" -map "[v]" xf.mp4
t "ffmpeg drawtext" ffmpeg -y -i a.mp4 -vf "drawtext=fontfile=/usr/share/fonts/truetype/noto/NotoSansArabic-Regular.ttf:text='مرحبا':fontsize=60:fontcolor=white" t.mp4
printf "1\n00:00:00,000 --> 00:00:02,000\nHello\n" > s.srt
t "ffmpeg subtitles" ffmpeg -y -i a.mp4 -vf subtitles=s.srt sub.mp4
t "ffmpeg frei0r"   ffmpeg -y -i a.mp4 -vf frei0r=filter_name=glow fr.mp4
t "ffprobe"         ffprobe xf.mp4
t "melt (MLT)"      melt -silent a.mp4 b.mp4 -mix 25 -mixer luma -consumer avformat:melt.mp4
t "sox"             sox -n s.wav synth 2 sine 300
t "mediainfo"       mediainfo b.mp4
t "imagemagick"     convert -size 640x360 xc:navy title.png
t "mkvmerge"        mkvmerge -o m.mkv a.mp4
t "MP4Box"          MP4Box -add a.mp4 -new gp.mp4
t "HandBrakeCLI"    HandBrakeCLI -i a.mp4 -o hb.mp4 -e x264 -q 25
t "yt-dlp"          yt-dlp --version
t "python libs"     python3 -c '
from moviepy import VideoFileClip, concatenate_videoclips
c=VideoFileClip("a.mp4").subclipped(0,2); concatenate_videoclips([c,c]).write_videofile("mp.mp4",logger=None)
import cv2; assert cv2.VideoCapture("a.mp4").read()[0]
from pydub import AudioSegment; AudioSegment.from_file("a.mp4").export("p.mp3",format="mp3")
import ffmpeg, scenedetect'
rm -rf "$T"; [ $F = 0 ] && echo "All tools working." || { echo "Some tools failed."; exit 1; }
