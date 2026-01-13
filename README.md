# Folish

<div align="center">

**A high-performance infinite canvas drawing application.**

[Download](https://github.com/ppmpreetham/folish/releases) · [Roadmap](https://www.google.com/search?q=%23-roadmap) · [Discord](https://www.google.com/search?q=https://discord.gg/rickroll)

</div>

---

###hat is Folish?

Folish is a **framework-agnostic** digital sketchbook inspired by _Concepts_. It combines the performance of **Rust** with the flexibility of **React** to create a buttery-smooth drawing experience.

It features an **infinite canvas**, a **perfect-freehand** stroke engine, and a complex **layering system**, all wrapped in a minimal interface designed to keep you in the flow.

### Quick Start

Ensure you have [Node.js](https://www.google.com/search?q=https://nodejs.org/) (v16+) and [Rust](https://www.google.com/search?q=https://www.rust-lang.org/) installed.

```bash
# 1. Clone the repository
git clone https://github.com/ppmpreetham/folish.git
cd folish

# 2. Install dependencies
pnpm install

# 3. Run in development mode
pnpm tauri dev

```

> [!TIP] > **Building for Production:**
> To create a standalone executable for your OS, run:
>
> ```bash
> pnpm tauri build
>
> ```

---

### Features

Folish is packed with professional-grade tools designed for speed and precision.

### The Engine

- **Infinite Canvas:** No boundaries. Pan and zoom forever.
- **High-Performance:** Optimized SVG rendering with canvas overlays for live strokes using `requestAnimationFrame`.
- **Velocity Smoothing:** Adaptive algorithms that stabilize your lines based on drawing speed.
- **Stylus Support:** Full pressure sensitivity for Wacom, Huion, and tablet devices.

### Layer Management

Organize your artwork with a robust layer system.

| Feature               | Description                                                   |
| --------------------- | ------------------------------------------------------------- |
| **Unlimited Layers**  | Create as many layers as your RAM allows.                     |
| **Visibility & Lock** | Toggle visibility or lock layers to prevent accidental edits. |
| **Opacity Control**   | Real-time transparency adjustment per layer.                  |
| **Thumbnails**        | Live visual previews of layer contents.                       |
| **Drag & Sort**       | Auto or manual sorting to arrange your stack.                 |

### Color & Style

- **COPIC Wheel:** Integrated color wheel with 69 curated sections.
- **Custom Hex:** Full support for custom color inputs.
- **Dynamic Grid:** Visual reference grid that scales intelligently with your zoom level.

---

### Controls & Shortcuts

Folish is designed for efficiency. Use these shortcuts to speed up your workflow.

| Action           | Shortcut                            |
| ---------------- | ----------------------------------- |
| **Undo**         | `Ctrl` + `Z`                        |
| **Redo**         | `Ctrl` + `Shift` + `Z`              |
| **Pan Canvas**   | `Middle Mouse` _or_ `Ctrl` + `Drag` |
| **Zoom**         | `Scroll Wheel`                      |
| **Context Menu** | `Right Click` (on layers)           |

---

### Tech Stack

Folish leverages the best modern web and systems programming technologies.

- **Core:** [Tauri](https://www.google.com/search?q=https://tauri.app) (Rust)
- **Frontend:** [React](https://www.google.com/search?q=https://react.dev) + [TypeScript](https://www.google.com/search?q=https://www.typescriptlang.org/)
- **State:** [Zustand](https://github.com/pmndrs/zustand) (Persistence) + [Immer](https://www.google.com/search?q=https://github.com/immerjs/immer) (Patches)
- **Rendering:** [perfect-freehand](https://github.com/steveruizok/perfect-freehand)
- **Styling:** [Tailwind CSS](https://www.google.com/search?q=https://tailwindcss.com/) + [Phosphor Icons](https://www.google.com/search?q=https://phosphoricons.com/)

---

### Roadmap

I am actively working on the following features:

- [ ] **Selection & Transform:** Manipulate existing strokes.
- [ ] **Export Options:** SVG, PNG, and PDF export support.
- [ ] **Shape Tools:** Geometric primitives (Rectangle, Circle, Line).
- [ ] **Cloud Sync:** Collaborate and sync across devices.
- [ ] **Plugin System:** Community-driven extensions.
- [ ] **Rulers:** Measurement and guide tools.

---

### Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

###ecommended IDE Setup

- [VS Code](https://code.visualstudio.com/)
- [Tauri Extension](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

---

### License

Distributed under the MIT License. See `LICENSE` for more information.

### Acknowledgments

- [perfect-freehand](https://github.com/steveruizok/perfect-freehand) for the stroke algorithm.
- [Concepts](https://concepts.app/) for the UI/UX inspiration.
