# Home kiosk modules

Self-contained HTML pages shown full screen (800 × 480) in Chromium kiosk mode on a Raspberry Pi.

## 05-tube-status.html

Underground and Thameslink status, showing a delay only if it falls on one of the commute routes set in `LEGS`.

- **Setup:** put your TfL keys in `CONFIG.APP_KEY` and `CONFIG.APP_KEY_SECONDARY`. The committed copy has placeholders, so keys never go into git.
- **Settings:** `CONFIG` sets the lines, refresh rate, scroll speed and the "elsewhere on the line" note. `LINE_STYLE` sets the colours.
- **Debug:** add `?debug` to the URL to see every disruption and why it was shown or hidden.
- **Resizing:** every size is a fixed pixel value in the CSS. For example, the train height is under `#train-img svg`.

`kiosk/local/` is git-ignored and is for copies that hold real keys.
