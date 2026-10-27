/**
 * Complete UI Manager and Input Controller for Minion Colony.
 * Manages all HUD panels, 3-column Building Inspector, Store House Item Filter,
 * Formation Editor, Auto-Battler HUD, Mission Select, Task Scaling Reference,
 * Settings/Save Slots, and Canvas Mouse/Keyboard interactions.
 */

import {
  ARMOUR_TIERS,
  BUILDINGS,
  DECORATIONS,
  ENCHANTMENTS,
  MINION_TYPES,
  MISSIONS,
  RESOURCES,
  TASK_WEIGHTS,
  WEAPON_TIERS,
  computeTaskGrade
} from "../data/game-data.js";
import { t } from "../data/localization.js";

const SPRITE_FILE = (key) => `assets/sprites/${key}.png`;

export class UIManager {
  constructor(colonySim, battleSim, renderer, audio) {
    this.colony = colonySim;
    this.battle = battleSim;
    this.renderer = renderer;
    this.audio = audio;

    this.uiState = {
      inMainMenu: true,
      activeSaveSlot: 1,
      recruitMultiplier: 1, // 1, 5, or 10
      sidebarTab: "Minions", // Minions, Buildings, Decoration
      selectedBuildingId: null,
      hoveredBuildingId: null,
      moveGoodsSourceId: null,
      pendingMoveDestId: null,
      showAllRoutes: false,
      commandStep: null, // null, 'SELECT_WORK_TARGET', 'SELECT_MOVE_SOURCE', 'SELECT_MOVE_DEST'
      worldMouse: { x: 18 * 24, y: 12 * 24 },
      placementMode: null, // null, 'MINION', 'BUILDING', 'DECOR', 'MOVE_BUILDING'
      placementType: null,
      movingBuildingId: null,
      selectedMinionIds: new Set(),
      dragBox: null,
      quickSellDecorMode: false,
      hoveredFormationTile: null,
      upgradeModalBuildingId: null
    };

    // Panning state
    this.isPanning = false;
    this.panStart = { x: 0, y: 0, camX: 0, camY: 0 };
    this.isBoxDragging = false;
    this.boxStart = { x: 0, y: 0 };
    this.keysDown = new Set();

    // Pending Store House filter state
    this.filterDraft = {
      anyResource: true,
      anyWeapon: true,
      anyArmour: true,
      allowEnchanted: true,
      threshold: 0,
      whitelist: null
    };

    this.lastHudRefresh = 0;
  }

  init() {
    this.bindCanvasEvents();
    this.bindKeyboardEvents();
    this.bindStaticUiEvents();
    this.renderMainMenu();
    this.renderSidebar();
    this.refreshAllPanels(true);
  }

  isBattleViewActive() {
    return (
      !this.uiState.inMainMenu &&
      (this.battle.state === "FORMATION" ||
        ((this.battle.state === "IN_PROGRESS" || this.battle.state === "FINISHED") && !this.battle.inBackground))
    );
  }

