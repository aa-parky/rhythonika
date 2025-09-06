// js/rhythonika.js
// Tonika module: Rhythonika (smart metronome w/ patterns)
// BEM root: .rhythonika (inside .tonika-module)
// Updated with CDN-based Soundonika integration and intelligent sample path detection

class Rhythonika {
    constructor(opts = {}) {
        this.mount = typeof opts.mount === "string" ? document.querySelector(opts.mount) : opts.mount;
        if (!this.mount) throw new Error("Rhythonika: mount target not found.");

        // ---- Audio / transport state ----
        this.isPlaying = false;
        this.bpm = Number(localStorage.getItem("rhyth_bpm")) || 120;
        this.timeSignature = JSON.parse(localStorage.getItem("rhyth_timesig") || `{"numerator":4,"denominator":4}`);
        this.currentStep = 0;
        this.intervalId = null;
        this.audioContext = null;
        this.audioEngine = null;
        this.nextNoteTime = 0.0;
        this.lookahead = 25.0;         // ms (UI timer)
        this.scheduleAheadTime = 0.1;  // seconds (audio clock window)

        // ---- Sound type configuration ----
        this.soundTypes = {
            accent: 'kick',         // Strong beats
            normal: 'hihat_closed', // Weak beats
            polyA: 'kick',          // Polyrhythm grid A
            polyB: 'snare'          // Polyrhythm grid B
        };

        // ---- CDN Configuration ----
        this.soundonikaCDN = 'https://cdn.jsdelivr.net/gh/aa-parky/soundonika/js/soundonika.js';

        // ---- Sample Path Candidates ----
        this.samplePathCandidates = [
            './samples',                                                    // Tonika frontend (most common)
            '../samples',                                                   // Local Soundonika development
            '../../samples',                                               // Alternative local structure
            'https://cdn.jsdelivr.net/gh/aa-parky/tonika/samples',        // Tonika CDN
            'https://cdn.jsdelivr.net/gh/aa-parky/soundonika@8d46682/js/soundonika.js'     // Soundonika CDN fallback
        ];

        // ---- Patterns (grid-based, except polyrhythm which is dual grid) ----
        // accents: 1 = strong, 0 = weak (for simple single-grid patterns)
        this.patterns = {
            "basic":      { name: "Basic 4/4", slotsPerBar: 4,  accents: [1,0,0,0], kind: "grid" },
            "accent-332": { name: "Accent 3+3+2", slotsPerBar: 8, accents: [1,0,0, 1,0,0, 1,0], kind: "grid" },
            "accent-323": { name: "Accent 3+2+3", slotsPerBar: 8, accents: [1,0,0, 1,0, 1,0,0], kind: "grid" },
            "accent-223": { name: "Accent 2+2+3", slotsPerBar: 8, accents: [1,0, 1,0, 1,0,0,0], kind: "grid" },
            "triplet-mix":{ name: "Mixed Subdivisions", slotsPerBar: 12, accents: [1,0,0, 0,1,0, 0,0,1, 0,0,0], kind: "grid" },
            "polyrhythm-32": {
                name: "Polyrhythm 3:2",
                kind: "poly",
                // Two independent grids over the same bar length
                // A: 2-beat grid (stronger timbre), B: 3-beat grid (different timbre)
                gridA: { count: 2, freq: 1800, gain: 0.28 },
                gridB: { count: 3, freq: 1100, gain: 0.20 }
            },
        };

        this.selectedPatternKey = localStorage.getItem("rhyth_pattern") || "basic";

        // Build UI and wire controls
        this._render();
        this._bindUI();
        this._renderPills(); // initial
    }

