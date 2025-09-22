#!/usr/bin/env fish

set SCRIPT_DIR (dirname (status -f))
cd $SCRIPT_DIR/../resources/plannings || exit 1

for f in *.json; jq 'walk(if type=="object" then with_entries(if .key=="edts" then .key="children" else . end) else . end)' "$f" > "$f.tmp" && mv "$f.tmp" "$f"; end
