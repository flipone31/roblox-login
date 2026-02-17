# Playbox — Login Demo

This is a small, original, Roblox-inspired login page demo (not a copy of Roblox).

To view locally, open `index.html` in your browser. No build steps required.

Files added:

- `index.html` — main page
- `styles.css` — styles
- `script.js` — client-side form behavior
- `assets/logo.svg` — demo logo

Customizing the background and logo:

- To add a background image, place your file in `assets/` and set the CSS variable `--bg-image` in `styles.css`, for example:

	```css
	:root{ --bg-image: url('assets/my-bg.jpg'); }
	```

- To add a custom logo, place `logo.png` (or `logo.svg`) in `assets/`. The header image will use `assets/logo.svg` by default and fall back to `assets/logo.png` if the SVG is missing.

PowerShell example (copy a file into the project):

```powershell
Move-Item "C:\Users\<you>\Downloads\your-logo.png" "D:\Hack\roblox login\assets\logo.png"
Move-Item "C:\Users\<you>\Downloads\your-bg.jpg" "D:\Hack\roblox login\assets\my-bg.jpg"
```

License: use freely for demos and learning.