    // ---------- CDN Loading ----------
    async _loadSoundonika() {
        if (window.Soundonika) {
            return window.Soundonika;
        }

        try {
            this._updateStatus("Loading audio engine...");

            const script = document.createElement('script');
            script.src = this.soundonikaCDN;
            script.async = true;

            return new Promise((resolve, reject) => {
                script.onload = () => {
                    if (window.Soundonika) {
                        this._updateStatus("Audio engine loaded");
                        resolve(window.Soundonika);
                    } else {
                        reject(new Error('Soundonika failed to load'));
                    }
                };
                script.onerror = () => reject(new Error('Failed to load Soundonika from CDN'));
                document.head.appendChild(script);
            });
        } catch (error) {
            console.error('Failed to load Soundonika:', error);
            this._updateStatus("Failed to load audio engine");
            throw error;
        }
    }

    // ---------- Sample Path Detection ----------
    async _detectSamplePath() {
        this._updateStatus("Detecting sample location...");

        for (const path of this.samplePathCandidates) {
            try {
                console.log(`Trying sample path: ${path}`);
                const response = await fetch(`${path}/sample-index.json`);
                if (response.ok) {
                    console.log(`✅ Found samples at: ${path}`);
                    const pathType = path.includes('http') ? 'CDN' : 'local';
                    this._updateStatus(`Found samples (${pathType})`);
                    return path;
                }
            } catch (error) {
                console.log(`❌ Sample path failed: ${path} - ${error.message}`);
            }
        }

        throw new Error('No sample source found. Please ensure samples are available.');
    }

    // ---------- Render ----------
    _render() {
        this.root = document.createElement("div");
        this.root.className = "tonika-module rhythonika rhythonika--card";

        this.root.innerHTML = `
      <div class="rhythonika__header">
        <div class="rhythonika__title">Rhythonika</div>
        <div class="rhythonika__subtitle tonika-text-muted">Smart rhythm practice • lookahead scheduling</div>
      </div>

      <div class="rhythonika__controls">
        <div class="rhythonika__field">
          <label class="rhythonika__label">BPM</label>
          <input class="tonika-input rhythonika__bpm" type="number" min="20" max="400" step="1" value="${this.bpm}" />
        </div>

        <div class="rhythonika__field">
          <label class="rhythonika__label">Time Sig</label>
          <select class="tonika-select rhythonika__timesig">
            ${this._timesigOption({n:4,d:4})}
            ${this._timesigOption({n:3,d:4})}
            ${this._timesigOption({n:6,d:8})}
            ${this._timesigOption({n:5,d:4})}
          </select>
        </div>

        <div class="rhythonika__field rhythonika__field--grow">
          <label class="rhythonika__label">Pattern</label>
          <select class="tonika-select rhythonika__pattern">
            <option value="basic">Basic 4/4</option>
            <option value="accent-332">Accent Pattern 3+3+2</option>
            <option value="accent-323">Accent Pattern 3+2+3</option>
            <option value="accent-223">Accent Pattern 2+2+3</option>
            <option value="triplet-mix">Mixed Subdivisions</option>
            <option value="polyrhythm-32">Polyrhythm 3 over 2</option>
          </select>
        </div>

        <div class="rhythonika__transport">
          <button class="tonika-btn tonika-btn--primary rhythonika__startstop">Start</button>
        </div>
      </div>

      <div class="rhythonika__audio-controls">
        <div class="rhythonika__field">
          <label class="rhythonika__label">Sound</label>
          <select class="tonika-select rhythonika__sound-mode">
            <option value="clicks">Click Sounds</option>
            <option value="samples">Drum Samples</option>
          </select>
        </div>
        
        <div class="rhythonika__field">
          <label class="rhythonika__label">Volume</label>
          <input class="tonika-input rhythonika__volume" type="range" min="0" max="1" step="0.1" value="0.7" />
        </div>
        
        <div class="rhythonika__status">
          <span class="rhythonika__status-text">Ready</span>
        </div>
      </div>

      <div class="rhythonika__meter">
        <div class="rhythonika__pills" aria-label="Rhythm pattern pills"></div>
        <div class="rhythonika__legend tonika-text-muted"></div>
      </div>
    `;

        this.mount.innerHTML = "";
        this.mount.appendChild(this.root);

        // Set current UI selections
        const tsSel = this.root.querySelector(".rhythonika__timesig");
        tsSel.value = `${this.timeSignature.numerator}/${this.timeSignature.denominator}`;
        const patSel = this.root.querySelector(".rhythonika__pattern");
        patSel.value = this.selectedPatternKey;
    }

