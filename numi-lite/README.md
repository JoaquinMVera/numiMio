# Numi Lite

A tiny notepad-style calculator desktop app (Electron). Type calculations one per
line and see the result next to each line. Save your sheets to plain-text files.

## Run

```bash
cd numi-lite
npm install
npm start
```

## Features

- Live evaluation, one result per line.
- Variables: `a = 5`, then reuse `a` on later lines.
- Functions (comma-separated args): `min`, `max`, `sqrt`, `cbrt`, `abs`, `round`,
  `floor`, `ceil`, `trunc`, `sign`, `pow`, `log`, `ln`, `exp`, `sin`, `cos`, `tan`,
  `sum`, `avg`.
- Constants: `pi`, `e`, `tau`.
- Operators: `+ - * / % ^`, parentheses, unary minus.
- Comments: anything after `#` on a line is ignored.
- Save / open `.numi` (plain text) files: `Cmd+S`, `Cmd+O`, `Cmd+N`, `Cmd+Shift+S`.

## Example

```
a = 12
b = 8
min(a, b)      # 8
max(a, b)      # 12
(a + b) * 2    # 40
sqrt(144)      # 12
```

## How to iterate

- Calc logic lives in `engine.js` (framework-free, testable with plain Node:
  `node -e 'console.log(require("./engine.js").evaluateDocument("1+2"))'`).
- UI wiring is in `renderer.js`, layout in `index.html` / `styles.css`.
- Window, menus and file dialogs are in `main.js`.
