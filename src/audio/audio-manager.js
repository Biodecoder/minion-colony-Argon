/**
 * Audio Manager for Minion Colony.
 * Plays extracted .m4a music & sound effects with 4 independent volume channels
 * (Music, Colony SFX, Battle SFX, UI SFX) and procedural WebAudio fallback.
 */

export class AudioManager {
  constructor() {
    this.manifest = {};
    this.currentMusic = null;
    this.currentMusicKey = null;
    this.unlocked = false;

    this.volumes = {
      music: 0.65,
      colonySfx: 0.8,
      battleSfx: 0.8,
      uiSfx: 0.8
    };
    this.lastPlayedAt = new Map();
  }

  setManifest(audioManifest) {
    this.manifest = audioManifest || {};
  }

  async init(manifestUrl = "assets/audio/audio_manifest.json") {
    try {
      const res = await fetch(manifestUrl);
      if (res.ok) {
        const data = await res.json();
        this.manifest = data.clips || data || {};
      }
    } catch {
      this.manifest = {};
    }
  }

  setVolume(channel, val) {
    if (this.volumes[channel] !== undefined) {
      this.volumes[channel] = Math.max(0, Math.min(1, Number(val) || 0));
    }
    if (channel === "music" && this.currentMusic) {
      this.currentMusic.volume = this.volumes.music;
    }
  }

  stopMusic() {
    if (this.currentMusic) {
      this.currentMusic.pause();
      this.currentMusic = null;
      this.currentMusicKey = null;
    }
  }

  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    if (this.currentMusic && this.currentMusic.paused) {
      this.currentMusic.play().catch(() => {});
    }
  }

  setVolumes(vols = {}) {
    if (vols.musicVolume !== undefined) this.volumes.music = vols.musicVolume;
    if (vols.colonySfxVolume !== undefined) this.volumes.colonySfx = vols.colonySfxVolume;
    if (vols.battleSfxVolume !== undefined) this.volumes.battleSfx = vols.battleSfxVolume;
    if (vols.uiSfxVolume !== undefined) this.volumes.uiSfx = vols.uiSfxVolume;
    if (this.currentMusic) {
      this.currentMusic.volume = Math.max(0, Math.min(1, this.volumes.music));
    }
  }

  resolveClipUrl(name) {
    if (!this.manifest) return null;
    if (this.manifest[name]) return this.manifest[name];
    const lower = name.toLowerCase();
    for (const [k, url] of Object.entries(this.manifest)) {
      if (k.toLowerCase() === lower) return url;
    }
    return null;
  }

  playMusicTrack(name, loop = true) {
    if (typeof Audio === "undefined") return;
    const url = this.resolveClipUrl(name);
    if (!url) return;
    if (this.currentMusicKey === name && this.currentMusic) {
      this.currentMusic.volume = Math.max(0, Math.min(1, this.volumes.music));
      return;
    }
    if (this.currentMusic) {
      this.currentMusic.pause();
      this.currentMusic = null;
    }
    try {
      const audio = new Audio(url);
      audio.loop = loop;
      audio.volume = Math.max(0, Math.min(1, this.volumes.music));
      this.currentMusic = audio;
      this.currentMusicKey = name;
      if (this.unlocked) {
        audio.play().catch(() => {});
      }
    } catch {
      // Ignore audio errors in headless environments
    }
  }

  startColonyMusic() {
    this.playMusicTrack("main music loop", true);
  }

  startBattleMusic() {
    this.playMusicTrack("battle loop", true);
  }

  playVictoryMusic() {
    this.playMusicTrack("victory loop", false);
  }

  playClip(name, channelVolume = 0.8, minIntervalMs = 45) {
    if (typeof Audio === "undefined" || channelVolume <= 0.01) return;
    const now = performance.now();
    const prev = this.lastPlayedAt.get(name) || 0;
    if (now - prev < minIntervalMs) return;
    this.lastPlayedAt.set(name, now);

    const url = this.resolveClipUrl(name);
    if (!url) return;
    try {
      const sfx = new Audio(url);
      sfx.volume = Math.max(0, Math.min(1, channelVolume));
      sfx.play().catch(() => {});
    } catch {
      // Ignore in headless environments
    }
  }

  playColonySfx(name) {
    this.playClip(name, this.volumes.colonySfx, 55);
  }

  playBattleSfx(name) {
    this.playClip(name, this.volumes.battleSfx, 45);
  }

  playUiSfx(name) {
    this.playClip(name, this.volumes.uiSfx, 30);
  }
}
