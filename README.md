# 🧲 Magnetic Shuttle

**Drag tabs left to pin, drag right to unpin.** The most intuitive way to manage pinned tabs in Chrome.

![Chrome Web Store](https://img.shields.io/badge/Chrome-Extension-green?logo=googlechrome)
![License](https://img.shields.io/badge/License-MIT-blue)

## ✨ Features

- **Drag to Pin** — Drag any tab to the left edge (or next to pinned tabs) to pin it
- **Drag to Unpin** — Drag a pinned tab to the right to unpin it  
- **Position Aware** — Tabs stay where you drop them, not forced to the end
- **Keyboard Shortcut** — `Cmd+Shift+P` (Mac) / `Ctrl+Shift+P` (Windows) to toggle pin
- **One-Click Toggle** — Click the extension icon to pin/unpin the current tab
- **Lightweight** — No bloat, no permissions beyond tabs, just works

## 🎬 How It Works

| Action | Result |
|--------|--------|
| Drag unpinned tab → left edge | 📌 **Pins the tab** |
| Drag pinned tab → right edge | 📤 **Unpins the tab** |
| Click extension icon | 🔄 **Toggles pin state** |
| `Cmd/Ctrl+Shift+P` | ⌨️ **Toggles pin state** |

## 📦 Installation

### From Chrome Web Store (Recommended)
*Coming soon!*

### Manual Installation (Developer Mode)

1. **Download** this repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/magnetic-shuttle.git
   ```

2. **Open Chrome Extensions**:
   - Go to `chrome://extensions/`
   - Enable **Developer mode** (top right toggle)

3. **Load the extension**:
   - Click **"Load unpacked"**
   - Select the `magnetic-shuttle` folder

4. **Pin the extension** (optional):
   - Click the puzzle piece icon in Chrome toolbar
   - Pin "Magnetic Shuttle" for quick access

## 🎯 Why Magnetic Shuttle?

Chrome has a hidden experimental flag (`chrome://flags/#drag-to-pin-tabs`) but:
- ❌ It's disabled by default
- ❌ Requires at least one tab already pinned
- ❌ Experimental and may be removed

**Magnetic Shuttle** is:
- ✅ Works out of the box
- ✅ Works with zero pinned tabs
- ✅ Production-ready and stable
- ✅ Has keyboard shortcut fallback

## 🛠 Edge Cases

For tabs that can't be moved (Chrome limitation):
- **Last/only pinned tab**: Use `Cmd/Ctrl+Shift+P` or click the icon
- **First unpinned tab**: Wiggle it right then left, or use the shortcut

## 📄 License

MIT License — do whatever you want with it.

## 🤝 Contributing

PRs welcome! This is a simple extension, but improvements are always appreciated.

---

Made with 🧲 by [@RijnHartman](https://github.com/RijnHartman)
