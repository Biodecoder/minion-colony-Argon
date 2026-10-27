/**
 * Headless Chromium Playwright Visual & Functional QA Suite for Minion Colony.
 * Verifies zero console/page errors, drives all major game views, and captures
 * pixel-accurate screenshots for visual comparison against Steam reference screenshots.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { startServer } from "../server.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARTIFACTS_DIR = path.join(__dirname, "artifacts");

async function runQa() {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

  const { server, url } = await startServer(0);
  const consoleErrors = [];
  const pageErrors = [];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });
  page.on("pageerror", (err) => {
    pageErrors.push(err.message || String(err));
  });

  try {
    console.log(`Navigating to ${url} ...`);
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForSelector("#btn-menu-demo-preset");
    await page.waitForTimeout(400);

    // 1. Main Menu Screenshot
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "01_main_menu.png") });
    console.log("Captured 01_main_menu.png");

    // 1b. Audit Check: Start a brand-new game ("Begin"), verify starter characters are visible,
    // verify +Spawn button recruits a character, and verify starting Mission 1 from a fresh game works!
    await page.click("#btn-menu-quick-begin");
    await page.waitForSelector("#colony-ui-layer:not(.hidden)");
    await page.waitForTimeout(300);

    const newGameMinionCount = await page.evaluate(() => window.__MINION_COLONY__.colony.minions.length);
    if (newGameMinionCount < 6) {
      throw new Error(`Expected >= 6 visible starter minions on New Game, got ${newGameMinionCount}`);
    }

    // Click +Spawn on Goblin card and verify count increases
    await page.click('.btn-quick-spawn-minion[data-id="Goblin"]');
    const afterSpawnCount = await page.evaluate(() => window.__MINION_COLONY__.colony.minions.length);
    if (afterSpawnCount !== newGameMinionCount + 1) {
      throw new Error(`Expected +Spawn button to increase minion count from ${newGameMinionCount} to ${newGameMinionCount + 1}, got ${afterSpawnCount}`);
    }

    // Open Missions from New Game -> Prepare Formation -> test canvas tile click -> Start Battle
    await page.click("#mission-drawer-btn");
    await page.waitForSelector("#mission-modal:not(.hidden)");
    await page.click('.btn-select-mission[data-mid="savage_duo"]');
    await page.waitForSelector("#formation-overlay:not(.hidden)");

    // Verify auto-fill placed units on Formation open, and test physical mouse click on occupied tile (-1, 0) then empty tile (-2, 0)
    const occupiedScreenPos = await page.evaluate(() => {
      const app = window.__MINION_COLONY__;
      return app.renderer.worldToScreen(-1 * 24, 0 * 24, true);
    });
    const beforeClickCount = await page.evaluate(() => window.__MINION_COLONY__.battle.formation.length);
    await page.mouse.click(occupiedScreenPos.x, occupiedScreenPos.y);
    const afterRemoveCount = await page.evaluate(() => window.__MINION_COLONY__.battle.formation.length);
    if (afterRemoveCount !== beforeClickCount - 1) {
      throw new Error(`Expected canvas click at occupied tile (-1,0) screen (${occupiedScreenPos.x}, ${occupiedScreenPos.y}) to remove slot (${beforeClickCount} -> ${beforeClickCount - 1}), got ${afterRemoveCount}`);
    }

    const emptyScreenPos = await page.evaluate(() => {
      const app = window.__MINION_COLONY__;
      return app.renderer.worldToScreen(-2 * 24, 0 * 24, true);
    });
    await page.mouse.click(emptyScreenPos.x, emptyScreenPos.y);
    const afterPlaceCount = await page.evaluate(() => window.__MINION_COLONY__.battle.formation.length);
    if (afterPlaceCount !== beforeClickCount) {
      throw new Error(`Expected canvas click at empty tile (-2,0) to place slot (${afterRemoveCount} -> ${beforeClickCount}), got ${afterPlaceCount}`);
    }

    // Start Battle from New Game and verify transition to IN_PROGRESS
    await page.click("#btn-formation-start");
    await page.waitForSelector("#battle-hud:not(.hidden)");
    await page.click("#btn-battle-abort");

    // Return to Main Menu to capture Thriving Colony Preset showcase screenshots
    await page.evaluate(() => {
      const app = window.__MINION_COLONY__;
      app.ui.uiState.inMainMenu = true;
      app.ui.renderMainMenu();
    });
    await page.waitForSelector("#btn-menu-demo-preset");

    // 2. Launch Thriving Colony Preset
    await page.click("#btn-menu-demo-preset");
    await page.waitForSelector("#colony-ui-layer:not(.hidden)");
    await page.waitForTimeout(1200);

    // Toggle courier route arrows on & hover a minion card for rich tooltip
    await page.click("#btn-qol-routes");
    await page.hover('.sidebar-item-card[data-id="LightningMage"]');
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "02_thriving_colony.png") });
    console.log("Captured 02_thriving_colony.png");

    // 3. Open 3-Column Building Inspector on Mine III
    await page.evaluate(() => {
      const app = window.__MINION_COLONY__;
      app.ui.hideRichTooltip();
      app.ui.uiState.showAllRoutes = false;
      const mine = app.colony.buildings.find((b) => b.type === "Mine");
      if (mine) {
        app.ui.uiState.selectedBuildingId = mine.id;
        app.ui.renderBuildingInspector();
      }
    });
    await page.waitForSelector("#building-inspector-modal:not(.hidden)");
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "03_building_inspector.png") });
    console.log("Captured 03_building_inspector.png");

    // Close inspector & open Mission Select Modal
    await page.click("#btn-close-inspector");
    await page.click("#mission-drawer-btn");
    await page.waitForSelector("#mission-modal:not(.hidden)");
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "04_mission_select.png") });
    console.log("Captured 04_mission_select.png");

    // 5. Open Formation Editor on Mission 4 (Wizard Expedition) or Mission 5 (Local Bandits II)
    await page.click('.btn-select-mission[data-mid="local_bandits_2"]');
    await page.waitForSelector("#formation-overlay:not(.hidden)");
    await page.click("#btn-formation-autofill");
    // Equip a couple of enchanted weapons onto our front-line units
    await page.evaluate(() => {
      const app = window.__MINION_COLONY__;
      for (const slot of app.battle.formation.slice(0, 3)) {
        if (app.colony.equipment.length > 0) {
          app.battle.selectedEquipmentUid = app.colony.equipment[0].uid;
          app.battle.equipSelectedOnSlot(slot);
        }
      }
      app.ui.renderFormationOverlay();
      app.ui.updateFormationPreviewCard(-1, 0);
    });
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "05_formation_editor.png") });
    console.log("Captured 05_formation_editor.png");

    // 6. Start Battle and capture live Auto-Battler Combat with VFX & HP bars
    await page.click("#btn-formation-start");
    await page.waitForSelector("#battle-hud:not(.hidden)");
    await page.waitForTimeout(1600);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "06_auto_battler_combat.png") });
    console.log("Captured 06_auto_battler_combat.png");

    if (consoleErrors.length > 0 || pageErrors.length > 0) {
      console.error("Console Errors:", consoleErrors);
      console.error("Page Errors:", pageErrors);
      process.exitCode = 1;
    } else {
      console.log("QA Verification Passed with 0 console/page errors!");
    }
  } finally {
    await browser.close();
    server.close();
  }
}

runQa();
