"""Copy a firmware file onto one Kyria half that is waiting in its bootloader.

Put a half into its bootloader yourself: plug USB into that half and
double-press its reset button; a drive named RPI-RP2 appears. This script
never sends a reset or bootloader command. It waits up to 2 minutes for the
drive, copies the firmware, and waits for the keyboard to come back.

Usage: flash.py FIRMWARE.uf2
"""
import getpass
import shutil
import sys
import time
from importlib import import_module
from pathlib import Path

hid = import_module('hid')  # from the project's .venv (setup.sh)

VID, PID, USAGE_PAGE = 0x8D1D, 0x7FCE, 0xFF60


def bootloader_drive():
    user = getpass.getuser()
    for base in (Path('/run/media') / user, Path('/media') / user, Path('/media')):
        drive = base / 'RPI-RP2'
        if (drive / 'INFO_UF2.TXT').exists():
            return drive
    return None


def keyboard_present():
    return any(d['usage_page'] == USAGE_PAGE for d in hid.enumerate(VID, PID))


def main():
    if len(sys.argv) != 2 or not Path(sys.argv[1]).is_file():
        raise SystemExit(__doc__)
    firmware = Path(sys.argv[1])
    print('Plug USB into the half to update and double-press its reset button.', flush=True)
    deadline = time.monotonic() + 120
    while not (drive := bootloader_drive()):
        if time.monotonic() > deadline:
            raise SystemExit('No RPI-RP2 drive appeared within 2 minutes; nothing was changed.')
        time.sleep(0.5)
    print(f'Found {drive}; copying {firmware.name}...', flush=True)
    shutil.copyfile(firmware, drive / 'FIRMWARE.UF2')
    deadline = time.monotonic() + 30
    while not keyboard_present():
        if time.monotonic() > deadline:
            raise SystemExit('Copied, but the keyboard did not come back within 30 s.')
        time.sleep(0.25)
    print('Done: that half is running the new firmware.')


if __name__ == '__main__':
    main()
