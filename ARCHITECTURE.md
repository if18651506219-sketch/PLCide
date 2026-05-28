# PLC IDE Code Layout

The app is intentionally kept as plain browser JavaScript with ordered script files.

- `data.js`: default project constants and built-in station/device data.
- `utils.js`: small shared helpers such as ids, name normalization, and HTML escaping.
- `app.js`: core UI state, rendering, canvas interactions, ladder/program editing, and code generation.
- `codegen.js`: Structured Text preview generation from the current station program.
- `project-io.js`: project new/open/save plus variable Excel import/export.
- `modeler.js`: parameter modeling UI that builds project/station/device/variable models and imports them into the IDE.
- `styles.css`: all visual styling.
- `index.html`: static shell and script loading order.

When changing features, start with the smallest relevant file:

- Project files or Excel variables: `project-io.js`
- Parameter modeling screens, validation, and model-to-project conversion: `modeler.js`
- Built-in stations, sensors, actuators, timers: `data.js`
- Program flow, ladder editor, variable panel rendering: `app.js`
- PLC code generation rules: `codegen.js`
- Generic formatting/id helpers: `utils.js`

This split is a low-risk first pass: files still share browser globals, so behavior stays close to the original single-file app while keeping future Codex reads smaller.

## V2 rebuild entry

V2 starts from `index-v2.html`, with code under `src/`:

- `src/model/`: project model defaults, table schemas, validation, and pure model operations.
- `src/store/`: a small state container. Structural actions re-render the app, while cell typing writes to the model without re-rendering so focus and scroll do not flicker.
- `src/ui/`: the app shell and table-based parameter modeling surface.
- `src/services/`: V2 project files, standard Excel import/export, and legacy IDE project export.

This machine currently has Node but no `npm`, so the first rebuild stage uses native ES modules instead of Vite dependencies. Once a package manager is available, `src/ui` can move to React/Vite while keeping `src/model` and `src/services` as pure modules.
