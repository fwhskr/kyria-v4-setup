#!/usr/bin/env bash
# Fetch everything needed to build, test and run this project into the project
# folder itself (.venv/ and .deps/), at fixed versions, so a fresh computer can
# rebuild exactly what is on the keyboard. Safe to run again: finished steps
# are skipped.
#
#   .venv/            Python tools: QMK CLI, Pillow, hidapi binding
#   .deps/vial-qmk/   Vial's QMK firmware source, pinned commit + submodules
#   .deps/toolchain/  QMK's ARM GCC toolchain, pinned release, checksum-verified
#
# Needs: git, python3 (3.10+), curl, tar with zstd, a C compiler (tests),
# libhidapi-hidraw (the computer helper) and libxkbcommon (keyboard languages).
set -euo pipefail

VIAL_QMK_URL=https://github.com/vial-kb/vial-qmk.git
VIAL_QMK_COMMIT=dd43959ae5c08d8a28d38a1acf7b04e86b14a344
TOOLCHAIN_URL=https://github.com/qmk/qmk_toolchains/releases/download/v15.2.0-1/qmk_toolchains-gcc15.2.0-host_linuxX64.tar.zst
TOOLCHAIN_SHA256=6b136919e3526f3f373e91f7d011a006e968a3169262d33cf6efa3e6c605c3ca

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
DEPS=$ROOT/.deps
cd "$ROOT"

step() { printf '\n== %s\n' "$*"; }
need() { command -v "$1" >/dev/null || { echo "Missing program: $1 ($2)" >&2; exit 1; }; }

need git "install git"
need python3 "install python3"
need curl "install curl"
need zstd "install zstd"
need cc "install gcc (for the tests)"
mkdir -p "$DEPS"

step "Python environment (.venv)"
if [ ! -x .venv/bin/python ]; then
    python3 -m venv .venv
fi
.venv/bin/python -m pip install --quiet --disable-pip-version-check -r requirements.txt
echo "ok: $(.venv/bin/qmk --version) QMK CLI, Pillow $(.venv/bin/python -c 'import PIL; print(PIL.__version__)')"

step "Vial QMK firmware source (.deps/vial-qmk @ ${VIAL_QMK_COMMIT:0:8})"
QMK="$DEPS/vial-qmk"
if [ "$(git -C "$QMK" rev-parse HEAD 2>/dev/null || true)" != "$VIAL_QMK_COMMIT" ] ||
   ! git -C "$QMK" submodule status --recursive | grep -qv '^-' ; then
    if [ ! -d "$QMK/.git" ]; then
        git init --quiet "$QMK"
        git -C "$QMK" remote add origin "$VIAL_QMK_URL"
    fi
    git -C "$QMK" fetch --quiet --depth 1 origin "$VIAL_QMK_COMMIT"
    git -C "$QMK" -c advice.detachedHead=false checkout --quiet --force FETCH_HEAD
    git -C "$QMK" submodule update --quiet --init --recursive --depth 1 --jobs 4
fi
if git -C "$QMK" submodule status --recursive | grep -q '^[-+U]'; then
    echo "Submodules are not at the pinned commits:" >&2
    git -C "$QMK" submodule status --recursive >&2
    exit 1
fi
echo "ok: $(git -C "$QMK" log -1 --format='%h %s')"

step "ARM toolchain (.deps/toolchain)"
TOOLS="$DEPS/toolchain"
if [ ! -x "$TOOLS/bin/arm-none-eabi-gcc" ]; then
    ARCHIVE="$DEPS/$(basename "$TOOLCHAIN_URL")"
    if ! echo "$TOOLCHAIN_SHA256  $ARCHIVE" | sha256sum --check --status 2>/dev/null; then
        echo "Downloading $(basename "$ARCHIVE") (about 125 MB)..."
        curl --fail --location --silent --show-error --output "$ARCHIVE.part" "$TOOLCHAIN_URL"
        echo "$TOOLCHAIN_SHA256  $ARCHIVE.part" | sha256sum --check --quiet
        mv "$ARCHIVE.part" "$ARCHIVE"
    fi
    rm -rf "$TOOLS.part"
    mkdir -p "$TOOLS.part"
    # The archive holds one top folder; only the ARM compiler is needed.
    tar --zstd -xf "$ARCHIVE" -C "$TOOLS.part" --strip-components=1 \
        --exclude='*avr*' --exclude='*riscv32*'
    mv "$TOOLS.part" "$TOOLS"
    rm -f "$ARCHIVE"
fi
echo "ok: $("$TOOLS/bin/arm-none-eabi-gcc" --version | head -1)"

step "Libraries the computer helper uses"
missing=0
for lib in libhidapi-hidraw.so.0 libxkbcommon.so.0; do
    if .venv/bin/python -c "import ctypes, sys; ctypes.CDLL(sys.argv[1])" "$lib" 2>/dev/null; then
        echo "ok: $lib"
    else
        echo "missing: $lib (openSUSE: libhidapi-hidraw0 / libxkbcommon0; Debian/Ubuntu: libhidapi-hidraw0 / libxkbcommon0)"
        missing=1
    fi
done

step "Done"
cat <<'EOF'
Next steps:
  make test             check the display code
  make firmware         build the keyboard firmware (.build/kyria_rev4_keypress_display.uf2)
  make udev             once per computer: let your user talk to the keyboard (asks for your password)
  make install-helper   start the screen helper now and at every login
EOF
exit $missing
