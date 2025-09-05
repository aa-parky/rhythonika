# 🥁 Rhythonika

**Rhythonika** is a creative metronome and rhythm trainer built using modular `*onika` components from the [Tonika](https://github.com/aa-parky/tonika) ecosystem.

Designed for composers, learners, and experimental rhythm creators, it goes far beyond simple click tracks — offering flexible subdivision patterns, sound styles, and an interactive UI.

Powered by the **headless Soundonika audio engine**, Rhythonika leaves all backend sound handling to a dedicated audio module while focusing entirely on **rhythmic flow, scheduling, and user control**.

---

## 🎯 Key Features

- Creative rhythm engine (simple-to-complex patterns)
- Pattern visualisation and tempo control
- Sound mode switch (clicks vs drum samples)
- Volume adjustment
- Real-time audio scheduling
- Powered by [`soundonika`](https://github.com/aa-parky/soundonika) audio backend
- Friendly for beginners and tinkerers alike

---

## 🧱 Project Structure

```
rhythonika/
├── css/
│   └── rhythonika.css          # Styling
├── js/
│   └── rhythonika.js           # Main module logic
├── samples/                    # (Unused: samples are now loaded via soundonika)
├── rhythonika.html             # Main demo page
└── README.md
```

---

## 🧩 Integration with Soundonika

Rhythonika depends on the [Soundonika](https://github.com/aa-parky/soundonika) engine to load and play click sounds or drum samples.

### 🔌 Add to your HTML

```html
<!-- Load Soundonika audio engine -->
<!--suppress ALL -->
<script src="https://cdn.jsdelivr.net/gh/aa-parky/soundonika@main/js/soundonika.js"></script>

<!-- Load Rhythonika -->
<script src="js/rhythonika.js"></script>
```

> Soundonika provides a method like `scheduleSound(time, type, velocity)` that Rhythonika uses to schedule click events or drum hits at precise times.

---

## 🧠 Sample CDN Caching: Commit Hash Trick

jsDelivr aggressively caches files served from GitHub. During development, **you may not see your latest updates immediately** when using `@main`.

### ✅ Recommended: Use a specific commit hash

```html
<!--suppress ALL -->
<script src="https://cdn.jsdelivr.net/gh/aa-parky/soundonika@14fba03/js/soundonika.js"></script>
```

> Replace `14fba03` with your actual commit SHA. This ensures the correct version is loaded during dev/testing.

Later you can switch back to:

```html
<!--suppress ALL -->
<script src="https://cdn.jsdelivr.net/gh/aa-parky/soundonika@main/js/soundonika.js"></script>
```

Or better still, a tagged version like:

```html
<!--suppress JSUnresolvedLibraryURL -->
<script src="https://cdn.jsdelivr.net/gh/aa-parky/soundonika@v1.0.0/js/soundonika.js"></script>
```

---

## 🚀 Roadmap

- [x] Soundonika integration
- [x] Pattern scheduler
- [ ] Save/load pattern memory
- [ ] Tap tempo
- [ ] Advanced time signature support (5/8, 7/4, etc.)
- [ ] Visual rhythm animation mode

---

## 🤝 Contributing

We welcome feedback, new pattern ideas, rhythm visualisations, or pull requests that enhance usability or extensibility.

🧃 Check out the full Tonika ecosystem here:  
https://github.com/aa-parky/tonika

---

## 📜 License

MIT © [aa-parky](https://github.com/aa-parky)