    _timesigOption({n,d}) {
        const v = `${n}/${d}`;
        const sel = (this.timeSignature.numerator === n && this.timeSignature.denominator === d) ? "selected" : "";
        return `<option value="${v}" ${sel}>${v}</option>`;
    }

    // ---------- UI Handlers ----------
    _bindUI() {
        this.btnStartStop  = this.root.querySelector(".rhythonika__startstop");
        this.inputBpm      = this.root.querySelector(".rhythonika__bpm");
        this.selectSig     = this.root.querySelector(".rhythonika__timesig");
        this.selectPattern = this.root.querySelector(".rhythonika__pattern");
        this.pillsWrap     = this.root.querySelector(".rhythonika__pills");
        this.legend        = this.root.querySelector(".rhythonika__legend");

        // Audio control elements
        this.selectSoundMode = this.root.querySelector(".rhythonika__sound-mode");
        this.inputVolume     = this.root.querySelector(".rhythonika__volume");
        this.statusText      = this.root.querySelector(".rhythonika__status-text");

        this.btnStartStop.addEventListener("click", () => this.isPlaying ? this.stop() : this.start());

        this.inputBpm.addEventListener("change", () => {
            this.bpm = Math.max(20, Math.min(400, Number(this.inputBpm.value) || 120));
            localStorage.setItem("rhyth_bpm", String(this.bpm));
            if (this.isPlaying) this._reprimeClock();
        });

        this.selectSig.addEventListener("change", () => {
            const [n, d] = this.selectSig.value.split("/").map(Number);
            this.timeSignature = { numerator: n, denominator: d };
            localStorage.setItem("rhyth_timesig", JSON.stringify(this.timeSignature));
            this.currentStep = 0;
            this._renderPills();
            if (this.isPlaying) this._reprimeClock();
        });

        this.selectPattern.addEventListener("change", () => {
            this.selectedPatternKey = this.selectPattern.value;
            localStorage.setItem("rhyth_pattern", this.selectedPatternKey);
            this.currentStep = 0;
            this._renderPills();
            if (this.isPlaying) this._reprimeClock();
        });

        // Audio control handlers
        this.selectSoundMode.addEventListener("change", async () => {
            if (this.audioEngine) {
                this._updateStatus("Switching sound mode...");
                try {
                    this.audioEngine.setSoundMode(this.selectSoundMode.value);
                    this._updateStatus(this.selectSoundMode.value === 'samples' ? "Using drum samples" : "Using click sounds");
                } catch (error) {
                    console.error("Failed to change sound mode:", error);
                    this._updateStatus("Error changing sound mode");
                }
            }
        });

        this.inputVolume.addEventListener("input", () => {
            if (this.audioEngine) {
                this.audioEngine.setVolume(parseFloat(this.inputVolume.value));
            }
        });

        // Space toggles transport for quick UX
        this._keyHandler = (e) => {
            if (e.code === "Space" && e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT') {
                e.preventDefault();
                this.isPlaying ? this.stop() : this.start();
            }
        };
        window.addEventListener("keydown", this._keyHandler);
    }

    // Initialize audio control UI state
    _initAudioUI() {
        if (this.audioEngine) {
            this.selectSoundMode.value = this.audioEngine.getSoundMode();
            this.inputVolume.value = this.audioEngine.getVolume();
            this._updateStatus(this.audioEngine.getSoundMode() === 'samples' ? "Ready with samples" : "Ready with clicks");
        }
    }

