import { App, Plugin, PluginSettingTab, Setting } from "obsidian";

interface AutoplaySettings {
  autoplayAudio: boolean;
  autoplayVideo: boolean;
}

const DEFAULT_SETTINGS: AutoplaySettings = {
  autoplayAudio: true,
  autoplayVideo: true,
};

export default class AutoplayPlugin extends Plugin {
  settings: AutoplaySettings;

  async onload() {
    console.log("LOADED");

    await this.loadSettings();

    this.addSettingTab(new AutoplaySettingTab(this.app, this));

    this.registerInterval(
      window.setInterval(() => {
        const mediaElements = activeDocument.querySelectorAll("video, audio");
        mediaElements.forEach((mediaElement) => {
          const isVideo = mediaElement.tagName.toLowerCase() === "video";
          const isAudio = mediaElement.tagName.toLowerCase() === "audio";

          if ((isVideo && this.settings.autoplayVideo) || (isAudio && this.settings.autoplayAudio)) {
            (mediaElement as HTMLMediaElement).autoplay = true;
            (mediaElement as HTMLMediaElement).loop = true;
            (mediaElement as HTMLMediaElement).play();
          }
        });
      }, 1000)
    );
  }

  onunload() {
    console.log("UNLOADED");
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

    containerEl.createEl("h2", { text: "Autoplay Settings" });

    new Setting(containerEl)
      .setName("Autoplay Audio")
      .setDesc("Automatically play audio")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoplayAudio)
          .onChange(async (value) => {
            this.plugin.settings.autoplayAudio = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Autoplay Video")
      .setDesc("Automatically play video")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoplayVideo)
          .onChange(async (value) => {
            this.plugin.settings.autoplayVideo = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
