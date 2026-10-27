/**
 * Main Entry Point for Minion Colony.
 * Initializes AudioManager, ColonySim, BattleSim, GameRenderer, and UIManager.
 */

import { AudioManager } from "./audio/audio-manager.js";
import { GameRenderer } from "./render/renderer.js";
import { BattleSim } from "./sim/battle-sim.js";
import { ColonySim } from "./sim/colony-sim.js";
import { UIManager } from "./ui/ui-manager.js";

async function bootGame() {
  const canvas = document.getElementById("game-canvas");
  const audio = new AudioManager();
  const colony = new ColonySim(audio);
  const battle = new BattleSim(colony, audio);
  const renderer = new GameRenderer(canvas, colony, battle);
  const ui = new UIManager(colony, battle, renderer, audio);

  // Expose handle for automated Playwright QA & debugging
  window.__MINION_COLONY__ = {
    audio,
    colony,
    battle,
    renderer,
    ui
  };

  window.addEventListener("resize", () => renderer.resize());
  renderer.resize();

  await Promise.all([renderer.loadAssets(), audio.init()]);
  ui.init();

  let lastTime = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
    lastTime = now;

    if (!ui.uiState.inMainMenu) {
      colony.update(dt);
      battle.update(dt);
      ui.update(dt);
      renderer.render(ui.uiState);
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

bootGame();