    // Update status text
    _updateStatus(text) {
        if (this.statusText) {
            this.statusText.textContent = text;
        }
    }

    // ---------- Pills (visual pattern) ----------
    _renderPills() {
        const key = this.selectedPatternKey;
        const pat = this.patterns[key];
        this.pillsWrap.innerHTML = "";

        if (!pat) return;

        if (pat.kind === "grid") {
            for (let i = 0; i < pat.slotsPerBar; i++) {
                const pill = document.createElement("button");
                pill.type = "button";
                pill.className = "rhythonika__pill";
                pill.setAttribute("aria-label", `slot ${i+1}`);
                pill.disabled = true; // visual only (for now)
                if (pat.accents[i]) pill.classList.add("rhythonika__pill--accent");
                this.pillsWrap.appendChild(pill);
            }
            this.legend.textContent = `${pat.name} • ${pat.slotsPerBar} slots`;
        } else {
            // Polyrhythm legend only (no single grid pills)
            // Shows a minimal dual-row hint
            const rowA = document.createElement("div");
            rowA.className = "rhythonika__polyrow";
            const rowB = document.createElement("div");
            rowB.className = "rhythonika__polyrow";

            for (let i = 0; i < pat.gridA.count; i++) {
                const dot = document.createElement("span");
                dot.className = "rhythonika__polydot rhythonika__polydot--a";
                rowA.appendChild(dot);
            }
            for (let j = 0; j < pat.gridB.count; j++) {
                const dot = document.createElement("span");
                dot.className = "rhythonika__polydot rhythonika__polydot--b";
                rowB.appendChild(dot);
            }
            this.pillsWrap.appendChild(rowA);
            this.pillsWrap.appendChild(rowB);
            this.legend.textContent = `${pat.name} • A:${pat.gridA.count} vs B:${pat.gridB.count}`;
        }
    }

    _highlightPill(stepIdx) {
        const pills = this.pillsWrap.querySelectorAll(".rhythonika__pill");
        pills.forEach((el, i) => el.classList.toggle("rhythonika__pill--active", i === (stepIdx % pills.length)));
    }

