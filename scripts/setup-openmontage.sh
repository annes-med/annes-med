#!/usr/bin/env bash
# Install OpenMontage (agentic video production) into /home/user/tools/OpenMontage
set -e
DIR=${1:-/home/user/tools/OpenMontage}
if [ ! -d "$DIR/.git" ]; then
  mkdir -p "$(dirname "$DIR")"
  GIT_LFS_SKIP_SMUDGE=1 git clone --depth 1 https://github.com/OpenMontageInc/OpenMontage "$DIR"
fi
cd "$DIR"
make setup
# remotion.media is not reachable here: use the preinstalled Chromium for Remotion renders
cat > remotion-composer/remotion.config.ts <<'CFG'
import { Config } from "@remotion/cli/config";
Config.setBrowserExecutable(
  "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell",
);
CFG
echo "OpenMontage ready in $DIR — test: cd $DIR && make demo-list && .venv/bin/python render_demo.py world-in-numbers"
