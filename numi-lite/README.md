# Numi J

A tiny notepad-style calculator desktop app (Electron). Type calculations one per
line and see the result next to each line. Open several files at once in tabs and
save your sheets to plain-text files.

## Run

```bash
cd numi-lite
npm install
npm start
```

## Features

- Live evaluation, one result per line.
- Variables: `a = 5`, then reuse `a` on later lines.
- Custom functions: `double(x) = x * 2`, then call `double(9)`. Definitions can use
  other variables and functions.
- Autocomplete: press `Tab` to complete a variable or function name (declared vars,
  custom/built-in functions and constants). Matching is case-insensitive; if several
  match, a menu appears — navigate with `↑`/`↓`, accept with `Tab`/`Enter`, dismiss
  with `Esc`.
- Syntax highlighting in the editor: variables, functions, numbers and comments each
  get a distinct color.
- Built-in functions (comma-separated args): `min`, `max`, `sqrt`, `cbrt`, `abs`,
  `round`, `floor`, `ceil`, `trunc`, `sign`, `pow`, `log`, `ln`, `exp`, `sin`, `cos`,
  `tan`, `sum`, `avg`.
- Constants: `pi`, `e`, `tau`.
- Operators: `+ - * / % ^`, parentheses, unary minus.
- Comments: anything after `#` on a line is ignored.
- Tabs: open several files at once. `Cmd+N` new tab, `Cmd+O` open in a tab,
  `Cmd+W` close tab, `Cmd+1..9` jump to a tab, `+` button to add one. Each tab keeps
  its own file, content and unsaved-changes marker.
- Save / open `.numi` (plain text) files: `Cmd+S`, `Cmd+O`, `Cmd+N`, `Cmd+Shift+S`.
- Adjustable text size: titlebar buttons, `Cmd +` / `Cmd -` / `Cmd 0`, or `Cmd`+scroll.
- Themes: Black (default), White and Violet (Catppuccin Mocha inspired). Picker is in
  the titlebar; the choice is remembered across sessions.

## Build an installer

The app icon lives in `build/` (`icon.svg` → `icon.png` / `icon.icns`).

```bash
cd numi-lite
npm install
npm run dist   # builds dist/Numi Lite-<version>-arm64.dmg (and a .zip)
```

Open the generated `.dmg` and drag **Numi Lite** into `Applications`.

The build is unsigned (no Apple Developer certificate), so the first launch is
gated by Gatekeeper: right-click the app → **Open**, or run
`xattr -dr com.apple.quarantine "/Applications/Numi Lite.app"`.

Use `npm run pack` for an unpacked `dist/mac-*/Numi Lite.app` without a DMG.

## Example

```
iva = 21
conIva(p) = p + p * iva / 100
conIva(1000)   # 1210
double(x) = x * 2
double(9)      # 18
min(3, 4) + max(10, 2)  # 13
```

## How to iterate

- Calc logic lives in `engine.js` (framework-free, testable with plain Node:
  `node -e 'console.log(require("./engine.js").evaluateDocument("1+2"))'`).
- UI wiring is in `renderer.js`, layout in `index.html` / `styles.css`.
- Window, menus and file dialogs are in `main.js`.
