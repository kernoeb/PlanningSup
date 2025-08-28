#!/usr/bin/env bash

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

# Default planning
export DEFAULT_PLANNING_FULL_ID="iut-de-vannes.butdutinfo.1ereannee.gr1a.gr1a1"

# Build the first image in the background for speed
pids=( )
(cd "$SCRIPT_DIR" && docker build -t test-playwright .) & pids+=($!)

export BASE_URL="http://localhost:31022/api/v1"

cd "$SCRIPT_DIR"/../../ || exit 1

SED_CMD="sed"
if [[ "$OSTYPE" == "darwin"* ]]; then
  SED_CMD="/opt/homebrew/opt/gnu-sed/libexec/gnubin/sed"
  if ! command -v $SED_CMD &> /dev/null
  then
      echo "GNU sed could not be found, please install it with 'brew install gnu-sed' and add it to your PATH"
      exit 1
  fi
fi

# If arg, replace build with image: $1 in docker-compose-test.yml
if [ $# -eq 1 ]; then
  echo "Replacing \"build: .\" with \"image: $1\" in docker-compose-test.yml"
  $SED_CMD -i "s/build: \./image: $1/g" docker-compose-test.yml || exit 1
  docker compose -f docker-compose-test.yml up -d || exit 1
else
  docker compose -f docker-compose-test.yml up -d --build || exit 1
fi


# GET /api/v1/health
function get_health() {
  curl -s -X GET ${BASE_URL}/health
}

i=0
max_retries=30
# should be {"db":true,"bree":true}
while ! get_health | grep -q "\"db\"\:true\,\"bree\"\:true" && [ $i -lt $max_retries ]; do
  echo "Waiting for the server to be ready... ($i/$max_retries)"
  sleep 1
  ((i++))
done

if [ "$i" -ge $max_retries ]; then
  echo "Health check failed, exiting."
  exit 1
fi

echo "HEALTH working!"

# GET /api/v1/urls
function get_urls() {
  curl -s -X GET ${BASE_URL}/urls
}

i=0
max_retries=5
while ! get_urls | grep -q "IUT de Vannes" && [ $i -lt $max_retries ]; do
  echo "Waiting for the server to be ready... ($i/$max_retries)"
  sleep 1
  ((i++))
done

if [ "$i" -ge $max_retries ]; then
  echo "URLs check failed, exiting."
  exit 1
fi

echo "URLS working!"

function get_calendar() {
  curl -s -X GET "${BASE_URL}/calendars?p=${DEFAULT_PLANNING_FULL_ID}"
}

i=0
max_retries=5
while ! get_calendar | grep -q "\"status\"\:\"ok\"," && [ $i -lt $max_retries ]; do
  echo "Waiting for the server to be ready... ($i/$max_retries)"
  sleep 1
  ((i++))
done

if [ "$i" -ge $max_retries ]; then
  echo "Calendar check failed, exiting."
  exit 1
fi

echo "CALENDAR working!"

function get_calendar_info() {
  curl -s -X GET "${BASE_URL}/calendars/info?p=${DEFAULT_PLANNING_FULL_ID}"
}

i=0
max_retries=5
while ! get_calendar_info | grep -q "\"title\"\:\"IUT de Vannes BUT INFO 1ère année GR 1A GR 1A1\"" && [ $i -lt $max_retries ]; do
  echo "Waiting for the server to be ready... ($i/$max_retries)"
  sleep 1
  ((i++))
done

if [ "$i" -ge $max_retries ]; then
  echo "Calendar Info check failed, exiting."
  exit 1
fi

echo "CALENDAR INFO working!"

# Playwright tests
# https://stackoverflow.com/questions/36316040/exit-a-bash-script-if-an-error-occurs-in-it-or-any-of-the-background-jobs-it-cre
cd "$SCRIPT_DIR" || exit 1
while (( ${#pids[@]} )); do
  for pid_idx in "${!pids[@]}"; do
    pid=${pids[$pid_idx]}
    if ! kill -0 "$pid" 2>/dev/null; then # kill -0 checks for process existance
      # we know this pid has exited; retrieve its exit status
      wait "$pid" || exit
      unset "pids[$pid_idx]"
    fi
  done
  sleep 1 # in bash, consider a shorter non-integer interval, ie. 0.2
done
docker run --rm --ipc=host --network=host --init test-playwright:latest || exit 1

echo "Tests passed!"