    // ---------- Audio scheduling ----------
    async start() {
        try {
            // Load Soundonika if needed
            if (!window.Soundonika) {
                await this._loadSoundonika();
            }

            // Initialize audio context and engine if needed
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

                // Create engine WITHOUT samples initially
                this.audioEngine = new window.Soundonika.Engine(this.audioContext);

                // Detect and configure sample path BEFORE initialization
                try {
                    const samplePath = await this._detectSamplePath();
                    // NOTE: This requires Soundonika to have setSampleBasePath method
                    if (this.audioEngine.setSampleBasePath) {
                        this.audioEngine.setSampleBasePath(samplePath);
                    } else {
                        console.warn('Soundonika does not support setSampleBasePath - samples may not load');
                    }
                } catch (error) {
                    console.warn('Sample detection failed, using click sounds only:', error);
                    this._updateStatus("Samples unavailable - using click sounds");
                    // Force click mode if samples can't be found
                    this.selectSoundMode.value = 'clicks';
                }

                this._updateStatus("Initializing audio engine...");
                await this.audioEngine.init();
                this._initAudioUI();
            }

            this.isPlaying = true;
            this.root.classList.add("rhythonika--playing");
            this.btnStartStop.textContent = "Stop";
            this.currentStep = 0;
            this._reprimeClock();
            this._updateStatus("Playing");

            // Visual metering (requestAnimationFrame loop)
            const raf = () => {
                if (!this.isPlaying) return;
                // For grid patterns only (pills)
                const pat = this.patterns[this.selectedPatternKey];
                if (pat && pat.kind === "grid") this._highlightPill(this.currentStep);
                this._rafId = requestAnimationFrame(raf);
            };
            this._rafId = requestAnimationFrame(raf);

        } catch (error) {
            console.error('Failed to start Rhythonika:', error);
            this._updateStatus("Failed to start - check console");
            return;
        }
    }

    stop() {
        this.isPlaying = false;
        this.root.classList.remove("rhythonika--playing");
        this.btnStartStop.textContent = "Start";
        if (this.intervalId) clearInterval(this.intervalId);
        if (this._rafId) cancelAnimationFrame(this._rafId);

        if (this.audioEngine) {
            this._updateStatus(this.audioEngine.getSoundMode() === 'samples' ? "Ready with samples" : "Ready with clicks");
        } else {
            this._updateStatus("Ready");
        }
    }

    _reprimeClock() {
        if (this.intervalId) clearInterval(this.intervalId);
        this.nextNoteTime = this.audioContext.currentTime + 0.05; // small lead-in
        this.intervalId = setInterval(() => this._scheduler(), this.lookahead);
    }

    _scheduler() {
        const now = this.audioContext.currentTime;
        while (this.nextNoteTime < now + this.scheduleAheadTime) {
            this._scheduleNext();
        }
    }

    _scheduleNext() {
        const patKey = this.selectedPatternKey;
        const pat = this.patterns[patKey];
        const secondsPerBeat = 60.0 / this.bpm;

        if (pat.kind === "grid") {
            // Derive slot duration based on time signature
            const beatsPerBar = this.timeSignature.numerator;
            const slotDur = (beatsPerBar / pat.slotsPerBar) * secondsPerBeat;

            const isAccent = !!pat.accents[this.currentStep % pat.slotsPerBar];

            // Use configured sound types
            const soundType = this.soundTypes[isAccent ? 'accent' : 'normal'];
            const velocity = isAccent ? 1.0 : 0.7;

            try {
                this.audioEngine.scheduleSound(this.nextNoteTime, soundType, velocity);
            } catch (error) {
                console.error('Failed to schedule sound:', error);
            }

            this.nextNoteTime += slotDur;
            this.currentStep = (this.currentStep + 1) % pat.slotsPerBar;

        } else {
            // Polyrhythm 3:2 over the same bar length
            const beatsPerBar = this.timeSignature.numerator;
            const barDur = beatsPerBar * secondsPerBeat;

            const lcmTicks = this._lcm(pat.gridA.count, pat.gridB.count);
            const tickDur = barDur / lcmTicks;
            const tick = this.currentStep % lcmTicks;

            try {
                // If tick aligns with A grid
                if (tick % (lcmTicks / pat.gridA.count) === 0) {
                    this.audioEngine.scheduleSound(this.nextNoteTime, this.soundTypes.polyA, pat.gridA.gain / 0.28);
                }
                // If tick aligns with B grid
                if (tick % (lcmTicks / pat.gridB.count) === 0) {
                    this.audioEngine.scheduleSound(this.nextNoteTime, this.soundTypes.polyB, pat.gridB.gain / 0.28);
                }
            } catch (error) {
                console.error('Failed to schedule polyrhythm sound:', error);
            }

            this.nextNoteTime += tickDur;
            this.currentStep = (this.currentStep + 1) % lcmTicks;
        }
    }

    _lcm(a, b) {
        const gcd = (x, y) => (y === 0 ? x : gcd(y, x % y));
        return Math.abs(a * b) / gcd(a, b);
    }

    // ---------- Cleanup ----------
    destroy() {
        if (this._keyHandler) {
            window.removeEventListener("keydown", this._keyHandler);
        }
        this.stop();
        if (this.audioEngine) {
            // Soundonika doesn't have a destroy method, but we can clean up references
            this.audioEngine = null;
        }
        if (this.audioContext) {
            this.audioContext.close();
        }
    }
}

// Attach to a Tonika registry on window for classic scripts
window.TonikaModules = window.TonikaModules || {};
window.TonikaModules.Rhythonika = Rhythonika;

