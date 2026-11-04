#!/usr/bin/env bash
# Starts everything the website needs, one thing at a time, and says plainly what worked.
# Anything already running is left alone. See stop-dev.sh to stop what this started.
#
# Tools installed outside the system path are looked for in $CREDIT_SCORING_TOOLS,
# which defaults to ~/credit-scoring-tools.

set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOGS="$ROOT/.dev-logs"
TOOLS="${CREDIT_SCORING_TOOLS:-$HOME/credit-scoring-tools}"
WEBSITE_URL="http://localhost:5175"
HEALTH_URL="http://localhost:8080/api/v1/health"

mkdir -p "$LOGS"
# Gives each started service its own process group, so stop-dev.sh can stop all of it.
set -m

# By name, because the website may only listen on the IPv6 form of this computer's address.
port_open() {
    (exec 3<>"/dev/tcp/localhost/$1") 2>/dev/null
}

wait_for_port() {
    local port="$1" seconds="$2" i
    for ((i = 0; i < seconds; i++)); do
        port_open "$port" && return 0
        sleep 1
    done
    return 1
}

start_in_background() {
    local name="$1" directory="$2"
    shift 2
    (cd "$directory" && exec nohup "$@") >"$LOGS/$name.log" 2>&1 </dev/null &
    echo $! >"$LOGS/$name.pid"
}

fail() {
    local name="$1" message="$2"
    echo
    echo "$name did not start: $message"
    if [ -f "$LOGS/$name.log" ]; then
        echo "Last lines of .dev-logs/$name.log:"
        tail -n 25 "$LOGS/$name.log" | sed 's/^/    /'
    fi
    exit 1
}

start_mysql() {
    if port_open 3306; then
        echo "MySQL: already running"
    elif [ -x "$TOOLS/start-mysql.sh" ]; then
        echo "MySQL: starting"
        start_in_background mysql "$ROOT" "$TOOLS/start-mysql.sh"
        wait_for_port 3306 30 || fail mysql "port 3306 didn't open within 30 seconds."
    else
        fail mysql "nothing is listening on port 3306. Start your MySQL server, then run this again."
    fi
}

find_python() {
    local candidate
    for candidate in "$TOOLS/python/bin/python3" python3.13 python3.12; do
        command -v "$candidate" >/dev/null 2>&1 && { echo "$candidate"; return 0; }
    done
    return 1
}

# The site still works without this service, using the labelled rules, so a problem here is only a warning.
start_ml() {
    local service="$ROOT/ml-service" python="$ROOT/ml-service/.venv/bin/python" base
    if port_open 8000; then
        echo "ML service: already running"
        return
    fi
    if [ ! -x "$python" ]; then
        if ! base="$(find_python)"; then
            echo "ML service: skipped, because it needs Python 3.12 or newer. Scoring will use the labelled rules."
            return
        fi
        echo "ML service: installing, which takes a few minutes the first time"
        "$base" -m venv "$service/.venv" >"$LOGS/ml.log" 2>&1 \
            && "$python" -m pip install -r "$service/requirements.txt" >>"$LOGS/ml.log" 2>&1 \
            || { echo "ML service: install failed, see .dev-logs/ml.log. Scoring will use the labelled rules."; return; }
    fi
    if [ ! -f "$service/models/credit_risk.joblib" ]; then
        echo "ML service: training the model"
        (cd "$service" && "$python" -m training.train) >>"$LOGS/ml.log" 2>&1 \
            || { echo "ML service: training failed, see .dev-logs/ml.log. Scoring will use the labelled rules."; return; }
    fi
    echo "ML service: starting"
    start_in_background ml "$service" "$python" -m uvicorn app.main:app --host 127.0.0.1 --port 8000
    wait_for_port 8000 30 || echo "ML service: didn't start, see .dev-logs/ml.log. Scoring will use the labelled rules."
}

start_backend() {
    if curl -sf "$HEALTH_URL" >/dev/null 2>&1; then
        echo "Backend: already running"
        return
    fi
    if port_open 8080; then
        fail backend "something else is using port 8080."
    fi
    [ -f "$ROOT/backend/.env" ] || fail backend "backend/.env is missing. Copy backend/.env.example to backend/.env and fill it in."
    [ -d "$TOOLS/jdk/Contents/Home" ] && export JAVA_HOME="$TOOLS/jdk/Contents/Home"
    echo "Backend: starting, which can take a minute"
    start_in_background backend "$ROOT/backend" ./mvnw -q spring-boot:run
    local i
    for ((i = 0; i < 300; i++)); do
        curl -sf "$HEALTH_URL" >/dev/null 2>&1 && return
        kill -0 "$(cat "$LOGS/backend.pid")" 2>/dev/null || fail backend "it stopped while starting up."
        sleep 1
    done
    fail backend "it wasn't ready after 5 minutes."
}

start_website() {
    if port_open 5175; then
        echo "Website: already running"
        return
    fi
    if [ ! -d "$ROOT/frontend/node_modules" ]; then
        echo "Website: installing packages"
        (cd "$ROOT/frontend" && npm ci) >"$LOGS/website.log" 2>&1 || fail website "npm ci failed."
    fi
    echo "Website: starting"
    start_in_background website "$ROOT/frontend" npm run dev:live
    wait_for_port 5175 30 || fail website "port 5175 didn't open within 30 seconds."
}

start_mysql
start_ml
start_backend
start_website

case "$(curl -s "$HEALTH_URL")" in
    *'"ml":"UP"'*) scoring="the trained model (synthetic data)" ;;
    *) scoring="the labelled rules, because the model isn't reachable" ;;
esac

echo
echo "Everything is up."
echo "  Website:  $WEBSITE_URL"
echo "  Scoring:  $scoring"
echo "  Logs:     .dev-logs/"
echo "  To stop:  ./scripts/stop-dev.sh"
