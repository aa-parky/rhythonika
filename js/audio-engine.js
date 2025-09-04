// js/audio-engine.js
// Modular audio engine for Rhythonika - handles both click sounds and drum samples

class AudioEngine {
    constructor(audioContext) {
        this.ctx = audioContext;
        this.soundMode = localStorage.getItem('rhyth_sound_mode') || 'clicks'; // 'clicks' or 'samples'
        this.volume = parseFloat(localStorage.getItem('rhyth_volume')) || 0.7;
        
        // Sample buffers storage
        this.samples = new Map();
        this.isLoading = false;
        this.loadingPromise = null;
        
        // Default sample selection (can be made configurable later)
        this.sampleConfig = {
            kick: 'DD5_Kick_01.wav',
            snare: 'DD5_Snare_01.wav',
            hihat_closed: 'DD5_CH_01.wav',
            hihat_open: 'DD5_OH_01.wav',
            perc: 'DD5_Perc_01.wav',
            shaker: 'DD5_Shk_01.wav'
        };
    }

    // Initialize and optionally preload samples
    async init() {
        if (this.soundMode === 'samples' && this.samples.size === 0) {
            await this.loadSamples();
        }
    }

    // Load drum samples
    async loadSamples() {
        if (this.isLoading) {
            return this.loadingPromise;
        }

        this.isLoading = true;
        this.loadingPromise = this._loadSamplesInternal();
        
        try {
            await this.loadingPromise;
        } finally {
            this.isLoading = false;
        }
        
        return this.loadingPromise;
    }

    async _loadSamplesInternal() {
        const loadPromises = [];
        
        for (const [sampleType, filename] of Object.entries(this.sampleConfig)) {
            const promise = this._loadSample(sampleType, filename);
            loadPromises.push(promise);
        }

        const results = await Promise.all(loadPromises);
        const successCount = results.filter(result => result).length;
        const totalCount = results.length;

        if (successCount === totalCount) {
            console.log('AudioEngine: All samples loaded successfully');
        } else if (successCount > 0) {
            console.log(`AudioEngine: ${successCount}/${totalCount} samples loaded successfully`);
        } else {
            console.warn('AudioEngine: No samples could be loaded, will use click sounds');
        }
    }

    async _loadSample(sampleType, filename) {
        try {
            const response = await fetch(`./samples/${filename}`);
            if (!response.ok) {
                console.warn(`AudioEngine: Failed to load ${sampleType} (${filename}): HTTP ${response.status}`);
                return false;
            }
            
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
            
            this.samples.set(sampleType, audioBuffer);
            console.log(`AudioEngine: Loaded ${sampleType} (${filename})`);
            return true;
        } catch (error) {
            console.warn(`AudioEngine: Failed to load ${sampleType} (${filename}):`, error.message);
            // Don't throw - allow other samples to load and fallback to click sounds
            return false;
        }
    }

    // Set sound mode and handle sample loading
    async setSoundMode(mode) {
        if (mode === this.soundMode) return;
        
        this.soundMode = mode;
        localStorage.setItem('rhyth_sound_mode', mode);
        
        if (mode === 'samples' && this.samples.size === 0) {
            await this.loadSamples();
        }
    }

    // Set master volume
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        localStorage.setItem('rhyth_volume', this.volume.toString());
    }

    // Main sound scheduling method
    scheduleSound(time, soundType, velocity = 1.0) {
        if (this.soundMode === 'clicks') {
            this._scheduleClick(time, soundType, velocity);
        } else {
            this._scheduleSample(time, soundType, velocity);
        }
    }

    // Original click sound implementation
    _scheduleClick(time, soundType, velocity = 1.0) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        // Map sound types to frequencies
        let freq;
        let gainLevel;
        
        switch (soundType) {
            case 'accent':
            case 'kick':
                freq = 2000;
                gainLevel = 0.28;
                break;
            case 'snare':
                freq = 1500;
                gainLevel = 0.22;
                break;
            case 'hihat':
            case 'hihat_closed':
                freq = 3000;
                gainLevel = 0.15;
                break;
            default:
                freq = 1000;
                gainLevel = 0.18;
        }

        osc.type = "square";
        osc.frequency.setValueAtTime(freq, time);

        // Apply velocity and master volume
        const finalGain = gainLevel * velocity * this.volume;
        
        // Envelope
        gain.gain.setValueAtTime(0.001, time);
        gain.gain.exponentialRampToValueAtTime(finalGain, time + 0.002);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

        osc.connect(gain).connect(this.ctx.destination);
        osc.start(time);
        osc.stop(time + 0.06);
    }

    // Sample playback implementation
    _scheduleSample(time, soundType, velocity = 1.0) {
        // Map sound types to sample types
        let sampleType = this._mapSoundTypeToSample(soundType);
        
        const buffer = this.samples.get(sampleType);
        if (!buffer) {
            // Fallback to click if sample not available
            console.warn(`AudioEngine: Sample ${sampleType} not loaded, falling back to click`);
            this._scheduleClick(time, soundType, velocity);
            return;
        }

        const source = this.ctx.createBufferSource();
        const gain = this.ctx.createGain();
        
        source.buffer = buffer;
        
        // Apply velocity and master volume
        const finalGain = velocity * this.volume;
        gain.gain.setValueAtTime(finalGain, time);
        
        source.connect(gain).connect(this.ctx.destination);
        source.start(time);
    }

    // Map Rhythonika sound types to sample types
    _mapSoundTypeToSample(soundType) {
        switch (soundType) {
            case 'accent':
            case 'kick':
                return 'kick';
            case 'snare':
                return 'snare';
            case 'hihat':
            case 'hihat_closed':
                return 'hihat_closed';
            case 'hihat_open':
                return 'hihat_open';
            case 'perc':
                return 'perc';
            case 'shaker':
                return 'shaker';
            default:
                return 'hihat_closed'; // Default fallback
        }
    }

    // Get current sound mode
    getSoundMode() {
        return this.soundMode;
    }

    // Get current volume
    getVolume() {
        return this.volume;
    }

    // Check if samples are loaded
// Get loading status
// Cleanup
}

// Export for browser globals
window.AudioEngine = AudioEngine;

