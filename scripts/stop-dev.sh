#!/usr/bin/env bash
# Stops what start-dev.sh started. Anything it found already running was never its to stop.

set -u

LOGS="$(cd "$(dirname "$0")/.." && pwd)/.dev-logs"
stopped=0

for name in website backend ml mysql; do
    file="$LOGS/$name.pid"
    [ -f "$file" ] || continue
    pid="$(cat "$file")"
    rm -f "$file"
    # A saved number can be stale after a restart, so only act on a running process group led by that number.
    if [ "$(ps -o pgid= -p "$pid" 2>/dev/null | tr -d ' ')" = "$pid" ]; then
        kill -TERM -- "-$pid" 2>/dev/null
        # Waits, so the port is free and the database has shut down cleanly when this finishes.
        for ((i = 0; i < 30; i++)); do
            kill -0 -- "-$pid" 2>/dev/null || break
            sleep 1
        done
        echo "Stopped $name"
        stopped=$((stopped + 1))
    fi
done

[ "$stopped" -gt 0 ] || echo "Nothing to stop: start-dev.sh hasn't started anything that's still running."
