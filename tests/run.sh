#!/usr/bin/env bash
# Runs the built tests: the key-to-character mapping, then every display scenario.
# Usage: tests/run.sh BUILD_DIR   (make test builds the programs first)
set -euo pipefail
build=${1:?build directory}
scenarios=(left-master right-master receiver retry modifiers special-keys every-key
           active-keymap all-glyphs left-layout host row-fit)
"$build/key_text_test"
for scenario in "${scenarios[@]}"; do
    "$build/display_test" "$scenario"
done
