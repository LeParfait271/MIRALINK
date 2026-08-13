# MiraLink vendored dependencies

MiraLink keeps build-critical third-party code local so firmware builds remain
offline and reproducible. The `opus/` directory is the unmodified Opus 1.5.2
release from the Xiph.Org Foundation, distributed under its included BSD-style
license in `opus/COPYING` and `opus/LICENSE_PLEASE_READ.txt`.

MiraLink uses only the public encoder API. No code, binary, protocol or
internal structure is taken from any controller bridge project.
