import { Plugin } from "obsidian";

export default class AutoplayPlugin extends Plugin {
  async onload() {
	console.log("LOADED");
	this.registerInterval(
		window.setInterval(() => {
			const videoElements = activeDocument.querySelectorAll("video");
			videoElements.forEach((videoElement) => {
				// Set the autoplay and loop attributes for each video element
				videoElement.autoplay = true;
				videoElement.loop = true;
				videoElement.play();
			});
		}, 1000)
	  );
  }
}