  bindCanvasEvents() {
    const canvas = this.renderer.canvas;

    canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      this.cancelActiveModes();
    });

    canvas.addEventListener("mousemove", (e) => {
      const isBattle = this.isBattleViewActive();
      const world = this.renderer.screenToWorld(e.clientX, e.clientY, isBattle);
      this.uiState.worldMouse = world;

      if (this.isPanning) {
        const dx = e.clientX - this.panStart.x;
        const dy = e.clientY - this.panStart.y;
        const cam = isBattle ? this.renderer.battleCamera : this.renderer.camera;
        cam.x = this.panStart.camX - dx / cam.zoom;
        cam.y = this.panStart.camY - dy / cam.zoom;
        return;
      }

      if (isBattle) {
        if (this.battle.state === "FORMATION") {
          const tilePx = 28;
          const gx = Math.floor((world.x + tilePx * 0.5) / tilePx);
          const gy = Math.floor((world.y + tilePx * 0.5) / tilePx);
          if (gx >= -5 && gx <= 5 && gy >= -2 && gy <= 2) {
            this.uiState.hoveredFormationTile = { gx, gy };
            this.updateFormationPreviewCard(gx, gy);
          } else {
            this.uiState.hoveredFormationTile = null;
          }
        }
        return;
      }

      // Colony view hover & drag box
      if (this.isBoxDragging && this.boxStart) {
        this.uiState.dragBox = {
          x1: this.boxStart.x,
          y1: this.boxStart.y,
          x2: e.clientX,
          y2: e.clientY
        };
      }

      // Hovered building detection
      const hoveredB = this.findBuildingAtWorld(world.x, world.y);
      this.uiState.hoveredBuildingId = hoveredB ? hoveredB.id : null;
    });

    canvas.addEventListener("mousedown", (e) => {
      if (this.uiState.inMainMenu) return;
      this.audio.unlock();

      // Middle mouse button or Space+Left or Alt+Left pans camera
      if (e.button === 1 || (e.button === 0 && (e.altKey || this.keysDown.has("Space")))) {
        e.preventDefault();
        const isBattle = this.isBattleViewActive();
        const cam = isBattle ? this.renderer.battleCamera : this.renderer.camera;
        this.isPanning = true;
        this.panStart = { x: e.clientX, y: e.clientY, camX: cam.x, camY: cam.y };
        return;
      }

      if (e.button === 2) {
        this.cancelActiveModes();
        return;
      }

      if (e.button !== 0) return;

      const isBattle = this.isBattleViewActive();
      const world = this.renderer.screenToWorld(e.clientX, e.clientY, isBattle);
      this.uiState.worldMouse = world;

      if (isBattle) {
        if (this.battle.state === "FORMATION") {
          const tilePx = 28;
          const gx = Math.floor((world.x + tilePx * 0.5) / tilePx);
          const gy = Math.floor((world.y + tilePx * 0.5) / tilePx);
          if (gx >= -5 && gx <= -1 && gy >= -2 && gy <= 2) {
            this.battle.placeOrEquipAtFormationTile(gx, gy);
            this.renderFormationOverlay();
            this.updateFormationPreviewCard(gx, gy);
            this.refreshTopLeftHud();
          }
        }
        return;
      }

      // Colony View Left Click Handling
      this.handleColonyLeftMouseDown(e, world);
    });

    window.addEventListener("mouseup", (e) => {
      if (this.isPanning) {
        this.isPanning = false;
      }
      if (this.isBoxDragging) {
        this.finishBoxSelection(e);
      }
    });

    canvas.addEventListener(
      "wheel",
      (e) => {
        if (this.uiState.inMainMenu) return;
        e.preventDefault();
        const isBattle = this.isBattleViewActive();
        const cam = isBattle ? this.renderer.battleCamera : this.renderer.camera;
        const factor = e.deltaY < 0 ? 1.12 : 0.89;
        cam.zoom = Math.max(cam.minZoom || 1.4, Math.min(cam.maxZoom || 4.0, cam.zoom * factor));
      },
      { passive: false }
    );
  }

  handleColonyLeftMouseDown(e, world) {
    const tileSize = this.colony.tileSize;
    const gx = Math.floor(world.x / tileSize);
    const gy = Math.floor(world.y / tileSize);

    // 1. Quick-Sell Decor mode
    if (this.uiState.quickSellDecorMode) {
      const decor = this.findDecorationAtWorld(world.x, world.y);
      if (decor) {
        this.colony.sellDecoration(decor.id);
        this.refreshAllPanels(true);
      }
      return;
    }

    // 2. Active Command Target Selection (Work or Move Goods)
    if (this.uiState.commandStep) {
      const targetB = this.findBuildingAtWorld(world.x, world.y);
      if (!targetB) {
        this.audio.playUiSfx("denied");
        return;
      }

      const minionIds = Array.from(this.uiState.selectedMinionIds);
      if (minionIds.length === 0) {
        this.uiState.commandStep = null;
        this.renderCommandPopup();
        return;
      }

      if (this.uiState.commandStep === "SELECT_WORK_TARGET") {
        const assigned = this.colony.commandWork(minionIds, targetB.id);
        if (assigned > 0) {
          this.uiState.commandStep = null;
          this.uiState.selectedMinionIds.clear();
          this.refreshAllPanels(true);
        } else {
          this.audio.playUiSfx("denied");
        }
        return;
      }

      if (this.uiState.commandStep === "SELECT_MOVE_SOURCE") {
        this.uiState.moveGoodsSourceId = targetB.id;
        this.uiState.commandStep = "SELECT_MOVE_DEST";
        this.audio.playUiSfx("click");
        this.renderCommandPopup();
        return;
      }

      if (this.uiState.commandStep === "SELECT_MOVE_DEST") {
        const fromId = this.uiState.moveGoodsSourceId;
        if (!fromId || fromId === targetB.id) {
          this.audio.playUiSfx("denied");
          return;
        }
        const fromB = this.colony.getBuilding(fromId);
        if (fromB && fromB.type === "StoreHouse") {
          // Open Store House Filter Modal so player can configure filters & threshold
          this.uiState.pendingMoveDestId = targetB.id;
          this.openStoreHouseFilterModal();
          return;
        }
        this.colony.commandMoveGoods(minionIds, fromId, targetB.id, null);
        this.uiState.commandStep = null;
        this.uiState.moveGoodsSourceId = null;
        this.uiState.selectedMinionIds.clear();
        this.refreshAllPanels(true);
        return;
      }
    }

    // 3. Active Placement Mode (Minion, Building, Decoration, Move Building)
    if (this.uiState.placementMode) {
      const mode = this.uiState.placementMode;
      const type = this.uiState.placementType;

      if (mode === "MINION") {
        if (!this.colony.isTileCleared(gx, gy)) {
          this.audio.playUiSfx("denied");
          return;
        }
        const spawned = this.colony.recruitMinion(type, world.x, world.y, this.uiState.recruitMultiplier);
        if (spawned.length === 0) {
          this.audio.playUiSfx("denied");
        }
        this.refreshAllPanels(true);
        return;
      }

      if (mode === "BUILDING") {
        const def = BUILDINGS[type];
        if (!def) return;
        const bGx = Math.floor(world.x / tileSize - def.footprint.w * 0.5 + 0.5);
        const bGy = Math.floor(world.y / tileSize - def.footprint.h * 0.5 + 0.5);
        const placed = this.colony.placeBuilding(type, bGx, bGy);
        if (placed) {
          if (!e.shiftKey) {
            this.uiState.placementMode = null;
            this.uiState.placementType = null;
          }
          this.refreshAllPanels(true);
        } else {
          this.audio.playUiSfx("denied");
        }
        return;
      }

      if (mode === "DECOR") {
        const def = DECORATIONS[type];
        if (!def) return;
        const dGx = def.isLandClear ? gx : Math.floor(world.x / tileSize - def.footprint.w * 0.5 + 0.5);
        const dGy = def.isLandClear ? gy : Math.floor(world.y / tileSize - def.footprint.h * 0.5 + 0.5);
        const placed = this.colony.placeDecoration(type, dGx, dGy);
        if (placed) {
          this.refreshAllPanels(true);
        } else {
          this.audio.playUiSfx("denied");
        }
        return;
      }

      if (mode === "MOVE_BUILDING") {
        const b = this.colony.getBuilding(this.uiState.movingBuildingId);
        if (!b) {
          this.cancelActiveModes();
          return;
        }
        const newGx = Math.floor(world.x / tileSize - b.w * 0.5 + 0.5);
        const newGy = Math.floor(world.y / tileSize - b.h * 0.5 + 0.5);
        if (this.colony.moveBuilding(b.id, newGx, newGy)) {
          this.uiState.placementMode = null;
          this.uiState.movingBuildingId = null;
          this.refreshAllPanels(true);
        } else {
          this.audio.playUiSfx("denied");
        }
        return;
      }
    }

    // 4. Default: start box-drag or click minion / building
    this.isBoxDragging = true;
    this.boxStart = { x: e.clientX, y: e.clientY };
    this.uiState.dragBox = { x1: e.clientX, y1: e.clientY, x2: e.clientX, y2: e.clientY };
  }

  finishBoxSelection(e) {
    const box = this.uiState.dragBox;
    this.isBoxDragging = false;
    this.uiState.dragBox = null;
    if (!box) return;

    const dist = Math.hypot(box.x2 - box.x1, box.y2 - box.y1);
    const world = this.renderer.screenToWorld(e.clientX, e.clientY, false);

    if (dist < 6) {
      // Single click: check if a minion is under cursor first
      const clickedMinion = this.findMinionAtWorld(world.x, world.y);
      if (clickedMinion) {
        if (!e.shiftKey) this.uiState.selectedMinionIds.clear();
        this.uiState.selectedMinionIds.add(clickedMinion.id);
        this.uiState.selectedBuildingId = null;
        this.audio.playUiSfx("pop");
        this.renderBuildingInspector();
        this.renderCommandPopup();
        return;
      }

      // Next check if a building was clicked
      const clickedBuilding = this.findBuildingAtWorld(world.x, world.y);
      if (clickedBuilding) {
        this.uiState.selectedMinionIds.clear();
        this.uiState.selectedBuildingId = clickedBuilding.id;
        this.audio.playUiSfx("click");
        this.renderCommandPopup();
        this.renderBuildingInspector();
        return;
      }

      // Clicked empty ground
      this.uiState.selectedMinionIds.clear();
      this.uiState.selectedBuildingId = null;
      this.renderCommandPopup();
      this.renderBuildingInspector();
      return;
    }

    // Box selection in screen coordinates
    const minX = Math.min(box.x1, box.x2);
    const maxX = Math.max(box.x1, box.x2);
    const minY = Math.min(box.y1, box.y2);
    const maxY = Math.max(box.y1, box.y2);

    if (!e.shiftKey) this.uiState.selectedMinionIds.clear();
    for (const m of this.colony.minions) {
      const scr = this.renderer.worldToScreen(m.x, m.y, false);
      if (scr.x >= minX && scr.x <= maxX && scr.y >= minY && scr.y <= maxY) {
        this.uiState.selectedMinionIds.add(m.id);
      }
    }
    if (this.uiState.selectedMinionIds.size > 0) {
      this.uiState.selectedBuildingId = null;
      this.audio.playUiSfx("pop");
    }
    this.renderBuildingInspector();
    this.renderCommandPopup();
  }

  findBuildingAtWorld(wx, wy) {
    const ts = this.colony.tileSize;
    for (let i = this.colony.buildings.length - 1; i >= 0; i--) {
      const b = this.colony.buildings[i];
      const bx = b.gx * ts;
      const by = b.gy * ts;
      const bw = b.w * ts;
      const bh = b.h * ts;
      if (wx >= bx && wx <= bx + bw && wy >= by && wy <= by + bh) {
        return b;
      }
    }
    return null;
  }

  findDecorationAtWorld(wx, wy) {
    const ts = this.colony.tileSize;
    for (let i = this.colony.decorations.length - 1; i >= 0; i--) {
      const d = this.colony.decorations[i];
      const dx = d.gx * ts;
      const dy = d.gy * ts;
      const dw = d.w * ts;
      const dh = d.h * ts;
      if (wx >= dx && wx <= dx + dw && wy >= dy && wy <= dy + dh) {
        return d;
      }
    }
    return null;
  }

  findMinionAtWorld(wx, wy) {
    let best = null;
    let bestDist = 14;
    for (const m of this.colony.minions) {
      const d = Math.hypot(m.x - wx, m.y - wy);
      if (d < bestDist) {
        bestDist = d;
        best = m;
      }
    }
    return best;
  }

  cancelActiveModes() {
    this.uiState.placementMode = null;
    this.uiState.placementType = null;
    this.uiState.movingBuildingId = null;
    this.uiState.commandStep = null;
    this.uiState.moveGoodsSourceId = null;
    this.uiState.pendingMoveDestId = null;
    this.uiState.quickSellDecorMode = false;
    this.uiState.selectedMinionIds.clear();
    this.uiState.selectedBuildingId = null;
    if (this.battle.state === "FORMATION" && this.battle.selectedEquipmentUid) {
      this.battle.selectedEquipmentUid = null;
      this.renderFormationOverlay();
    }
    this.renderSidebar();
    this.renderCommandPopup();
    this.renderBuildingInspector();
  }

  bindKeyboardEvents() {
    window.addEventListener("keydown", (e) => {
      this.keysDown.add(e.code);
      if (e.key === "Escape") {
        if (
          this.uiState.placementMode ||
          this.uiState.commandStep ||
          this.uiState.selectedBuildingId ||
          this.uiState.selectedMinionIds.size > 0 ||
          this.uiState.quickSellDecorMode
        ) {
          this.cancelActiveModes();
        } else if (!this.uiState.inMainMenu) {
          this.toggleSettingsModal();
        }
      } else if (e.key === "r" || e.key === "R") {
        if (!this.uiState.inMainMenu && !this.isBattleViewActive()) {
          this.uiState.showAllRoutes = !this.uiState.showAllRoutes;
          this.renderSidebar();
        }
      }
    });

    window.addEventListener("keyup", (e) => {
      this.keysDown.delete(e.code);
    });
  }

  updateCameraKeyboard(dt) {
    if (this.uiState.inMainMenu) return;
    const isBattle = this.isBattleViewActive();
    if (isBattle) return;

    const speed = 260 / this.renderer.camera.zoom;
    let dx = 0;
    let dy = 0;
    if (this.keysDown.has("KeyW") || this.keysDown.has("ArrowUp")) dy -= 1;
    if (this.keysDown.has("KeyS") || this.keysDown.has("ArrowDown")) dy += 1;
    if (this.keysDown.has("KeyA") || this.keysDown.has("ArrowLeft")) dx -= 1;
    if (this.keysDown.has("KeyD") || this.keysDown.has("ArrowRight")) dx += 1;

    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy);
      this.renderer.camera.x += (dx / len) * speed * dt;
      this.renderer.camera.y += (dy / len) * speed * dt;
    }
  }

  bindStaticUiEvents() {
    // Top-right settings / save button
    const btnSettings = document.getElementById("btn-open-settings");
    if (btnSettings) {
      btnSettings.addEventListener("click", () => {
        this.audio.playUiSfx("click");
        this.toggleSettingsModal();
      });
    }

    // Task scaling reference (?) button
    const btnTaskHelp = document.getElementById("btn-task-scaling");
    if (btnTaskHelp) {
      btnTaskHelp.addEventListener("click", () => {
        this.audio.playUiSfx("click");
        this.openTaskScalingModal();
      });
    }

    // Bottom Mission Drawer button
    const btnMissions = document.getElementById("mission-drawer-btn");
    if (btnMissions) {
      btnMissions.addEventListener("click", () => {
        this.audio.playUiSfx("click");
        this.handleMissionDrawerClick();
      });
    }
  }

  // =========================================================================
  // MAIN MENU & SAVE SLOTS
  // =========================================================================
  renderMainMenu() {
    const el = document.getElementById("main-menu-overlay");
    if (!el) return;
    if (!this.uiState.inMainMenu) {
      el.classList.add("hidden");
      return;
    }
    el.classList.remove("hidden");

    const slotsHtml = [1, 2, 3]
      .map((slot) => {
        const summary = this.colony.getSlotSummary(slot);
        if (!summary) {
          return `
            <div class="save-slot-card" data-slot="${slot}">
              <div class="save-slot-title">${t("menu.saveFile", { num: slot })}</div>
              <div class="save-slot-meta">New Colony</div>
              <div class="save-slot-actions">
                <button class="pixel-btn primary btn-start-slot" data-slot="${slot}">${t("menu.begin")}</button>
              </div>
            </div>
          `;
        }
        return `
          <div class="save-slot-card" data-slot="${slot}">
            <div class="save-slot-title">${t("menu.saveFile", { num: slot })}</div>
            <div class="save-slot-meta">
              <span><img src="${SPRITE_FILE("icon_coin")}" class="inline-icon" alt=""> ${summary.gold}g</span>
              <span><img src="${SPRITE_FILE("minion_icon_goblin")}" class="inline-icon" alt=""> ${summary.minionsCount}</span>
              <span>Missions: ${summary.missionsCleared}/10</span>
            </div>
            <div class="save-slot-actions">
              <button class="pixel-btn primary btn-load-slot" data-slot="${slot}">Continue</button>
              <button class="pixel-btn danger btn-erase-slot" data-slot="${slot}">${t("menu.eraseSave")}</button>
            </div>
          </div>
        `;
      })
      .join("");

    el.innerHTML = `
      <div class="menu-parallax-bg">
        <div class="parallax-layer layer-back"></div>
        <div class="parallax-layer layer-mid"></div>
        <div class="parallax-layer layer-front"></div>
      </div>
      <div class="menu-center-card pixel-panel">
        <img src="assets/sprites/tex_logo_flattened.png" class="menu-logo-img" alt="Minion Colony">
        <div class="menu-subtitle">Fantasy Colony Builder &amp; Tactical Auto-Battler</div>
        <div class="save-slots-row">
          ${slotsHtml}
        </div>
        <div class="menu-bottom-row">
          <button id="btn-menu-quick-begin" class="pixel-btn primary lg">${t("menu.begin")}</button>
          <button id="btn-menu-demo-preset" class="pixel-btn gold lg" title="Start with an advanced colony showcase">Thriving Colony Preset</button>
        </div>
      </div>
    `;

    el.querySelectorAll(".btn-start-slot").forEach((btn) => {
      btn.addEventListener("click", () => {
        const slot = Number(btn.dataset.slot) || 1;
        this.startNewGameInSlot(slot);
      });
    });

    el.querySelectorAll(".btn-load-slot").forEach((btn) => {
      btn.addEventListener("click", () => {
        const slot = Number(btn.dataset.slot) || 1;
        this.loadGameFromSlot(slot);
      });
    });

    el.querySelectorAll(".btn-erase-slot").forEach((btn) => {
      btn.addEventListener("click", () => {
        const slot = Number(btn.dataset.slot) || 1;
        this.colony.eraseSlot(slot);
        this.audio.playUiSfx("click");
        this.renderMainMenu();
      });
    });

    const quickBegin = document.getElementById("btn-menu-quick-begin");
    if (quickBegin) {
      quickBegin.addEventListener("click", () => {
        this.startNewGameInSlot(1);
      });
    }

    const demoPreset = document.getElementById("btn-menu-demo-preset");
    if (demoPreset) {
      demoPreset.addEventListener("click", () => {
        this.startThrivingPresetInSlot(2);
      });
    }
  }

  startNewGameInSlot(slot = 1) {
    this.audio.unlock();
    this.audio.playUiSfx("click");
    this.uiState.activeSaveSlot = slot;
    this.colony.resetNewGame();
    this.uiState.inMainMenu = false;
    this.audio.startColonyMusic();
    this.renderMainMenu();
    this.refreshAllPanels(true);
  }

  loadGameFromSlot(slot = 1) {
    this.audio.unlock();
    this.audio.playUiSfx("click");
    this.uiState.activeSaveSlot = slot;
    if (!this.colony.loadFromSlot(slot)) {
      this.colony.resetNewGame();
    }
    this.uiState.inMainMenu = false;
    this.audio.startColonyMusic();
    this.renderMainMenu();
    this.refreshAllPanels(true);
  }

  startThrivingPresetInSlot(slot = 2) {
    this.audio.unlock();
    this.audio.playUiSfx("click");
    this.uiState.activeSaveSlot = slot;
    this.colony.resetNewGame();
    this.colony.gold = 3500;
    this.colony.tutorialCompleted = true;
    this.colony.tutorialStep = 8;
    // Unlock all buildings, minions, decorations, enchantments
    [
      "Goblin",
      "Troll",
      "LightningMage",
      "Sapling",
      "Cyclops",
      "Demon",
      "Giant",
      "Mine",
      "Farm",
      "Smith",
      "Armourer",
      "WizardTower",
      "FlowerG",
      "Pillar",
      "Well",
      "Fountain",
      "FlowerC",
      "Fireplace",
      "Buyland",
      "Lifesteal",
      "BurningStrikes",
      "Thorns",
      "Rend"
    ].forEach((k) => this.colony.unlocks.add(k));

    this.colony.resources.Metal = 85;
    this.colony.resources.Carrot = 60;
    this.colony.resources.GoldenCarrot = 8;
    this.colony.resources.Amethyst = 5;
    this.colony.resources.Sapphire = 3;
    this.colony.resources.Ruby = 2;

    // Place a thriving colony layout (non-overlapping with StoreHouse 16..18,10..12, Barracks 10..13,9..13, Market 16..18,5..6)
    const mine = this.colony.placeBuilding("Mine", 10, 14);
    const farm = this.colony.placeBuilding("Farm", 20, 13);
    const smith = this.colony.placeBuilding("Smith", 20, 9);
    const armourer = this.colony.placeBuilding("Armourer", 11, 5);
    const wizard = this.colony.placeBuilding("WizardTower", 20, 4);

    if (mine) mine.level = 3;
    if (farm) farm.level = 2;
    if (smith) {
      smith.level = 3;
      smith.selectedRecipeIndex = 2;
    }
    if (armourer) {
      armourer.level = 2;
      armourer.selectedRecipeIndex = 1;
    }
    if (wizard) {
      wizard.level = 2;
      wizard.selectedEnchantment = "BurningStrikes";
    }

    this.colony.placeDecoration("Well", 14, 14);
    this.colony.placeDecoration("Fountain", 17, 14);
    this.colony.placeDecoration("Fireplace", 14, 8);
    this.colony.placeDecoration("FlowerG", 19, 8);
    this.renderer.camera.x = 16.5 * 24;
    this.renderer.camera.y = 11.2 * 24;
    this.renderer.camera.zoom = 1.95;

    // Spawn workers & couriers
    if (mine) {
      const miners = this.colony.recruitMinion("Troll", mine.x, mine.y + 16, 2);
      this.colony.commandWork(
        miners.map((m) => m.id),
        mine.id
      );
      const mineCouriers = this.colony.recruitMinion("Goblin", mine.x, mine.y + 20, 2);
      this.colony.commandMoveGoods(
        mineCouriers.map((m) => m.id),
        mine.id,
        this.colony.storeHouse.id
      );
    }
    if (farm) {
      const farmers = this.colony.recruitMinion("Sapling", farm.x, farm.y + 16, 2);
      this.colony.commandWork(
        farmers.map((m) => m.id),
        farm.id
      );
      const farmCouriers = this.colony.recruitMinion("Goblin", farm.x, farm.y + 20, 2);
      this.colony.commandMoveGoods(
        farmCouriers.map((m) => m.id),
        farm.id,
        this.colony.marketBuilding.id
      );
    }
    if (smith) {
      const smiths = this.colony.recruitMinion("Demon", smith.x, smith.y + 16, 1);
      this.colony.commandWork(
        smiths.map((m) => m.id),
        smith.id
      );
      const smithIn = this.colony.recruitMinion("Goblin", smith.x, smith.y + 20, 1);
      this.colony.commandMoveGoods(
        smithIn.map((m) => m.id),
        this.colony.storeHouse.id,
        smith.id
      );
      const smithOut = this.colony.recruitMinion("Goblin", smith.x, smith.y + 24, 1);
      this.colony.commandMoveGoods(
        smithOut.map((m) => m.id),
        smith.id,
        this.colony.storeHouse.id
      );
    }

    // Add pre-crafted weapons & armour + enchanted gear to Store House
    this.colony.depositItemToStoreHouse(this.colony.createEquipmentItem(WEAPON_TIERS[2], "BurningStrikes"));
    this.colony.depositItemToStoreHouse(this.colony.createEquipmentItem(WEAPON_TIERS[1], "Lifesteal"));
    this.colony.depositItemToStoreHouse(this.colony.createEquipmentItem(WEAPON_TIERS[3], "Rend"));
    this.colony.depositItemToStoreHouse(this.colony.createEquipmentItem(ARMOUR_TIERS[2], "Thorns"));
    this.colony.depositItemToStoreHouse(this.colony.createEquipmentItem(ARMOUR_TIERS[1], null));

    // Populate Barracks with an army ready for missions
    this.colony.barracks = {
      Goblin: 8,
      Troll: 4,
      LightningMage: 4,
      Sapling: 3,
      Cyclops: 2,
      Demon: 2,
      Giant: 1
    };

    this.uiState.inMainMenu = false;
    this.audio.startColonyMusic();
    this.renderMainMenu();
    this.refreshAllPanels(true);
  }

  // =========================================================================
  // PERIODIC & EVENT-DRIVEN REFRESH
  // =========================================================================
  update(dt) {
    this.updateCameraKeyboard(dt);
    this.lastHudRefresh += dt;
    if (this.lastHudRefresh >= 0.2) {
      this.lastHudRefresh = 0;
      this.refreshAllPanels(false);
    }
  }

  refreshAllPanels(forceFull = false) {
    if (this.uiState.inMainMenu) return;

    const isBattleView = this.isBattleViewActive();
    const colonyUiRoot = document.getElementById("colony-ui-layer");
    const formationOverlay = document.getElementById("formation-overlay");
    const battleHud = document.getElementById("battle-hud");

    if (colonyUiRoot) colonyUiRoot.classList.toggle("hidden", isBattleView);
    if (formationOverlay) formationOverlay.classList.toggle("hidden", this.battle.state !== "FORMATION");
    if (battleHud) {
      battleHud.classList.toggle(
        "hidden",
        !(
          (this.battle.state === "IN_PROGRESS" || this.battle.state === "FINISHED") &&
          !this.battle.inBackground
        )
      );
    }

    this.refreshTopLeftHud();
    this.refreshTutorialBanner();
    this.refreshMissionDrawer();

    if (forceFull) {
      this.renderSidebar();
      this.renderCommandPopup();
      this.renderBuildingInspector();
    } else if (this.uiState.selectedBuildingId) {
      this.updateBuildingInspectorLiveValues();
    }

    if (this.battle.state === "FORMATION" && forceFull) {
      this.renderFormationOverlay();
    }
    if ((this.battle.state === "IN_PROGRESS" || this.battle.state === "FINISHED") && !this.battle.inBackground) {
      this.refreshBattleHud();
    }
    if (this.battle.state === "FINISHED" && !this.battle.inBackground) {
      this.renderBattleSummaryModal();
    } else {
      const sumModal = document.getElementById("battle-summary-modal");
      if (sumModal) sumModal.classList.add("hidden");
    }
  }

  // =========================================================================
  // TOP-LEFT HUD & TASK SCALING MODAL
  // =========================================================================
  refreshTopLeftHud() {
    const goldEl = document.getElementById("hud-gold-val");
    const minionsEl = document.getElementById("hud-minions-val");
    const moraleEl = document.getElementById("hud-morale-val");
    const moraleEffEl = document.getElementById("hud-morale-eff");
    const resListEl = document.getElementById("hud-resources-list");

    const totalBarracks = Object.values(this.colony.barracks).reduce((a, b) => a + b, 0);
    const totalMinions = this.colony.minions.length + totalBarracks;

    if (goldEl) goldEl.textContent = Math.floor(this.colony.gold).toLocaleString();
    if (minionsEl) minionsEl.textContent = `${this.colony.minions.length} (+${totalBarracks} Barracks)`;
    if (moraleEl) moraleEl.textContent = `${this.colony.moraleScore}`;
    if (moraleEffEl) {
      const pct = Math.round(this.colony.moraleEfficiency * 100);
      moraleEffEl.textContent = `${pct}% Eff`;
    }

    if (resListEl) {
      resListEl.innerHTML = Object.values(RESOURCES)
        .map((r) => {
          const count = this.colony.resources[r.id] || 0;
          return `
            <div class="hud-res-row" title="${t(r.nameKey)} (Sells for ${r.sellGold}g at Market)">
              <img src="${SPRITE_FILE(r.sprite)}" class="inline-icon" alt="">
              <span class="hud-res-name">${t(r.nameKey)}</span>
              <span class="hud-res-count">${count}</span>
            </div>
          `;
        })
        .join("");
    }
  }

  openTaskScalingModal() {
    const modal = document.getElementById("task-scaling-modal");
    if (!modal) return;
    modal.classList.remove("hidden");

    const rows = Object.entries(TASK_WEIGHTS)
      .map(([task, weights]) => {
        const weightStr = Object.entries(weights)
          .map(([stat, w]) => `<span class="stat-pill">${stat} ×${Math.round(w * 100)}%</span>`)
          .join(" ");
        return `
          <tr>
            <td><strong>${task}</strong></td>
            <td>${weightStr}</td>
          </tr>
        `;
      })
      .join("");

    modal.innerHTML = `
      <div class="modal-card pixel-panel">
        <div class="modal-header">
          <span>${t("hud.taskScaling")}</span>
          <button class="pixel-btn sm" id="btn-close-task-scaling">X</button>
        </div>
        <div class="modal-body">
          <p class="modal-desc">${t("hud.moraleDesc")}</p>
          <table class="pixel-table">
            <thead>
              <tr><th>Colony Task</th><th>Primary Stat Weights</th></tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="grade-legend-row">
            <span class="grade-badge grade-S">S (1.75×)</span>
            <span class="grade-badge grade-A">A (1.40×)</span>
            <span class="grade-badge grade-B">B (1.15×)</span>
            <span class="grade-badge grade-C">C (1.00×)</span>
            <span class="grade-badge grade-D">D (0.85×)</span>
            <span class="grade-badge grade-F">F (0.70×)</span>
          </div>
        </div>
      </div>
    `;

    document.getElementById("btn-close-task-scaling")?.addEventListener("click", () => {
      modal.classList.add("hidden");
    });
  }

  // =========================================================================
  // 7-STEP TUTORIAL BANNER
  // =========================================================================
  refreshTutorialBanner() {
    const el = document.getElementById("tutorial-banner");
    if (!el) return;
    if (this.colony.tutorialCompleted || this.colony.tutorialStep > 7) {
      el.classList.add("hidden");
      return;
    }
    el.classList.remove("hidden");

    const step = this.colony.tutorialStep;
    const text = t(`tutorial.step${step}`);
    el.innerHTML = `
      <div class="tutorial-step-badge">Tutorial ${step}/7</div>
      <div class="tutorial-step-text">${text}</div>
      <button id="btn-skip-tutorial" class="pixel-btn sm">${t("tutorial.skip")}</button>
    `;

    document.getElementById("btn-skip-tutorial")?.addEventListener("click", () => {
      this.colony.tutorialCompleted = true;
      this.colony.tutorialStep = 8;
      this.audio.playUiSfx("click");
      this.refreshTutorialBanner();
    });
  }

  // =========================================================================
  // RIGHT SIDEBAR (MINIONS, BUILDINGS, DECORATION) & QOL TOOLBAR
  // =========================================================================
  renderSidebar() {
    const container = document.getElementById("right-sidebar");
    if (!container) return;

    const tab = this.uiState.sidebarTab;
    const mult = this.uiState.recruitMultiplier;

    let itemsHtml = "";
    if (tab === "Minions") {
      const recruitable = Object.values(MINION_TYPES).filter((m) => m.recruitable);
      itemsHtml = `
        <div class="recruit-mult-bar">
          <span>Batch:</span>
          ${[1, 5, 10]
            .map(
              (n) =>
                `<button class="pixel-btn sm ${mult === n ? "active" : ""} btn-mult" data-mult="${n}">×${n}</button>`
            )
            .join("")}
        </div>
        <div class="sidebar-cards-list">
          ${recruitable
            .map((m) => {
              const unlocked = m.unlockedAtStart || this.colony.isUnlocked(m.unlockKey || m.id);
              const selected =
                this.uiState.placementMode === "MINION" && this.uiState.placementType === m.id;
              const cost = m.cost * mult;
              return `
                <div class="sidebar-item-card ${unlocked ? "" : "locked"} ${selected ? "selected" : ""}"
                     data-kind="MINION" data-id="${m.id}">
                  <img src="${SPRITE_FILE(m.icon)}" class="sidebar-card-icon" alt="">
                  <div class="sidebar-card-info">
                    <div class="sidebar-card-title">${t(m.nameKey)}</div>
                    <div class="sidebar-card-cost">
                      <img src="${SPRITE_FILE("icon_coin")}" class="inline-icon" alt=""> ${cost}g
                    </div>
                  </div>
                  ${
                    unlocked
                      ? `<button class="pixel-btn sm primary btn-quick-spawn-minion" data-id="${m.id}" title="Spawn immediately in Colony">+Spawn</button>`
                      : `<img src="${SPRITE_FILE("ui_icon_unlock")}" class="lock-icon" alt="Locked">`
                  }
                </div>
              `;
            })
            .join("")}
        </div>
      `;
    } else if (tab === "Buildings") {
      const placeable = Object.values(BUILDINGS).filter((b) => b.placeable);
      itemsHtml = `
        <div class="sidebar-cards-list">
          ${placeable
            .map((b) => {
              const unlocked = b.unlockedAtStart || this.colony.isUnlocked(b.unlockKey || b.id);
              const selected =
                this.uiState.placementMode === "BUILDING" && this.uiState.placementType === b.id;
              return `
                <div class="sidebar-item-card ${unlocked ? "" : "locked"} ${selected ? "selected" : ""}"
                     data-kind="BUILDING" data-id="${b.id}">
                  <img src="${SPRITE_FILE(b.sprite)}" class="sidebar-card-icon" alt="">
                  <div class="sidebar-card-info">
                    <div class="sidebar-card-title">${t(b.nameKey)}</div>
                    <div class="sidebar-card-cost">
                      <img src="${SPRITE_FILE("icon_coin")}" class="inline-icon" alt=""> ${b.cost}g
                    </div>
                  </div>
                  ${!unlocked ? `<img src="${SPRITE_FILE("ui_icon_unlock")}" class="lock-icon" alt="Locked">` : ""}
                </div>
              `;
            })
            .join("")}
        </div>
      `;
    } else if (tab === "Decoration") {
      const decors = Object.values(DECORATIONS);
      itemsHtml = `
        <div class="sidebar-cards-list">
          ${decors
            .map((d) => {
              const unlocked = d.unlockedAtStart || this.colony.isUnlocked(d.unlockKey || d.id);
              const selected =
                this.uiState.placementMode === "DECOR" && this.uiState.placementType === d.id;
              const cost = d.isLandClear ? this.colony.getBuyLandCost() : d.cost;
              return `
                <div class="sidebar-item-card ${unlocked ? "" : "locked"} ${selected ? "selected" : ""}"
                     data-kind="DECOR" data-id="${d.id}">
                  <img src="${SPRITE_FILE(d.sprite)}" class="sidebar-card-icon" alt="">
                  <div class="sidebar-card-info">
                    <div class="sidebar-card-title">${t(d.nameKey)}</div>
                    <div class="sidebar-card-cost">
                      <img src="${SPRITE_FILE("icon_coin")}" class="inline-icon" alt=""> ${cost}g
                      ${d.moraleBonus ? `<span class="morale-tag">+${d.moraleBonus} Morale</span>` : ""}
                    </div>
                  </div>
                  ${!unlocked ? `<img src="${SPRITE_FILE("ui_icon_unlock")}" class="lock-icon" alt="Locked">` : ""}
                </div>
              `;
            })
            .join("")}
        </div>
      `;
    }

    container.innerHTML = `
      <div class="sidebar-tabs">
        <button class="sidebar-tab-btn ${tab === "Minions" ? "active" : ""}" data-tab="Minions">${t("hud.minions")}</button>
        <button class="sidebar-tab-btn ${tab === "Buildings" ? "active" : ""}" data-tab="Buildings">${t("hud.buildings")}</button>
        <button class="sidebar-tab-btn ${tab === "Decoration" ? "active" : ""}" data-tab="Decoration">${t("hud.decoration")}</button>
      </div>
      <div class="sidebar-body">
        ${itemsHtml}
      </div>
      <div class="sidebar-qol-footer">
        <button id="btn-qol-idle-barracks" class="pixel-btn sm full-w" title="Send all idle colony minions to Barracks">
          <img src="${SPRITE_FILE("ui_icon_swords")}" class="inline-icon" alt=""> Idle -> Barracks
        </button>
        <div class="qol-row">
          <button id="btn-qol-routes" class="pixel-btn sm ${this.uiState.showAllRoutes ? "active" : ""}" title="Toggle courier route arrows (R)">
            <img src="${SPRITE_FILE("ui_icon_move")}" class="inline-icon" alt=""> Routes
          </button>
          <button id="btn-qol-sell-decor" class="pixel-btn sm ${this.uiState.quickSellDecorMode ? "danger" : ""}" title="Click decorations to sell">
            <img src="${SPRITE_FILE("ui_icon_bin")}" class="inline-icon" alt=""> Sell Decor
          </button>
        </div>
      </div>
    `;

    // Bind tab switches
    container.querySelectorAll(".sidebar-tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.uiState.sidebarTab = btn.dataset.tab;
        this.audio.playUiSfx("click");
        this.renderSidebar();
      });
    });

    // Bind batch multiplier buttons
    container.querySelectorAll(".btn-mult").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.uiState.recruitMultiplier = Number(btn.dataset.mult) || 1;
        this.audio.playUiSfx("click");
        this.renderSidebar();
      });
    });

    // Bind item cards
    container.querySelectorAll(".sidebar-item-card").forEach((card) => {
      const kind = card.dataset.kind;
      const id = card.dataset.id;

      card.addEventListener("mouseenter", (e) => {
        this.showRichTooltip(kind, id, e.clientX, e.clientY);
      });
      card.addEventListener("mouseleave", () => {
        this.hideRichTooltip();
      });

      card.addEventListener("click", (e) => {
        if (e.target.closest(".btn-quick-spawn-minion")) return;
        if (card.classList.contains("locked")) {
          this.audio.playUiSfx("denied");
          return;
        }
        if (this.uiState.placementMode === kind && this.uiState.placementType === id) {
          this.uiState.placementMode = null;
          this.uiState.placementType = null;
        } else {
          this.uiState.placementMode = kind;
          this.uiState.placementType = id;
          this.uiState.quickSellDecorMode = false;
          this.uiState.commandStep = null;
        }
        this.audio.playUiSfx("click");
        this.renderSidebar();
      });
    });

    container.querySelectorAll(".btn-quick-spawn-minion").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const race = btn.dataset.id;
        const sh = this.colony.storeHouse;
        const sx = (sh ? sh.x : 17.5 * this.colony.tileSize) + (Math.random() - 0.5) * 28;
        const sy = (sh ? sh.y : 11.5 * this.colony.tileSize) + 28 + (Math.random() - 0.5) * 14;
        const spawned = this.colony.recruitMinion(race, sx, sy, this.uiState.recruitMultiplier);
        if (spawned.length === 0) {
          this.audio.playUiSfx("denied");
        }
        this.refreshAllPanels(true);
      });
    });

    document.getElementById("btn-qol-idle-barracks")?.addEventListener("click", () => {
      const sent = this.colony.sendAllIdleToBarracks();
      if (sent > 0) {
        this.audio.playUiSfx("pop");
        this.refreshAllPanels(true);
      } else {
        this.audio.playUiSfx("denied");
      }
    });

    document.getElementById("btn-qol-routes")?.addEventListener("click", () => {
      this.uiState.showAllRoutes = !this.uiState.showAllRoutes;
      this.audio.playUiSfx("click");
      this.renderSidebar();
    });

    document.getElementById("btn-qol-sell-decor")?.addEventListener("click", () => {
      this.uiState.quickSellDecorMode = !this.uiState.quickSellDecorMode;
      if (this.uiState.quickSellDecorMode) {
        this.uiState.placementMode = null;
        this.uiState.placementType = null;
      }
      this.audio.playUiSfx("click");
      this.renderSidebar();
    });
  }

  showRichTooltip(kind, id, clientX, clientY) {
    const tip = document.getElementById("rich-tooltip");
    if (!tip) return;

    let html = "";
    if (kind === "MINION") {
      const m = MINION_TYPES[id];
      if (!m) return;
      const unlocked = m.unlockedAtStart || this.colony.isUnlocked(m.unlockKey || m.id);
      const tasks = ["Mining", "Farming", "Crafting", "Enchanting", "Carrying"];
      const gradesHtml = tasks
        .map((task) => {
          const g = computeTaskGrade(m.stats, task);
          return `<div class="tip-grade-item"><span>${task}</span><span class="grade-badge grade-${g.grade}">${g.grade}</span></div>`;
        })
        .join("");

      html = `
        <div class="tip-header">
          <img src="${SPRITE_FILE(m.icon)}" class="tip-icon" alt="">
          <div>
            <div class="tip-title">${t(m.nameKey)}</div>
            <div class="tip-cost">${m.cost} Gold</div>
          </div>
        </div>
        <div class="tip-desc">${t(m.descKey)}</div>
        <div class="tip-stats-grid">
          <span>STR: <b>${m.stats.STR}</b></span>
          <span>DEX: <b>${m.stats.DEX}</b></span>
          <span>INT: <b>${m.stats.INT}</b></span>
          <span>WIS: <b>${m.stats.WIS}</b></span>
          <span>CON: <b>${m.stats.CON}</b></span>
          <span>CHA: <b>${m.stats.CHA}</b></span>
        </div>
        <div class="tip-grades-box">${gradesHtml}</div>
        <div class="tip-combat-line">
          HP: ${m.maxHealth} | Dmg: ${m.baseDamageLabel} | CD: ${m.cooldown}s | Rng: ${m.range}
        </div>
        ${!unlocked ? `<div class="tip-locked-note">Unlock by completing Missions</div>` : ""}
      `;
    } else if (kind === "BUILDING") {
      const b = BUILDINGS[id];
      if (!b) return;
      const unlocked = b.unlockedAtStart || this.colony.isUnlocked(b.unlockKey || b.id);
      html = `
        <div class="tip-header">
          <img src="${SPRITE_FILE(b.sprite)}" class="tip-icon" alt="">
          <div>
            <div class="tip-title">${t(b.nameKey)}</div>
            <div class="tip-cost">${b.cost} Gold (${b.footprint.w}×${b.footprint.h})</div>
          </div>
        </div>
        <div class="tip-desc">${t(b.descKey)}</div>
        ${b.task ? `<div class="tip-combat-line">Task Scaling: <b>${b.task}</b></div>` : ""}
        ${!unlocked ? `<div class="tip-locked-note">Unlock by completing Missions</div>` : ""}
      `;
    } else if (kind === "DECOR") {
      const d = DECORATIONS[id];
      if (!d) return;
      const cost = d.isLandClear ? this.colony.getBuyLandCost() : d.cost;
      html = `
        <div class="tip-header">
          <img src="${SPRITE_FILE(d.sprite)}" class="tip-icon" alt="">
          <div>
            <div class="tip-title">${t(d.nameKey)}</div>
            <div class="tip-cost">${cost} Gold</div>
          </div>
        </div>
        <div class="tip-desc">${t(d.descKey)}</div>
        ${d.moraleBonus ? `<div class="tip-combat-line">Morale Bonus: <b>+${d.moraleBonus} Morale</b></div>` : ""}
      `;
    }

    tip.innerHTML = html;
    tip.classList.remove("hidden");
    const top = Math.min(window.innerHeight - 280, Math.max(12, clientY - 40));
    tip.style.top = `${top}px`;
    tip.style.right = `245px`;
  }

  hideRichTooltip() {
    const tip = document.getElementById("rich-tooltip");
    if (tip) tip.classList.add("hidden");
  }

  // =========================================================================
  // SELECTION COMMAND POPUP & STORE HOUSE FILTER MODAL
  // =========================================================================
  renderCommandPopup() {
    const el = document.getElementById("command-popup");
    if (!el) return;

    const count = this.uiState.selectedMinionIds.size;
    if (count === 0 || this.isBattleViewActive()) {
      el.classList.add("hidden");
      return;
    }
    el.classList.remove("hidden");

    const step = this.uiState.commandStep;
    let promptHtml = "";
    if (step === "SELECT_WORK_TARGET") {
      promptHtml = `<div class="cmd-step-banner">Click a Building to assign ${count} worker(s)</div>`;
    } else if (step === "SELECT_MOVE_SOURCE") {
      promptHtml = `<div class="cmd-step-banner">Step 1/2: Click SOURCE Building to pick up goods from</div>`;
    } else if (step === "SELECT_MOVE_DEST") {
      const srcB = this.colony.getBuilding(this.uiState.moveGoodsSourceId);
      const srcName = srcB ? t(BUILDINGS[srcB.type].nameKey) : "Source";
      promptHtml = `<div class="cmd-step-banner">Step 2/2: Click DESTINATION Building (From ${srcName})</div>`;
    }

    el.innerHTML = `
      <div class="cmd-header">
        <span>Selected Minions: <b>${count}</b></span>
        <button class="pixel-btn sm" id="btn-cmd-clear">X</button>
      </div>
      ${promptHtml}
      <div class="cmd-buttons-row">
        <button class="pixel-btn ${step === "SELECT_WORK_TARGET" ? "active" : ""}" id="btn-cmd-work">
          <img src="${SPRITE_FILE("ui_icon_worker")}" class="inline-icon" alt=""> ${t("command.work")}
        </button>
        <button class="pixel-btn ${step === "SELECT_MOVE_SOURCE" || step === "SELECT_MOVE_DEST" ? "active" : ""}" id="btn-cmd-move">
          <img src="${SPRITE_FILE("ui_icon_move")}" class="inline-icon" alt=""> ${t("command.moveGoods")}
        </button>
        <button class="pixel-btn" id="btn-cmd-barracks">
          <img src="${SPRITE_FILE("emote_battle")}" class="inline-icon" alt=""> ${t("command.toBarracks")}
        </button>
        <button class="pixel-btn danger" id="btn-cmd-sell">
          <img src="${SPRITE_FILE("icon_coin")}" class="inline-icon" alt=""> ${t("command.sellMinions")}
        </button>
      </div>
    `;

    document.getElementById("btn-cmd-clear")?.addEventListener("click", () => {
      this.cancelActiveModes();
    });

    document.getElementById("btn-cmd-work")?.addEventListener("click", () => {
      this.uiState.commandStep = "SELECT_WORK_TARGET";
      this.audio.playUiSfx("click");
      this.renderCommandPopup();
    });

    document.getElementById("btn-cmd-move")?.addEventListener("click", () => {
      this.uiState.commandStep = "SELECT_MOVE_SOURCE";
      this.uiState.moveGoodsSourceId = null;
      this.audio.playUiSfx("click");
      this.renderCommandPopup();
    });

    document.getElementById("btn-cmd-barracks")?.addEventListener("click", () => {
      const ids = Array.from(this.uiState.selectedMinionIds);
      this.colony.commandToBarracks(ids);
      this.uiState.selectedMinionIds.clear();
      this.uiState.commandStep = null;
      this.refreshAllPanels(true);
    });

    document.getElementById("btn-cmd-sell")?.addEventListener("click", () => {
      const ids = Array.from(this.uiState.selectedMinionIds);
      this.colony.sellMinions(ids);
      this.uiState.selectedMinionIds.clear();
      this.uiState.commandStep = null;
      this.refreshAllPanels(true);
    });
  }

  openStoreHouseFilterModal() {
    const modal = document.getElementById("filter-modal");
    if (!modal) return;
    modal.classList.remove("hidden");

    const f = this.filterDraft;
    modal.innerHTML = `
      <div class="modal-card pixel-panel">
        <div class="modal-header">
          <span>${t("command.filterItems")} (Store House Outbound)</span>
          <button class="pixel-btn sm" id="btn-close-filter">X</button>
        </div>
        <div class="modal-body">
          <label class="pixel-checkbox-row">
            <input type="checkbox" id="chk-filter-res" ${f.anyResource ? "checked" : ""}>
            <span>${t("filter.anyResource")} (Metal, Carrots, Gems)</span>
          </label>
          <label class="pixel-checkbox-row">
            <input type="checkbox" id="chk-filter-wpn" ${f.anyWeapon ? "checked" : ""}>
            <span>${t("filter.anyWeapon")}</span>
          </label>
          <label class="pixel-checkbox-row">
            <input type="checkbox" id="chk-filter-arm" ${f.anyArmour ? "checked" : ""}>
            <span>${t("filter.anyArmour")}</span>
          </label>
          <label class="pixel-checkbox-row">
            <input type="checkbox" id="chk-filter-ench" ${f.allowEnchanted ? "checked" : ""}>
            <span>${t("filter.allowEnchanted")}</span>
          </label>
          <div class="filter-threshold-row">
            <span>${t("filter.threshold")}:</span>
            <input type="number" id="inp-filter-threshold" min="0" max="999" value="${f.threshold}" class="pixel-input-num">
          </div>
          <div class="modal-footer-btns">
            <button class="pixel-btn primary" id="btn-confirm-filter">Confirm Courier Route</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById("btn-close-filter")?.addEventListener("click", () => {
      modal.classList.add("hidden");
      this.uiState.commandStep = null;
      this.renderCommandPopup();
    });

    document.getElementById("btn-confirm-filter")?.addEventListener("click", () => {
      this.filterDraft.anyResource = Boolean(document.getElementById("chk-filter-res")?.checked);
      this.filterDraft.anyWeapon = Boolean(document.getElementById("chk-filter-wpn")?.checked);
      this.filterDraft.anyArmour = Boolean(document.getElementById("chk-filter-arm")?.checked);
      this.filterDraft.allowEnchanted = Boolean(document.getElementById("chk-filter-ench")?.checked);
      this.filterDraft.threshold = Math.max(0, Number(document.getElementById("inp-filter-threshold")?.value) || 0);

      const ids = Array.from(this.uiState.selectedMinionIds);
      const fromId = this.uiState.moveGoodsSourceId;
      const toId = this.uiState.pendingMoveDestId;
      if (fromId && toId && ids.length > 0) {
        this.colony.commandMoveGoods(ids, fromId, toId, { ...this.filterDraft });
      }
      modal.classList.add("hidden");
      this.uiState.commandStep = null;
      this.uiState.moveGoodsSourceId = null;
      this.uiState.pendingMoveDestId = null;
      this.uiState.selectedMinionIds.clear();
      this.refreshAllPanels(true);
    });
  }

  // =========================================================================
  // 3-COLUMN BUILDING INSPECTOR MODAL
  // =========================================================================
  renderBuildingInspector() {
    const el = document.getElementById("building-inspector-modal");
    if (!el) return;

    const b = this.colony.getBuilding(this.uiState.selectedBuildingId);
    if (!b || this.isBattleViewActive()) {
      el.classList.add("hidden");
      return;
    }
    el.classList.remove("hidden");

    const def = BUILDINGS[b.type];
    const lvInfo = this.colony.getBuildingLevelInfo(b);
    const nextLvInfo = this.colony.getBuildingNextLevelInfo(b);
    const roman = lvInfo?.roman || "";

    // Column 1: Workers
    const hasWorkers = Boolean(lvInfo && lvInfo.workerLimit);
    let workersColHtml = "";
    if (hasWorkers) {
      const workerCards = b.workers
        .map((mid) => {
          const m = this.colony.getMinion(mid);
          if (!m) return "";
          const mDef = MINION_TYPES[m.type];
          const g = computeTaskGrade(mDef.stats, def.task || "Mining");
          return `
            <div class="inspector-minion-row">
              <img src="${SPRITE_FILE(mDef.icon)}" class="inline-icon" alt="">
              <span class="inspector-minion-name">${t(mDef.nameKey)}</span>
              <span class="grade-badge grade-${g.grade}">${g.grade}</span>
              <button class="pixel-btn sm danger btn-eject-worker" data-mid="${m.id}">X</button>
            </div>
          `;
        })
        .join("");

      workersColHtml = `
        <div class="inspector-col">
          <div class="inspector-col-header">
            <span>${t("building.workers")} (${b.workers.length}/${lvInfo.workerLimit})</span>
            <div class="inspector-col-actions">
              <button class="pixel-btn sm" id="btn-assign-idle-worker" title="Assign an idle minion">+ Idle</button>
              <button class="pixel-btn sm danger" id="btn-eject-all-workers">${t("building.ejectAll")}</button>
            </div>
          </div>
          <div class="inspector-list">${workerCards || `<div class="empty-note">No workers assigned</div>`}</div>
        </div>
      `;
    } else if (b.type === "Barracks") {
      // Barracks column 1: Stationed combat minions by race
      const raceRows = Object.keys(this.colony.barracks)
        .map((race) => {
          const count = this.colony.barracks[race] || 0;
          const mDef = MINION_TYPES[race];
          if (!mDef) return "";
          return `
            <div class="inspector-minion-row">
              <img src="${SPRITE_FILE(mDef.icon)}" class="inline-icon" alt="">
              <span class="inspector-minion-name">${t(mDef.nameKey)}</span>
              <span class="inspector-count-badge">×${count}</span>
              ${
                count > 0
                  ? `<button class="pixel-btn sm btn-release-barracks" data-race="${race}" title="Release 1 back to Colony">Out</button>`
                  : ""
              }
            </div>
          `;
        })
        .join("");
      workersColHtml = `
        <div class="inspector-col">
          <div class="inspector-col-header">
            <span>Stationed Army</span>
            <button class="pixel-btn sm" id="btn-send-idle-to-barracks">+ All Idle</button>
          </div>
          <div class="inspector-list">${raceRows}</div>
        </div>
      `;
    } else {
      workersColHtml = `
        <div class="inspector-col">
          <div class="inspector-col-header"><span>${t("building.workers")}</span></div>
          <div class="inspector-list"><div class="empty-note">Does not require workers</div></div>
        </div>
      `;
    }

    // Column 2: Couriers
    const courierCards = b.couriers
      .map((mid) => {
        const m = this.colony.getMinion(mid);
        if (!m) return "";
        const mDef = MINION_TYPES[m.type];
        const destB = this.colony.getBuilding(m.courierToId);
        const destName = destB ? t(BUILDINGS[destB.type].nameKey) : "?";
        const g = computeTaskGrade(mDef.stats, "Carrying");
        return `
          <div class="inspector-minion-row">
            <img src="${SPRITE_FILE(mDef.icon)}" class="inline-icon" alt="">
            <span class="inspector-minion-name">-> ${destName}</span>
            <span class="grade-badge grade-${g.grade}">${g.grade}</span>
            <button class="pixel-btn sm danger btn-eject-courier" data-mid="${m.id}">X</button>
          </div>
        `;
      })
      .join("");

    const couriersColHtml = `
      <div class="inspector-col">
        <div class="inspector-col-header">
          <span>${t("building.couriers")} (${b.couriers.length})</span>
          <div class="inspector-col-actions">
            ${
              b.type !== "Market" && b.type !== "Barracks"
                ? `<button class="pixel-btn sm" id="btn-quick-courier-storehouse" title="Assign an idle minion to haul to Store House">+ -> Store</button>
                   <button class="pixel-btn sm" id="btn-quick-courier-market" title="Assign an idle minion to haul to Market">+ -> Market</button>`
                : ""
            }
            <button class="pixel-btn sm danger" id="btn-eject-all-couriers">${t("building.ejectAll")}</button>
          </div>
        </div>
        <div class="inspector-list">${courierCards || `<div class="empty-note">No couriers assigned</div>`}</div>
      </div>
    `;

    // Column 3: Output / Storage / Recipes / Upgrade
    let col3Body = "";
    if (b.type === "Mine" || b.type === "Farm") {
      const outItems = b.output
        .slice(0, 24)
        .map((it) => `<img src="${SPRITE_FILE(it.sprite)}" class="slot-icon" title="${it.itemId}" alt="">`)
        .join("");
      col3Body = `
        <div class="progress-bar-wrap">
          <div class="progress-bar-fill" id="inspector-work-progress" style="width:${Math.round(b.workProgress * 100)}%"></div>
          <span class="progress-bar-label">Production Progress</span>
        </div>
        <div class="inspector-stat-line">Output Queue: <b id="inspector-output-count">${b.output.length} / ${lvInfo.outputLimit}</b></div>
        <div class="inspector-stat-line">Work Efficiency: <b>${Math.round(lvInfo.workEfficiency * 100)}%</b></div>
        <div class="inspector-stat-line">Rare Find Chance: <b>${Math.round((lvInfo.rareFindChance || 0) * 100)}%</b></div>
        <div class="output-slots-grid" id="inspector-output-grid">${outItems || `<span class="empty-note">Output empty</span>`}</div>
      `;
    } else if (b.type === "Smith" || b.type === "Armourer") {
      const tiers = b.type === "Smith" ? WEAPON_TIERS : ARMOUR_TIERS;
      const maxTier = lvInfo.maxRecipeTier ?? 0;
      const recipeButtons = tiers
        .map((tier, idx) => {
          const unlocked = idx <= maxTier;
          const active = b.selectedRecipeIndex === idx;
          return `
            <button class="recipe-choice-btn ${active ? "active" : ""} ${unlocked ? "" : "locked"}"
                    data-ridx="${idx}" ${unlocked ? "" : "disabled"}>
              <img src="${SPRITE_FILE(tier.sprite)}" class="inline-icon" alt="">
              <span>${t(tier.nameKey || tier.tierKey)} (${tier.metalCost} Metal)</span>
            </button>
          `;
        })
        .join("");
      col3Body = `
        <div class="progress-bar-wrap">
          <div class="progress-bar-fill" id="inspector-work-progress" style="width:${Math.round(b.workProgress * 100)}%"></div>
          <span class="progress-bar-label">Crafting Progress</span>
        </div>
        <div class="inspector-stat-line">Input Metal: <b id="inspector-input-count">${b.input.length} / ${lvInfo.inputLimit}</b></div>
        <div class="inspector-stat-line">Output Gear: <b id="inspector-output-count">${b.output.length} / ${lvInfo.outputLimit}</b></div>
        <div class="recipe-selector-list">${recipeButtons}</div>
      `;
    } else if (b.type === "WizardTower") {
      const enchButtons = Object.values(ENCHANTMENTS)
        .map((ench) => {
          const unlocked = ench.unlockedAtStart || this.colony.isUnlocked(ench.unlockKey || ench.id);
          const active = b.selectedEnchantment === ench.id;
          return `
            <button class="recipe-choice-btn ${active ? "active" : ""} ${unlocked ? "" : "locked"}"
                    data-ench="${ench.id}" ${unlocked ? "" : "disabled"}>
              <img src="${SPRITE_FILE(ench.frameSprite || ench.sprite)}" class="inline-icon" alt="">
              <span>${t(ench.nameKey)}</span>
            </button>
          `;
        })
        .join("");
      col3Body = `
        <div class="progress-bar-wrap">
          <div class="progress-bar-fill" id="inspector-work-progress" style="width:${Math.round(b.workProgress * 100)}%"></div>
          <span class="progress-bar-label">Enchanting Progress</span>
        </div>
        <div class="inspector-stat-line">Input Gear: <b id="inspector-input-count">${b.input.length} / ${lvInfo.inputLimit}</b></div>
        <div class="inspector-stat-line">Output Enchanted: <b id="inspector-output-count">${b.output.length} / ${lvInfo.outputLimit}</b></div>
        <div class="recipe-selector-list">${enchButtons}</div>
      `;
    } else if (b.type === "StoreHouse") {
      const eqHtml = this.colony.equipment
        .slice(0, 16)
        .map((eq) => {
          const ench = eq.enchantment ? ENCHANTMENTS[eq.enchantment] : null;
          return `
            <div class="eq-mini-badge" title="${eq.itemId} (${eq.sellGold}g)">
              <img src="${SPRITE_FILE(eq.sprite)}" class="inline-icon" alt="">
              ${ench ? `<img src="${SPRITE_FILE(ench.frameSprite || ench.sprite)}" class="eq-frame-overlay" alt="">` : ""}
            </div>
          `;
        })
        .join("");
      col3Body = `
        <div class="inspector-stat-line">Stored Equipment: <b>${this.colony.equipment.length} items</b></div>
        <div class="output-slots-grid">${eqHtml || `<span class="empty-note">No crafted equipment in Store House</span>`}</div>
      `;
    } else if (b.type === "Market") {
      col3Body = `
        <div class="inspector-stat-line">Total Colony Gold Earned: <b>${Math.floor(this.colony.totalGoldEarned)}g</b></div>
        <div class="empty-note">Assign couriers with "Move Goods" to bring resources or crafted equipment here to sell for Gold!</div>
      `;
    } else if (b.type === "Barracks") {
      const totalReady = Object.values(this.colony.barracks).reduce((a, c) => a + c, 0);
      col3Body = `
        <div class="inspector-stat-line">Total Combat-Ready Minions: <b>${totalReady}</b></div>
        <button class="pixel-btn primary full-w" id="btn-barracks-open-missions">Open Missions</button>
      `;
    }

    // Upgrade section if building is upgradeable
    let upgradeHtml = "";
    if (lvInfo && nextLvInfo && lvInfo.upgradeCost !== null) {
      upgradeHtml = `
        <div class="upgrade-diff-box">
          <div class="upgrade-diff-title">${t("building.upgrade")} (${lvInfo.roman} -> ${nextLvInfo.roman})</div>
          <div class="upgrade-diff-rows">
            <div>Workers: <b>${lvInfo.workerLimit} -> ${nextLvInfo.workerLimit}</b></div>
            <div>Output Cap: <b>${lvInfo.outputLimit} -> ${nextLvInfo.outputLimit}</b></div>
            <div>Efficiency: <b>${Math.round(lvInfo.workEfficiency * 100)}% -> ${Math.round(nextLvInfo.workEfficiency * 100)}%</b></div>
            ${
              nextLvInfo.unlocksRecipe
                ? `<div class="unlock-recipe-line">Unlocks: <b>${nextLvInfo.unlocksRecipe}</b></div>`
                : ""
            }
          </div>
          <button class="pixel-btn gold full-w" id="btn-upgrade-building">
            <img src="${SPRITE_FILE("ui_icon_upgrade")}" class="inline-icon" alt=""> Upgrade (${lvInfo.upgradeCost}g)
          </button>
        </div>
      `;
    } else if (lvInfo && !nextLvInfo) {
      upgradeHtml = `<div class="upgrade-max-badge">Max Level Reached (${lvInfo.roman})</div>`;
    }

    el.innerHTML = `
      <div class="inspector-header">
        <div class="inspector-title-group">
          <img src="${SPRITE_FILE(def.sprite)}" class="inspector-header-icon" alt="">
          <div>
            <div class="inspector-title">${t(def.nameKey)} ${roman}</div>
            <div class="inspector-subtitle">${t(def.descKey)}</div>
          </div>
        </div>
        <div class="inspector-header-btns">
          <button class="pixel-btn sm" id="btn-move-building">${t("building.move")}</button>
          ${
            def.placeable
              ? `<button class="pixel-btn sm danger" id="btn-sell-building">${t("building.sell")} (+${this.colony.getBuildingSellValue(b)}g)</button>`
              : ""
          }
          <button class="pixel-btn sm" id="btn-close-inspector">X</button>
        </div>
      </div>
      <div class="inspector-columns">
        ${workersColHtml}
        ${couriersColHtml}
        <div class="inspector-col">
          <div class="inspector-col-header"><span>${t("building.output")} &amp; Upgrades</span></div>
          <div class="inspector-col3-body">
            ${col3Body}
            ${upgradeHtml}
          </div>
        </div>
      </div>
    `;

    // Bind events
    document.getElementById("btn-close-inspector")?.addEventListener("click", () => {
      this.uiState.selectedBuildingId = null;
      this.renderBuildingInspector();
    });

    document.getElementById("btn-move-building")?.addEventListener("click", () => {
      this.uiState.placementMode = "MOVE_BUILDING";
      this.uiState.movingBuildingId = b.id;
      this.uiState.selectedBuildingId = null;
      this.audio.playUiSfx("click");
      this.renderBuildingInspector();
    });

    document.getElementById("btn-sell-building")?.addEventListener("click", () => {
      this.colony.sellBuilding(b.id);
      this.uiState.selectedBuildingId = null;
      this.refreshAllPanels(true);
    });

    document.getElementById("btn-upgrade-building")?.addEventListener("click", () => {
      if (this.colony.upgradeBuilding(b.id)) {
        this.refreshAllPanels(true);
      } else {
        this.audio.playUiSfx("denied");
      }
    });

    document.getElementById("btn-eject-all-workers")?.addEventListener("click", () => {
      this.colony.ejectAllWorkers(b.id);
      this.refreshAllPanels(true);
    });

    document.getElementById("btn-eject-all-couriers")?.addEventListener("click", () => {
      this.colony.ejectAllCouriers(b.id);
      this.refreshAllPanels(true);
    });

    document.getElementById("btn-assign-idle-worker")?.addEventListener("click", () => {
      const idle = this.colony.minions.find((m) => m.state === "IDLE");
      if (idle && this.colony.commandWork([idle.id], b.id) > 0) {
        this.refreshAllPanels(true);
      } else {
        this.audio.playUiSfx("denied");
      }
    });

    document.getElementById("btn-quick-courier-storehouse")?.addEventListener("click", () => {
      const idle = this.colony.minions.find((m) => m.state === "IDLE");
      if (idle && this.colony.storeHouse && b.id !== this.colony.storeHouse.id) {
        this.colony.commandMoveGoods([idle.id], b.id, this.colony.storeHouse.id);
        this.refreshAllPanels(true);
      } else {
        this.audio.playUiSfx("denied");
      }
    });

    document.getElementById("btn-quick-courier-market")?.addEventListener("click", () => {
      const idle = this.colony.minions.find((m) => m.state === "IDLE");
      if (idle && this.colony.marketBuilding && b.id !== this.colony.marketBuilding.id) {
        this.colony.commandMoveGoods([idle.id], b.id, this.colony.marketBuilding.id);
        this.refreshAllPanels(true);
      } else {
        this.audio.playUiSfx("denied");
      }
    });

    document.getElementById("btn-send-idle-to-barracks")?.addEventListener("click", () => {
      this.colony.sendAllIdleToBarracks();
      this.refreshAllPanels(true);
    });

    document.getElementById("btn-barracks-open-missions")?.addEventListener("click", () => {
      this.uiState.selectedBuildingId = null;
      this.renderBuildingInspector();
      this.openMissionSelectModal();
    });

    el.querySelectorAll(".btn-eject-worker, .btn-eject-courier").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.colony.ejectMinion(btn.dataset.mid);
        this.refreshAllPanels(true);
      });
    });

    el.querySelectorAll(".btn-release-barracks").forEach((btn) => {
      btn.addEventListener("click", () => {
        const race = btn.dataset.race;
        if ((this.colony.barracks[race] || 0) > 0) {
          this.colony.barracks[race] -= 1;
          const bar = this.colony.barracksBuilding;
          const m = {
            id: this.colony.allocId("min"),
            type: race,
            x: (bar ? bar.x : 260) + (Math.random() - 0.5) * 16,
            y: (bar ? bar.y : 220) + 18,
            vx: 0,
            vy: 0,
            facing: 1,
            state: "IDLE",
            workBuildingId: null,
            courierFromId: null,
            courierToId: null,
            courierFilter: null,
            carriedItem: null,
            emote: null,
            emoteTimer: 0,
            animTime: 0,
            wanderTimer: 1,
            wanderTarget: null
          };
          this.colony.minions.push(m);
          this.colony.recalculateMorale();
          this.audio.playUiSfx("pop");
          this.refreshAllPanels(true);
        }
      });
    });

    el.querySelectorAll(".recipe-choice-btn[data-ridx]").forEach((btn) => {
      btn.addEventListener("click", () => {
        b.selectedRecipeIndex = Number(btn.dataset.ridx) || 0;
        b.workProgress = 0;
        this.audio.playUiSfx("click");
        this.renderBuildingInspector();
      });
    });

    el.querySelectorAll(".recipe-choice-btn[data-ench]").forEach((btn) => {
      btn.addEventListener("click", () => {
        b.selectedEnchantment = btn.dataset.ench;
        b.workProgress = 0;
        this.audio.playUiSfx("click");
        this.renderBuildingInspector();
      });
    });
  }

  updateBuildingInspectorLiveValues() {
    const b = this.colony.getBuilding(this.uiState.selectedBuildingId);
    if (!b) return;
    const lvInfo = this.colony.getBuildingLevelInfo(b);
    const bar = document.getElementById("inspector-work-progress");
    if (bar) bar.style.width = `${Math.round((b.workProgress || 0) * 100)}%`;

    const outCount = document.getElementById("inspector-output-count");
    if (outCount && lvInfo) outCount.textContent = `${b.output.length} / ${lvInfo.outputLimit}`;

    const inCount = document.getElementById("inspector-input-count");
    if (inCount && lvInfo) inCount.textContent = `${b.input.length} / ${lvInfo.inputLimit}`;
  }

  // =========================================================================
  // BOTTOM MISSION DRAWER & MISSION SELECT MODAL
  // =========================================================================
  refreshMissionDrawer() {
    const btn = document.getElementById("mission-drawer-btn");
    if (!btn) return;

    if (this.battle.state === "IN_PROGRESS" && this.battle.inBackground) {
      const ally = this.battle.getTeamHealthTotals("ally");
      const enemy = this.battle.getTeamHealthTotals("enemy");
      btn.className = "pixel-btn gold mission-drawer-btn in-progress";
      btn.innerHTML = `<img src="${SPRITE_FILE("ui_icon_swords")}" class="inline-icon" alt=""> ${t("mission.inProgress")} (Ally ${ally.current} vs Enemy ${enemy.current}) - Click to Watch`;
    } else if (this.battle.state === "FINISHED" && this.battle.inBackground) {
      btn.className = "pixel-btn primary mission-drawer-btn finished-pulse";
      btn.innerHTML = `<img src="${SPRITE_FILE("ui_icon_swords")}" class="inline-icon" alt=""> ${t("mission.finished")}`;
    } else {
      btn.className = "pixel-btn primary mission-drawer-btn";
      btn.innerHTML = `<img src="${SPRITE_FILE("ui_icon_swords")}" class="inline-icon" alt=""> ${t("mission.title")} (${this.colony.completedMissions.size}/${MISSIONS.length})`;
    }
  }

  handleMissionDrawerClick() {
    if (this.battle.state === "IN_PROGRESS" && this.battle.inBackground) {
      this.battle.inBackground = false;
      this.refreshAllPanels(true);
      return;
    }
    if (this.battle.state === "FINISHED" && this.battle.inBackground) {
      this.battle.inBackground = false;
      this.refreshAllPanels(true);
      return;
    }
    this.openMissionSelectModal();
  }

  openMissionSelectModal() {
    const modal = document.getElementById("mission-modal");
    if (!modal) return;
    modal.classList.remove("hidden");

    const cardsHtml = MISSIONS.map((m) => {
      const cleared = this.colony.completedMissions.has(m.id);
      const diffLabel = m.difficultyKey ? t(m.difficultyKey) : t(`difficulty.${m.difficulty}`);
      const num = m.number ?? m.index;
      // Summarize enemy counts by race
      const enemyCounts = {};
      for (const e of m.enemies) {
        enemyCounts[e.race] = (enemyCounts[e.race] || 0) + 1;
      }
      const enemyBadges = Object.entries(enemyCounts)
        .map(([race, cnt]) => {
          const rDef = MINION_TYPES[race];
          return `<span class="enemy-pill"><img src="${SPRITE_FILE(rDef?.icon || "icon_fighter")}" class="inline-icon" alt=""> ×${cnt}</span>`;
        })
        .join(" ");

      const unlockBadges = (m.unlocks || [])
        .map((uk) => `<span class="unlock-pill"><img src="${SPRITE_FILE("ui_icon_unlock")}" class="inline-icon" alt=""> ${uk}</span>`)
        .join(" ");

      return `
        <div class="mission-card ${cleared ? "cleared" : ""}" data-mid="${m.id}">
          <div class="mission-card-top">
            <span class="mission-num">#${num}</span>
            <span class="mission-name">${t(m.nameKey)}</span>
            <span class="diff-badge diff-${m.difficultyTier || 1}">${diffLabel}</span>
          </div>
          <div class="mission-desc">${t(m.descKey)}</div>
          <div class="mission-meta-row">
            <span>Limit: <b>${m.minionLimit} Minions</b></span>
            <span>Reward: <b><img src="${SPRITE_FILE("icon_coin")}" class="inline-icon" alt=""> ${m.goldReward}g</b></span>
          </div>
          <div class="mission-enemies-row">Enemies: ${enemyBadges}</div>
          ${unlockBadges ? `<div class="mission-unlocks-row">${unlockBadges}</div>` : ""}
          <button class="pixel-btn ${cleared ? "" : "primary"} full-w btn-select-mission" data-mid="${m.id}">
            ${cleared ? "Replay Mission" : "Prepare Formation ->"}
          </button>
        </div>
      `;
    }).join("");

    modal.innerHTML = `
      <div class="modal-card pixel-panel xl">
        <div class="modal-header">
          <span><img src="${SPRITE_FILE("ui_icon_swords")}" class="inline-icon" alt=""> ${t("mission.title")}</span>
          <button class="pixel-btn sm" id="btn-close-missions">X</button>
        </div>
        <div class="missions-grid">
          ${cardsHtml}
        </div>
      </div>
    `;

    document.getElementById("btn-close-missions")?.addEventListener("click", () => {
      modal.classList.add("hidden");
    });

    modal.querySelectorAll(".btn-select-mission").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mid = btn.dataset.mid;
        modal.classList.add("hidden");
        this.battle.openFormation(mid);
        this.autoFillFormation();
        this.audio.playUiSfx("click");
        this.refreshAllPanels(true);
      });
    });
  }

  // =========================================================================
  // FORMATION EDITOR OVERLAY
  // =========================================================================
  renderFormationOverlay() {
    const el = document.getElementById("formation-overlay");
    if (!el || this.battle.state !== "FORMATION" || !this.battle.currentMission) return;

    const mission = this.battle.currentMission;
    const placedCount = this.battle.formation.length;
    const limit = mission.minionLimit;

    // Barracks unit cards
    const barracksHtml = Object.keys(this.colony.barracks)
      .map((race) => {
        const count = this.colony.barracks[race] || 0;
        const mDef = MINION_TYPES[race];
        if (!mDef) return "";
        const selected = !this.battle.selectedEquipmentUid && this.battle.selectedBarracksRace === race;
        return `
          <div class="formation-unit-card ${selected ? "selected" : ""} ${count <= 0 ? "depleted" : ""}"
               data-race="${race}">
            <img src="${SPRITE_FILE(mDef.icon)}" class="formation-card-icon" alt="">
            <div class="formation-card-name">${t(mDef.nameKey)}</div>
            <div class="formation-card-count">×${count}</div>
          </div>
        `;
      })
      .join("");

    // Equipment cards from Store House
    const eqHtml = this.colony.equipment
      .map((eq) => {
        const selected = this.battle.selectedEquipmentUid === eq.uid;
        const ench = eq.enchantment ? ENCHANTMENTS[eq.enchantment] : null;
        return `
          <div class="formation-eq-card ${selected ? "selected" : ""}" data-uid="${eq.uid}"
               title="${eq.itemId}${ench ? ` (${t(ench.nameKey)})` : ""}">
            <div class="eq-icon-stack">
              <img src="${SPRITE_FILE(eq.sprite)}" class="formation-card-icon" alt="">
              ${ench ? `<img src="${SPRITE_FILE(ench.frameSprite || ench.sprite)}" class="eq-frame-overlay" alt="">` : ""}
            </div>
            <div class="formation-card-name">${eq.itemId}</div>
          </div>
        `;
      })
      .join("");

    el.innerHTML = `
      <div class="formation-top-bar pixel-panel">
        <div class="formation-mission-title">
          <span>#${mission.number ?? mission.index} ${t(mission.nameKey)}</span>
          <span class="formation-placed-badge">Placed: <b>${placedCount} / ${limit}</b></span>
        </div>
        <div class="formation-top-actions">
          <button class="pixel-btn sm" id="btn-formation-pull-colony" title="Transfer idle colony minions into Barracks">+ Pull Colony Minions</button>
          <button class="pixel-btn sm" id="btn-formation-autofill" title="Automatically place available Barracks units">Auto-Fill</button>
          <button class="pixel-btn sm" id="btn-formation-clear">Clear Grid</button>
          <button class="pixel-btn" id="btn-formation-back">&lt;- Back to Colony</button>
          <button class="pixel-btn primary lg" id="btn-formation-start">
            <img src="${SPRITE_FILE("ui_icon_swords")}" class="inline-icon" alt=""> ${t("mission.startBattle")}
          </button>
        </div>
      </div>

      <div class="formation-bottom-dock">
        <div class="formation-panel pixel-panel">
          <div class="formation-panel-header">${t("building.Barracks.name")} Units (Click grid to place/remove)</div>
          <div class="formation-cards-scroll">${barracksHtml}</div>
        </div>

        <div class="formation-panel pixel-panel">
          <div class="formation-panel-header">Equipment (${this.colony.equipment.length}) - Click item then unit</div>
          <div class="formation-cards-scroll">${eqHtml || `<div class="empty-note">Craft Weapons &amp; Armour at the Smith or Armourer</div>`}</div>
        </div>

        <div class="formation-panel pixel-panel preview-panel" id="formation-preview-card">
          <div class="formation-panel-header">Unit &amp; Ability Stats</div>
          <div class="formation-preview-body" id="formation-preview-body">
            Hover any unit on the battlefield or select a unit card to inspect its stats &amp; ability.
          </div>
        </div>
      </div>
    `;

    // Default preview for selected race
    this.updateFormationPreviewCard(null, null);

    // Bind events
    el.querySelectorAll(".formation-unit-card").forEach((card) => {
      card.addEventListener("click", () => {
        this.battle.selectedBarracksRace = card.dataset.race;
        this.battle.selectedEquipmentUid = null;
        this.audio.playUiSfx("click");
        this.renderFormationOverlay();
      });
    });

    el.querySelectorAll(".formation-eq-card").forEach((card) => {
      card.addEventListener("click", () => {
        const uid = card.dataset.uid;
        this.battle.selectedEquipmentUid = this.battle.selectedEquipmentUid === uid ? null : uid;
        this.audio.playUiSfx("click");
        this.renderFormationOverlay();
      });
    });

    document.getElementById("btn-formation-pull-colony")?.addEventListener("click", () => {
      let pulled = 0;
      for (let i = this.colony.minions.length - 1; i >= 0; i--) {
        const m = this.colony.minions[i];
        this.colony.detachMinionFromAssignments(m);
        this.colony.barracks[m.type] = (this.colony.barracks[m.type] || 0) + 1;
        this.colony.minions.splice(i, 1);
        pulled++;
      }
      if (pulled > 0) {
        this.colony.recalculateMorale();
        this.audio.playUiSfx("pop");
        this.autoFillFormation();
      } else {
        this.audio.playUiSfx("denied");
      }
      this.refreshAllPanels(true);
    });

    document.getElementById("btn-formation-autofill")?.addEventListener("click", () => {
      this.autoFillFormation();
    });

    document.getElementById("btn-formation-clear")?.addEventListener("click", () => {
      this.battle.clearFormationBackToColony();
      this.audio.playUiSfx("pop_down");
      this.renderFormationOverlay();
    });

    document.getElementById("btn-formation-back")?.addEventListener("click", () => {
      this.battle.cancelFormation();
      this.audio.playUiSfx("click");
      this.refreshAllPanels(true);
    });

    document.getElementById("btn-formation-start")?.addEventListener("click", () => {
      if (this.battle.formation.length === 0) {
        this.autoFillFormation();
      }
      if (this.battle.formation.length === 0) {
        // Pull any colony minions or provide emergency starter Goblins so Start Battle always works
        for (let i = this.colony.minions.length - 1; i >= 0; i--) {
          const m = this.colony.minions[i];
          this.colony.detachMinionFromAssignments(m);
          this.colony.barracks[m.type] = (this.colony.barracks[m.type] || 0) + 1;
          this.colony.minions.splice(i, 1);
        }
        const totalAvail = Object.values(this.colony.barracks).reduce((a, b) => a + b, 0);
        if (totalAvail === 0) {
          this.colony.barracks.Goblin = (this.colony.barracks.Goblin || 0) + 4;
          this.colony.barracks.Troll = (this.colony.barracks.Troll || 0) + 2;
        }
        this.autoFillFormation();
      }
      if (this.battle.startBattle()) {
        this.refreshAllPanels(true);
      }
    });
  }

  autoFillFormation() {
    if (this.battle.state !== "FORMATION" || !this.battle.currentMission) return;
    const limit = this.battle.currentMission.minionLimit;
    const coords = [
      [-1, -1], [-1, 0], [-1, 1], [-1, -2], [-1, 2],
      [-2, -1], [-2, 0], [-2, 1], [-2, -2], [-2, 2],
      [-3, -1], [-3, 0], [-3, 1], [-3, -2], [-3, 2],
      [-4, 0], [-4, -1], [-4, 1], [-5, 0], [-5, -1]
    ];
    // Prefer front-liners in front (-1..-2) and ranged in back (-3..-5)
    const priorityRaces = ["Giant", "Troll", "Cyclops", "Goblin", "Demon", "Sapling", "LightningMage"];
    for (const [gx, gy] of coords) {
      if (this.battle.formation.length >= limit) break;
      if (this.battle.getPlacedSlotAt(gx, gy)) continue;
      const race = priorityRaces.find((r) => (this.colony.barracks[r] || 0) > 0);
      if (!race) break;
      this.battle.selectedBarracksRace = race;
      this.battle.selectedEquipmentUid = null;
      this.battle.placeOrEquipAtFormationTile(gx, gy);
    }
    this.renderFormationOverlay();
  }

  updateFormationPreviewCard(gx, gy) {
    const body = document.getElementById("formation-preview-body");
    if (!body || !this.battle.currentMission) return;

    let stats = null;
    if (gx !== null && gy !== null) {
      const allySlot = this.battle.getPlacedSlotAt(gx, gy);
      if (allySlot) {
        stats = this.battle.computeUnitPreviewStats(allySlot.race, allySlot.weapon, allySlot.armour);
      } else {
        // Check enemy at (gx - 1, gy)
        const enemy = this.battle.currentMission.enemies.find(
          (e) => Math.round(e.x + 1) === gx && Math.round(e.y) === gy
        );
        if (enemy) {
          stats = this.battle.computeUnitPreviewStats(
            enemy.race,
            null,
            null,
            enemy.health || 1,
            enemy.potency || 1,
            enemy.durability || 1
          );
        }
      }
    }

    if (!stats && this.battle.selectedBarracksRace) {
      stats = this.battle.computeUnitPreviewStats(this.battle.selectedBarracksRace);
    }
    if (!stats) return;

    const mDef = MINION_TYPES[stats.race] || MINION_TYPES.Goblin;
    body.innerHTML = `
      <div class="preview-top-row">
        <img src="${SPRITE_FILE(mDef.icon)}" class="preview-unit-icon" alt="">
        <div>
          <div class="preview-unit-name">${stats.name}</div>
          <div class="preview-unit-hp">Health: <b>${stats.maxHealth}</b> | Potency: <b>${stats.potencyPct}%</b> | Durability: <b>${stats.durabilityPct}%</b></div>
        </div>
      </div>
      <div class="preview-ability-line">
        Base: <b>${stats.baseDamageLabel}</b> (Eff: <b>${stats.effectiveDamage}</b>) | CD: <b>${stats.cooldown}s</b> | Range: <b>${stats.range}</b>
      </div>
      <div class="preview-desc">${stats.description}</div>
    `;
  }

  // =========================================================================
  // AUTO-BATTLER HUD & BATTLE SUMMARY MODAL
  // =========================================================================
  refreshBattleHud() {
    const el = document.getElementById("battle-hud");
    if (!el) return;

    const ally = this.battle.getTeamHealthTotals("ally");
    const enemy = this.battle.getTeamHealthTotals("enemy");
    const allyPct = Math.round((ally.current / ally.max) * 100);
    const enemyPct = Math.round((enemy.current / enemy.max) * 100);
    const fast = this.battle.speedMultiplier > 1;

    el.innerHTML = `
      <div class="battle-top-hearts pixel-panel">
        <div class="team-hp-block">
          <img src="${SPRITE_FILE("minion_icon_goblin")}" class="heart-icon" alt="">
          <div class="hp-bar-outer">
            <div class="hp-bar-inner ally" style="width:${allyPct}%"></div>
            <span class="hp-bar-text">Allies: ${ally.current} / ${ally.max}</span>
          </div>
        </div>
        <div class="vs-badge">VS</div>
        <div class="team-hp-block">
          <div class="hp-bar-outer">
            <div class="hp-bar-inner enemy" style="width:${enemyPct}%"></div>
            <span class="hp-bar-text">Enemies: ${enemy.current} / ${enemy.max}</span>
          </div>
          <img src="${SPRITE_FILE("ui_icon_swords")}" class="heart-icon" alt="">
        </div>
      </div>

      <div class="battle-bottom-controls pixel-panel">
        <button class="pixel-btn" id="btn-battle-back-colony">&lt;- Back (Manage Colony)</button>
        <button class="pixel-btn ${fast ? "gold" : ""}" id="btn-battle-speed">
          ${fast ? ">> 4x Speed (ON)" : `>> ${t("mission.fastForward")}`}
        </button>
        <button class="pixel-btn danger" id="btn-battle-abort">X ${t("mission.abort")}</button>
      </div>
    `;

    document.getElementById("btn-battle-back-colony")?.addEventListener("click", () => {
      this.battle.inBackground = true;
      this.audio.startColonyMusic();
      this.refreshAllPanels(true);
    });

    document.getElementById("btn-battle-speed")?.addEventListener("click", () => {
      this.battle.speedMultiplier = this.battle.speedMultiplier > 1 ? 1 : 4;
      this.audio.playUiSfx("click");
      this.refreshBattleHud();
    });

    document.getElementById("btn-battle-abort")?.addEventListener("click", () => {
      this.battle.abortMission();
      this.audio.playUiSfx("click");
      this.refreshAllPanels(true);
    });
  }

  renderBattleSummaryModal() {
    const modal = document.getElementById("battle-summary-modal");
    if (!modal || !this.battle.result) return;
    modal.classList.remove("hidden");

    const r = this.battle.result;
    const unlocksHtml = (r.newUnlocks || [])
      .map((u) => `<span class="unlock-pill">Unlocked: <b>${u}</b></span>`)
      .join(" ");

    modal.innerHTML = `
      <div class="modal-card pixel-panel">
        <div class="modal-header">
          <span>${r.victory ? t("mission.victory") : t("mission.defeat")}</span>
        </div>
        <div class="modal-body">
          <div class="summary-stat-row"><span>Mission:</span><b>${t(r.mission.nameKey)}</b></div>
          <div class="summary-stat-row"><span>${t("mission.startingMinions")}:</span><b>${r.startingMinions}</b></div>
          <div class="summary-stat-row"><span>${t("mission.survivingMinions")}:</span><b>${r.survivingMinions} (Returned to Barracks)</b></div>
          <div class="summary-stat-row"><span>${t("mission.goldEarned")}:</span><b>+${r.goldEarned} Gold</b></div>
          ${unlocksHtml ? `<div class="summary-unlocks-box">${unlocksHtml}</div>` : ""}
          <div class="modal-footer-btns">
            <button class="pixel-btn primary lg" id="btn-battle-summary-ok">Return to Colony</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById("btn-battle-summary-ok")?.addEventListener("click", () => {
      this.battle.acknowledgeResult();
      modal.classList.add("hidden");
      this.refreshAllPanels(true);
    });
  }

  // =========================================================================
  // SETTINGS & SAVE MODAL
  // =========================================================================
  toggleSettingsModal() {
    const modal = document.getElementById("settings-modal");
    if (!modal) return;
    if (!modal.classList.contains("hidden")) {
      modal.classList.add("hidden");
      return;
    }
    modal.classList.remove("hidden");

    const s = this.colony.settings;
    modal.innerHTML = `
      <div class="modal-card pixel-panel">
        <div class="modal-header">
          <span>${t("menu.settings")} &amp; Save</span>
          <button class="pixel-btn sm" id="btn-close-settings">X</button>
        </div>
        <div class="modal-body">
          <label class="pixel-checkbox-row">
            <input type="checkbox" id="chk-enable-morale" ${s.enableMorale ? "checked" : ""}>
            <span>${t("settings.enableMorale")}</span>
          </label>
          <div class="slider-row">
            <span>${t("settings.musicVolume")}</span>
            <input type="range" id="rng-vol-music" min="0" max="1" step="0.05" value="${s.musicVolume}">
          </div>
          <div class="slider-row">
            <span>${t("settings.colonySfx")}</span>
            <input type="range" id="rng-vol-colony" min="0" max="1" step="0.05" value="${s.colonySfxVolume}">
          </div>
          <div class="slider-row">
            <span>${t("settings.battleSfx")}</span>
            <input type="range" id="rng-vol-battle" min="0" max="1" step="0.05" value="${s.battleSfxVolume}">
          </div>
          <div class="slider-row">
            <span>${t("settings.uiSfx")}</span>
            <input type="range" id="rng-vol-ui" min="0" max="1" step="0.05" value="${s.uiSfxVolume}">
          </div>
          <div class="save-actions-row">
            <button class="pixel-btn primary" id="btn-save-slot-current">Save to Slot ${this.uiState.activeSaveSlot}</button>
            <button class="pixel-btn" id="btn-return-main-menu">Main Menu</button>
          </div>
          <div id="save-toast-msg" class="save-toast"></div>
        </div>
      </div>
    `;

    document.getElementById("btn-close-settings")?.addEventListener("click", () => {
      modal.classList.add("hidden");
    });

    document.getElementById("chk-enable-morale")?.addEventListener("change", (e) => {
      this.colony.settings.enableMorale = e.target.checked;
      this.colony.recalculateMorale();
      this.refreshTopLeftHud();
    });

    const bindVol = (id, channel, key) => {
      document.getElementById(id)?.addEventListener("input", (e) => {
        const val = Number(e.target.value);
        this.colony.settings[key] = val;
        this.audio.setVolume(channel, val);
      });
    };
    bindVol("rng-vol-music", "music", "musicVolume");
    bindVol("rng-vol-colony", "colonySfx", "colonySfxVolume");
    bindVol("rng-vol-battle", "battleSfx", "battleSfxVolume");
    bindVol("rng-vol-ui", "uiSfx", "uiSfxVolume");

    document.getElementById("btn-save-slot-current")?.addEventListener("click", () => {
      this.colony.saveToSlot(this.uiState.activeSaveSlot);
      this.audio.playUiSfx("click");
      const toast = document.getElementById("save-toast-msg");
      if (toast) toast.textContent = `Saved to File ${this.uiState.activeSaveSlot}!`;
    });

    document.getElementById("btn-return-main-menu")?.addEventListener("click", () => {
      this.colony.saveToSlot(this.uiState.activeSaveSlot);
      this.battle.abortMission();
      this.audio.stopMusic();
      modal.classList.add("hidden");
      this.uiState.inMainMenu = true;
      this.renderMainMenu();
    });
  }
}
