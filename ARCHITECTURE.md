# PLC IDE Code Layout

The app is intentionally kept as plain browser JavaScript with ordered script files.

- `data.js`: default project constants and built-in station/device data.
- `utils.js`: small shared helpers such as ids, name normalization, and HTML escaping.
- `app.js`: core UI state, rendering, canvas interactions, ladder/program editing, and code generation.
- `codegen.js`: Structured Text preview generation from the current station program.
- `project-io.js`: project new/open/save plus variable Excel import/export.
- `styles.css`: all visual styling.
- `index.html`: static shell and script loading order.

When changing features, start with the smallest relevant file:

- Project files or Excel variables: `project-io.js`
- Built-in stations, sensors, actuators, timers: `data.js`
- Program flow, ladder editor, variable panel rendering: `app.js`
- PLC code generation rules: `codegen.js`
- Generic formatting/id helpers: `utils.js`

This split is a low-risk first pass: files still share browser globals, so behavior stays close to the original single-file app while keeping future Codex reads smaller.
