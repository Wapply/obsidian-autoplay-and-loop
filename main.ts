import { App, Plugin, PluginSettingTab, Setting } from "obsidian";

interface AutoplaySettings {
  autoplayAudio: boolean;
  autoplayVideo: boolean;
  loopAudio: boolean;
  loopVideo: boolean;
  muteAutoplayedAudio: boolean;
  muteAutoplayedVideo: boolean;
  singlePlaybackAudio: boolean;
  singlePlaybackVideo: boolean;
  pauseOutOfViewAudio: boolean;
  pauseOutOfViewVideo: boolean;
}

const DEFAULT_SETTINGS: AutoplaySettings = {
  autoplayAudio: true,
  autoplayVideo: true,
  loopAudio: true,
  loopVideo: true,
  muteAutoplayedAudio: false,
  muteAutoplayedVideo: true,
  singlePlaybackAudio: true,
  singlePlaybackVideo: false,
  pauseOutOfViewAudio: true,
  pauseOutOfViewVideo: true,
};

export default class AutoplayPlugin extends Plugin {
  settings: AutoplaySettings;
  observer: IntersectionObserver;
  visibleMedia: Map<HTMLMediaElement, number> = new Map();

  async onload() {
    console.log("LOADED");

    await this.loadSettings();

    this.addSettingTab(new AutoplaySettingTab(this.app, this));

    this.setupObserver();

    this.registerInterval(
      window.setInterval(() => {
        const mediaElements = activeDocument.querySelectorAll("video, audio");
        mediaElements.forEach((mediaElement) => {
          const el = mediaElement as HTMLMediaElement;
          const isVideo = el.tagName.toLowerCase() === "video";
          const isAudio = el.tagName.toLowerCase() === "audio";

          // Handle Looping (Always apply current setting)
          if (isVideo) {
            el.loop = this.settings.loopVideo;
          } else if (isAudio) {
            el.loop = this.settings.loopAudio;
          }

          // Register with observer if not already done
          if (!el.dataset.autoplayObserved) {
            this.observer.observe(el);
            el.dataset.autoplayObserved = "true";
          }
        });
      }, 1000)
    );
  }

  setupObserver() {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const el = entry.target as HTMLMediaElement;
          const isVideo = el.tagName.toLowerCase() === "video";
          const isAudio = el.tagName.toLowerCase() === "audio";

          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            this.visibleMedia.set(el, entry.intersectionRatio);
            if (isVideo) {
              this.updateMediaPlayback('video');
            } else if (isAudio) {
              this.updateMediaPlayback('audio');
            }
          } else {
            // Not intersecting or below threshold
            this.visibleMedia.delete(el);
            if (isVideo) {
              if (this.settings.pauseOutOfViewVideo) el.pause();
            } else if (isAudio) {
              if (this.settings.pauseOutOfViewAudio) el.pause();
            }
            // Reset manual pause if it leaves view, so it can autoplay again when back
            el.dataset.manualPause = "false";
          }
        });

        // Setup manual pause detection
        entries.forEach((entry) => {
          const el = entry.target as HTMLMediaElement;
          if (!el.dataset.pauseListener) {
            el.addEventListener('pause', () => {
              if (el.dataset.syncingPlayback === "true") return;
              const currentRatio = this.visibleMedia.get(el) || 0;
              if (currentRatio >= 0.5) {
                el.dataset.manualPause = "true";
              }
            });
            el.addEventListener('play', () => {
              el.dataset.manualPause = "false";
            });
            el.dataset.pauseListener = "true";
          }
        });
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1.0] }
    );
  }

  updateMediaPlayback(type: 'audio' | 'video') {
    const isAudio = type === 'audio';
    const settings = this.settings;
    const isAutoplay = isAudio ? settings.autoplayAudio : settings.autoplayVideo;
    const isSingle = isAudio ? settings.singlePlaybackAudio : settings.singlePlaybackVideo;
    const isMute = isAudio ? settings.muteAutoplayedAudio : settings.muteAutoplayedVideo;

    const typedVisible = Array.from(this.visibleMedia.entries())
      .filter(([el]) => el.tagName.toLowerCase() === type);

    let bestMedia: HTMLMediaElement | null = null;
    let maxRatio = -1;

    if (isSingle) {
      for (const [el, ratio] of typedVisible) {
        if (ratio > maxRatio) {
          maxRatio = ratio;
          bestMedia = el;
        }
      }

      // Pause others
      for (const [el] of typedVisible) {
        if (el !== bestMedia) {
          el.dataset.syncingPlayback = "true";
          el.pause();
          el.dataset.syncingPlayback = "false";
        }
      }
    }

    // Play candidates
    for (const [el] of typedVisible) {
      if (!isAutoplay) continue;
      if (isSingle && el !== bestMedia) continue;
      if (el.dataset.manualPause === "true") continue;

      if (isMute && !el.dataset.autoplayMuted) {
        el.muted = true;
        el.dataset.autoplayMuted = "true";
      }
      el.play().catch((e: any) => console.log(`Autoplay ${type} failed`, e));
    }
  }

  onunload() {
    console.log("UNLOADED");
    if (this.observer) this.observer.disconnect();
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class AutoplaySettingTab extends PluginSettingTab {
  plugin: AutoplayPlugin;

  constructor(app: App, plugin: AutoplayPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    containerEl.createEl("h2", { text: "Autoplay & Loop Settings" });

    // --- Audio ---
    containerEl.createEl("h3", { text: "Audio" });

    new Setting(containerEl)
      .setName("Autoplay Audio")
      .setDesc("Automatically play audio when it becomes visible.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoplayAudio)
          .onChange(async (value) => {
            this.plugin.settings.autoplayAudio = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Single Audio Playback")
      .setDesc("Only play one audio track at a time (closest to center).")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.singlePlaybackAudio)
          .onChange(async (value) => {
            this.plugin.settings.singlePlaybackAudio = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Pause Audio Out of View")
      .setDesc("Pause audio when you scroll away.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.pauseOutOfViewAudio)
          .onChange(async (value) => {
            this.plugin.settings.pauseOutOfViewAudio = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Loop Audio")
      .setDesc("Repeat audio indefinitely.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.loopAudio)
          .onChange(async (value) => {
            this.plugin.settings.loopAudio = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Mute Autoplayed Audio")
      .setDesc("Mute audio when it starts automatically.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.muteAutoplayedAudio)
          .onChange(async (value) => {
            this.plugin.settings.muteAutoplayedAudio = value;
            await this.plugin.saveSettings();
          })
      );

    // --- Video ---
    containerEl.createEl("h3", { text: "Video" });

    new Setting(containerEl)
      .setName("Autoplay Video")
      .setDesc("Automatically play video when it becomes visible.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoplayVideo)
          .onChange(async (value) => {
            this.plugin.settings.autoplayVideo = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Single Video Playback")
      .setDesc("Only play one video at a time (closest to center).")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.singlePlaybackVideo)
          .onChange(async (value) => {
            this.plugin.settings.singlePlaybackVideo = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Pause Video Out of View")
      .setDesc("Pause video when you scroll away.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.pauseOutOfViewVideo)
          .onChange(async (value) => {
            this.plugin.settings.pauseOutOfViewVideo = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Loop Video")
      .setDesc("Repeat video indefinitely.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.loopVideo)
          .onChange(async (value) => {
            this.plugin.settings.loopVideo = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Mute Autoplayed Video")
      .setDesc("Mute video when it starts automatically.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.muteAutoplayedVideo)
          .onChange(async (value) => {
            this.plugin.settings.muteAutoplayedVideo = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
