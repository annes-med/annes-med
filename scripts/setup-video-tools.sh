#!/usr/bin/env bash
# Install video editing / montage tools (Ubuntu 24.04)
set -e
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
  ffmpeg melt sox mediainfo imagemagick mkvtoolnix gpac handbrake-cli \
  frei0r-plugins x264 x265 libavcodec-extra fonts-noto-core fonts-dejavu
pip install -q moviepy opencv-python-headless pydub audioop-lts ffmpeg-python \
  scenedetect yt-dlp imageio-ffmpeg "pillow>=12.2"
