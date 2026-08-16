# Third-party notices

## BOOTSEL gesture adapter

`firmware/pico/src/miralink_bootsel.cpp` and its low-level BOOTSEL sampling
logic are adapted from `awalol/DS5Dongle` release `v0.7.2-hotfix`, specifically
`src/button_functions.cpp`. The original project is available at
<https://github.com/awalol/DS5Dongle/tree/v0.7.2-hotfix> and is distributed
under the MIT License. MiraLink-specific dispatch, pairing-store handling,
and all surrounding firmware remain separate code.

The applicable MIT notice is reproduced here for this adapted portion:

```text
MIT License

Copyright (c) 2026 awalol

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

The DS5Dongle audio implementation is intentionally not copied here: its
source header identifies that file as MPL-2.0, and the MiraLink USB-audio
persona still requires separate hardware validation.
