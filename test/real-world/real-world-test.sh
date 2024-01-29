#!/usr/bin/env bash

export BASE_URL="http://localhost:31022/api/v1"

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$SCRIPT_DIR"/../../ || exit 1

SED_CMD="sed"
if [[ "$OSTYPE" == "darwin"* ]]; then
  SED_CMD="/opt/homebrew/opt/gnu-sed/libexec/gnubin/sed"
fi

# If arg, replace "build: ." with image: $1 in docker-compose-test.yml
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

# /api/v1/calendars?p=iutdevannes.butdutinfo.1ereannee.gr1a.gr1a1
function get_calendar() {
  curl -s -X GET ${BASE_URL}/calendars?p=iutdevannes.butdutinfo.1ereannee.gr1a.gr1a1
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

# /calendars/info?p=iutdevannes.butdutinfo.1ereannee.gr1a.gr1a1
function get_calendar_info() {
  curl -s -X GET ${BASE_URL}/calendars/info?p=iutdevannes.butdutinfo.1ereannee.gr1a.gr1a1
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
cd "$SCRIPT_DIR" || exit 1
docker buildx build -t test-playwright --cache-from type=gha --cache-to type=gha,mode=max . || exit 1
docker run --rm --ipc=host --network=host --init test-playwright:latest || exit 1

echo "Tests passed!"
