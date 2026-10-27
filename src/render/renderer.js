/**
 * Pixel-Perfect Canvas2D Renderer for Minion Colony.
 * Renders the Colony Meadow & Forest tilemap, Buildings, Animated Props,
 * Minions with Carried Overhead Items, Emotes, Light 2D Radial Vignette,
 * Formation Grid, and Real-Time Auto-Battler VFX.
 */

import {
  ARMOUR_TIERS,
  BUILDINGS,
  DECORATIONS,
  ENCHANTMENTS,
  MINION_TYPES,
  WEAPON_TIERS
} from "../data/game-data.js";

export class GameRenderer {
  constructor(canvas, colonySim, battleSim) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.colony = colonySim;
    this.battle = battleSim;

    this.images = new Map();
    this.sheets = new Map();
    this.manifest = null;

    // Camera state for Colony View
    this.camera = {
      x: 18 * 24,
      y: 11.5 * 24,
      zoom: 2.35,
      minZoom: 1.4,
      maxZoom: 4.0
    };

    // Camera state for Battle / Formation View
    this.battleCamera = {
      x: 0,
      y: 0,
      zoom: 2.5
    };
  }

  async loadAssets(manifestUrl = "assets/asset_manifest.json") {
    const res = await fetch(manifestUrl);
    this.manifest = await res.json();

    const loadImg = (url) =>
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = url;
      });

    const promises = [];
    for (const [key, info] of Object.entries(this.manifest.sprites || {})) {
      promises.push(
        loadImg(info.file).then((img) => {
          if (img) this.images.set(key, img);
        })
      );
    }
    for (const [key, info] of Object.entries(this.manifest.sheets || {})) {
      promises.push(
        loadImg(info.file).then((img) => {
          if (img) {
            this.sheets.set(key, {
              img,
              frameWidth: info.frameWidth,
              frameHeight: info.frameHeight,
              frames: info.frames
            });
          }
        })
      );
    }
    // Load standalone textures for main menu background & logo
    const extraTextures = [
      ["tex_logo_flattened", "assets/sprites/tex_logo_flattened.png"],
      ["tex_back", "assets/sprites/tex_back.png"],
      ["tex_middle", "assets/sprites/tex_middle.png"],
      ["tex_front", "assets/sprites/tex_front.png"]
    ];
    for (const [k, url] of extraTextures) {
      promises.push(
        loadImg(url).then((img) => {
          if (img) this.images.set(k, img);
        })
      );
    }

    await Promise.all(promises);
    return this.manifest;
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.floor(window.innerWidth * dpr);
    const h = Math.floor(window.innerHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  getScreenOrigin(isBattleView = false) {
    if (isBattleView && this.battle.state === "FORMATION") {
      return {
        x: this.canvas.width * 0.5,
        y: this.canvas.height * 0.43
      };
    }
    return {
      x: this.canvas.width * 0.5,
      y: this.canvas.height * 0.5
    };
  }

  screenToWorld(clientX, clientY, isBattleView = false) {
    const dpr = window.devicePixelRatio || 1;
    const sx = clientX * dpr;
    const sy = clientY * dpr;
    const cam = isBattleView ? this.battleCamera : this.camera;
    const scale = cam.zoom * dpr;
    const origin = this.getScreenOrigin(isBattleView);
    const wx = (sx - origin.x) / scale + cam.x;
    const wy = (sy - origin.y) / scale + cam.y;
    return { x: wx, y: wy };
  }

  worldToScreen(wx, wy, isBattleView = false) {
    const dpr = window.devicePixelRatio || 1;
    const cam = isBattleView ? this.battleCamera : this.camera;
    const scale = cam.zoom * dpr;
    const origin = this.getScreenOrigin(isBattleView);
    const sx = (wx - cam.x) * scale + origin.x;
    const sy = (wy - cam.y) * scale + origin.y;
    return { x: sx / dpr, y: sy / dpr };
  }

  tileHash(gx, gy) {
    let h = (gx * 374761393 + gy * 668265263) ^ 0x5bf03635;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return (h ^ (h >>> 16)) >>> 0;
  }

  drawSprite(key, x, y, w = null, h = null, flipX = false, alpha = 1.0) {
    const img = this.images.get(key);
    if (!img) return;
    const dw = w ?? img.width;
    const dh = h ?? img.height;
    const ctx = this.ctx;
    ctx.save();
    if (alpha < 1.0) ctx.globalAlpha = alpha;
    ctx.translate(Math.round(x), Math.round(y));
    if (flipX) ctx.scale(-1, 1);
    ctx.drawImage(img, Math.round(-dw * 0.5), Math.round(-dh * 0.5), Math.round(dw), Math.round(dh));
    ctx.restore();
  }

  drawSheetFrame(sheetKey, frameIndex, x, y, scale = 1.0, flipX = false, flashWhite = false) {
    const sheet = this.sheets.get(sheetKey);
    if (!sheet || !sheet.img) return;
    const f = ((frameIndex % sheet.frames) + sheet.frames) % sheet.frames;
    const sx = f * sheet.frameWidth;
    const dw = sheet.frameWidth * scale;
    const dh = sheet.frameHeight * scale;
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    if (flipX) ctx.scale(-1, 1);
    if (flashWhite) {
      ctx.filter = "brightness(3.5) contrast(2)";
    }
    ctx.drawImage(
      sheet.img,
      sx,
      0,
      sheet.frameWidth,
      sheet.frameHeight,
      Math.round(-dw * 0.5),
      Math.round(-dh * 0.5),
      Math.round(dw),
      Math.round(dh)
    );
    ctx.restore();
  }

  render(uiState) {
    this.resize();
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;

    const showBattle =
      (this.battle.state === "FORMATION" || this.battle.state === "IN_PROGRESS" || this.battle.state === "FINISHED") &&
      !this.battle.inBackground;

    if (showBattle) {
      this.renderBattleView(uiState);
    } else {
      this.renderColonyView(uiState);
    }
  }

  renderColonyView(uiState) {
    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    const scale = this.camera.zoom * dpr;

    ctx.fillStyle = "#16261c";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.save();
    ctx.translate(Math.round(this.canvas.width * 0.5), Math.round(this.canvas.height * 0.5));
    ctx.scale(scale, scale);
    ctx.translate(Math.round(-this.camera.x), Math.round(-this.camera.y));
    ctx.imageSmoothingEnabled = false;

    const ts = this.colony.tileSize;
    const gw = this.colony.gridWidth;
    const gh = this.colony.gridHeight;

    // 1. Render Grass Tilemap
    const grassVariants = [
      "tile_grass_0",
      "tile_grass_1",
      "tile_grass_2",
      "tile_grass_3",
      "tile_grass_4",
      "tile_grass_5",
      "tile_grass_6"
    ];

    for (let gy = 0; gy < gh; gy++) {
      for (let gx = 0; gx < gw; gx++) {
        const h = this.tileHash(gx, gy);
        const cx = (gx + 0.5) * ts;
        const cy = (gy + 0.5) * ts;

        // Base emerald meadow fill
        ctx.fillStyle = (gx + gy) % 2 === 0 ? "#477d3b" : "#437737";
        ctx.fillRect(gx * ts, gy * ts, ts + 0.5, ts + 0.5);

        const gKey = grassVariants[h % grassVariants.length];
        this.drawSprite(gKey, cx, cy, ts, ts);

        if (h % 19 === 0) {
          this.drawSprite("tile_grass_flower1", cx, cy, ts * 0.5, ts * 0.5);
        } else if (h % 23 === 0) {
          this.drawSprite("tile_grass_flower2", cx, cy, ts * 0.5, ts * 0.5);
        } else if (h % 29 === 0) {
          this.drawSprite("tile_grass_pebble", cx, cy, ts * 0.5, ts * 0.5);
        }
      }
    }

    // 2. RenderCourier Routes when hovering a building or linking Move Goods
    this.renderCourierRoutes(uiState);

    // 3. Collect all Y-sorted renderables (Forest trees, Buildings, Decorations, Minions)
    const drawList = [];

    // Outer permanent forest border & uncleared forest chunks
    for (let gy = 0; gy < gh; gy++) {
      for (let gx = 0; gx < gw; gx++) {
        if (!this.colony.isTileCleared(gx, gy)) {
          const h = this.tileHash(gx, gy);
          const treeSprites = ["tile_tree_0", "tile_tree_1", "tile_tree_2", "tile_tree_3", "tile_tree_4"];
          const tKey = treeSprites[h % treeSprites.length];
          const wx = (gx + 0.5) * ts;
          const wy = (gy + 0.5) * ts;
          drawList.push({
            sortY: wy,
            draw: () => {
              ctx.fillStyle = "#254427";
              ctx.fillRect(gx * ts, gy * ts, ts + 0.5, ts + 0.5);
              this.drawSprite(tKey, wx, wy - 4, ts * 1.35, ts * 1.35);
            }
          });
        }
      }
    }

    // Placed Buildings
    for (const b of this.colony.buildings) {
      drawList.push({
        sortY: b.y + b.h * ts * 0.35,
        draw: () => this.drawBuilding(b, uiState)
      });
    }

    // Placed Decorations
    for (const d of this.colony.decorations) {
      drawList.push({
        sortY: d.y + d.h * ts * 0.3,
        draw: () => this.drawDecoration(d, uiState)
      });
    }

    // Colony Minions (biased sortY +18 so working/carrying minions always draw in front of building roofs)
    for (const m of this.colony.minions) {
      drawList.push({
        sortY: m.y + 18,
        draw: () => this.drawColonyMinion(m, uiState)
      });
    }

    drawList.sort((a, b) => a.sortY - b.sortY);
    for (const item of drawList) {
      item.draw();
    }

    // 4. Placement Ghost / Buy Land Chunk Highlight
    this.renderPlacementPreview(uiState);

    // 5. Particles
    for (const p of this.colony.particles) {
      const sheet = this.sheets.get(p.sheet);
      if (sheet) {
        const frame = Math.floor((p.elapsed / p.duration) * sheet.frames);
        this.drawSheetFrame(p.sheet, frame, p.x, p.y, p.scale);
      }
    }

    // 6. Floating Text Popups
    this.renderFloatingTexts(this.colony.floatingTexts);

    // 7. Light 2D Radial Torchlight Vignette
    this.renderColonyLighting();

    ctx.restore();

    // 8. Screen-space Box Selection Marquee
    if (uiState.dragBox) {
      const { x1, y1, x2, y2 } = uiState.dragBox;
      const rx = Math.min(x1, x2) * dpr;
      const ry = Math.min(y1, y2) * dpr;
      const rw = Math.abs(x2 - x1) * dpr;
      const rh = Math.abs(y2 - y1) * dpr;
      ctx.save();
      ctx.fillStyle = "rgba(115, 230, 89, 0.16)";
      ctx.strokeStyle = "#73e659";
      ctx.lineWidth = 2 * dpr;
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.restore();
    }
  }

  drawBuilding(b, uiState) {
    const ctx = this.ctx;
    const ts = this.colony.tileSize;
    const def = BUILDINGS[b.type];
    const pw = b.w * ts;
    const ph = b.h * ts;

    // Subtle ground shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.beginPath();
    ctx.ellipse(b.x, b.y + ph * 0.36, pw * 0.46, ph * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();

    if (b.type === "Smith") {
      this.drawSprite("building_smith_shadow", b.x, b.y, pw, ph);
      this.drawSprite("building_smith", b.x, b.y, pw, ph);
      const furnaceFrame = b.workers.length > 0 ? Math.floor(b.animTime * 8) : 0;
      this.drawSheetFrame("prop_furnace", furnaceFrame, b.x + 14, b.y - 12, 1.0);
      const anvilFrame = b.workers.length > 0 ? Math.floor(b.animTime * 10) : 0;
      this.drawSheetFrame("prop_anvil", anvilFrame, b.x - 10, b.y + 8, 1.0);
      this.drawSprite("building_smith_sharpening", b.x + 8, b.y + 14, 28, 14);
    } else if (b.type === "Armourer") {
      this.drawSprite("building_armourer", b.x, b.y, pw, ph);
      this.drawSprite("building_armourer_workbench", b.x - 8, b.y + 8, 28, 28);
      this.drawSprite("building_armourer_loom", b.x + 12, b.y - 4, 19, 17);
    } else if (b.type === "Farm") {
      this.drawSprite("building_farm", b.x, b.y, pw, ph);
      // Draw crop rows on the farm plot
      for (let ry = -1; ry <= 1; ry++) {
        for (let rx = -1; rx <= 1; rx++) {
          this.drawSprite("res_carrot_crop", b.x + rx * 14, b.y + ry * 11 + 2, 14, 14);
        }
      }
    } else if (b.type === "WizardTower") {
      this.drawSprite("building_wizard_tower", b.x, b.y - 12, pw * 0.9, ph * 1.15);
    } else {
      this.drawSprite(def.sprite, b.x, b.y, pw, ph);
    }

    // Selection or Hover outline
    if (uiState.selectedBuildingId === b.id || uiState.hoveredBuildingId === b.id) {
      ctx.strokeStyle = "#ffdd55";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(b.x - pw * 0.5, b.y - ph * 0.5, pw, ph);
    }

    // Level Roman Numeral Badge + Worker count for upgradable buildings
    const lv = this.colony.getBuildingLevelInfo(b);
    if (lv) {
      ctx.save();
      ctx.font = "bold 7px 'YosterIsland', monospace";
      ctx.textAlign = "center";
      const badgeText = `${lv.roman} (${b.workers.length}/${lv.workerLimit})`;
      const bw = ctx.measureText(badgeText).width + 8;
      ctx.fillStyle = "rgba(22, 30, 46, 0.85)";
      ctx.fillRect(b.x - bw * 0.5, b.y + ph * 0.5 - 6, bw, 10);
      ctx.strokeStyle = "#d9a066";
      ctx.lineWidth = 0.75;
      ctx.strokeRect(b.x - bw * 0.5, b.y + ph * 0.5 - 6, bw, 10);
      ctx.fillStyle = "#ffe599";
      ctx.fillText(badgeText, b.x, b.y + ph * 0.5 + 1.5);
      ctx.restore();

      // Active work progress bar
      let targetSec = def.workSeconds || 5;
      if (b.type === "Smith" || b.type === "Armourer") {
        const tiers = b.type === "Smith" ? WEAPON_TIERS : ARMOUR_TIERS;
        targetSec = tiers[b.selectedRecipeIndex || 0]?.craftSeconds || 8;
      } else if (b.type === "WizardTower") {
        const ench = ENCHANTMENTS[b.selectedEnchantment || "Lifesteal"];
        targetSec = (ench?.enchantSeconds || 10) / (lv.speedBonus || 1);
      }
      if (b.workProgress > 0.05 && b.workers.length > 0) {
        const pct = Math.min(1, b.workProgress / targetSec);
        const barW = pw * 0.7;
        const barX = b.x - barW * 0.5;
        const barY = b.y - ph * 0.5 - 7;
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(barX - 1, barY - 1, barW + 2, 4);
        ctx.fillStyle = "#63c64d";
        ctx.fillRect(barX, barY, barW * pct, 2.5);
      }

      // Crafting / Enchanting thought bubble above Smith, Armourer, WizardTower
      if (b.type === "Smith" || b.type === "Armourer" || b.type === "WizardTower") {
        const bx = b.x + pw * 0.32;
        const by = b.y - ph * 0.45;
        this.drawSprite("ui_bubble", bx, by, 18, 21);
        if (b.type === "Smith") {
          const sp = WEAPON_TIERS[b.selectedRecipeIndex || 0]?.sprite || "weapon_copper";
          this.drawSprite(sp, bx, by - 2, 11, 11);
        } else if (b.type === "Armourer") {
          const sp = ARMOUR_TIERS[b.selectedRecipeIndex || 0]?.sprite || "armour_copper";
          this.drawSprite(sp, bx, by - 2, 11, 11);
        } else if (b.type === "WizardTower") {
          const sp = ENCHANTMENTS[b.selectedEnchantment || "Lifesteal"]?.sprite || "enchant_lifesteal";
          this.drawSprite(sp, bx, by - 2, 11, 11);
        }
      }
    }
  }

  drawDecoration(d, uiState) {
    const def = DECORATIONS[d.type];
    const ts = this.colony.tileSize;
    const pw = d.w * ts;
    const ph = d.h * ts;
    if (def?.sheet) {
      const sheet = this.sheets.get(def.sheet);
      const frame = sheet ? Math.floor(d.animTime * 7) % sheet.frames : 0;
      this.drawSheetFrame(def.sheet, frame, d.x, d.y - 4, 1.0);
    } else if (def?.sprite) {
      this.drawSprite(def.sprite, d.x, d.y - 2, pw, ph);
    }
    if (uiState.quickSellDecorMode) {
      this.ctx.strokeStyle = "rgba(255, 90, 90, 0.85)";
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(d.x - pw * 0.5, d.y - ph * 0.5, pw, ph);
    }
  }

  drawColonyMinion(m, uiState) {
    const def = MINION_TYPES[m.type] || MINION_TYPES.Goblin;
    const isMoving = Math.hypot(m.vx, m.vy) > 2;
    const sheetKey = `${def.sheetPrefix}_${isMoving ? "walk" : "idle"}`;
    const sheet = this.sheets.get(sheetKey) || this.sheets.get(`${def.sheetPrefix}_idle`);
    const frame = sheet ? Math.floor(m.animTime * (isMoving ? 10 : 6)) % sheet.frames : 0;

    // Ground shadow
    this.drawSprite("ui_shadow_small", m.x, m.y + 7, 16, 7, false, 0.75);

    // Selection indicator
    if (uiState.selectedMinionIds && uiState.selectedMinionIds.has(m.id)) {
      this.drawSprite("ui_selector_box", m.x, m.y - 1, 20, 20);
    }

    // Character sprite at 1.35x scale so pixel characters are crisp and unmistakable
    this.drawSheetFrame(sheetKey, frame, m.x, m.y - 3, 1.35, m.facing < 0);

    // Carried item bobbing overhead (Update 0.2.0 signature visual)
    if (m.carriedItem) {
      const bob = Math.sin(m.animTime * 9) * 1.5;
      const iy = m.y - 17 + bob;
      if (m.carriedItem.enchantment) {
        const enchSp = ENCHANTMENTS[m.carriedItem.enchantment]?.sprite;
        if (enchSp) this.drawSprite(enchSp, m.x, iy, 16, 16);
      }
      this.drawSprite(m.carriedItem.sprite, m.x, iy, 13, 13);
    } else if (m.emote) {
      const bob = Math.sin(m.animTime * 6) * 1.0;
      this.drawSprite(m.emote, m.x, m.y - 18 + bob, 13, 13);
    }
  }

  renderCourierRoutes(uiState) {
    const ctx = this.ctx;
    // Draw active courier routes for selected/hovered building, or when in Move Goods linking mode
    const activeBuildingId = uiState.selectedBuildingId || uiState.hoveredBuildingId || uiState.moveGoodsSourceId;

    for (const b of this.colony.buildings) {
      if (activeBuildingId && b.id !== activeBuildingId) {
        // Also show if any courier from b goes to activeBuildingId
        const linksToActive = b.couriers.some((cid) => this.colony.getMinion(cid)?.courierToId === activeBuildingId);
        if (!linksToActive) continue;
      } else if (!activeBuildingId && !uiState.showAllRoutes) {
        continue;
      }

      // Group routes by destination
      const destCounts = new Map();
      for (const cid of b.couriers) {
        const m = this.colony.getMinion(cid);
        if (m && m.courierToId) {
          destCounts.set(m.courierToId, (destCounts.get(m.courierToId) || 0) + 1);
        }
      }
      for (const [toId, count] of destCounts.entries()) {
        const toB = this.colony.getBuilding(toId);
        if (!toB) continue;
        this.drawRouteArrow(b.x, b.y, toB.x, toB.y, "#6be5ff", `${count}`);
      }
    }

    // Live interactive arrow while choosing Move Goods destination
    if (uiState.commandStep === "SELECT_MOVE_DEST" && uiState.moveGoodsSourceId && uiState.worldMouse) {
      const fromB = this.colony.getBuilding(uiState.moveGoodsSourceId);
      if (fromB) {
        this.drawRouteArrow(fromB.x, fromB.y, uiState.worldMouse.x, uiState.worldMouse.y, "#ffdd55", "Move");
      }
    }
  }

  drawRouteArrow(x1, y1, x2, y2, color = "#6be5ff", label = "") {
    const ctx = this.ctx;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 8) return;
    const ux = dx / len;
    const uy = dy / len;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.lineDashOffset = -(performance.now() * 0.02) % 7;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Arrowhead
    const ax = x2 - ux * 10;
    const ay = y2 - uy * 10;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(ax - uy * 5, ay + ux * 5);
    ctx.lineTo(ax + uy * 5, ay - ux * 5);
    ctx.closePath();
    ctx.fill();

    if (label) {
      const mx = (x1 + x2) * 0.5;
      const my = (y1 + y2) * 0.5;
      ctx.font = "bold 7px 'YosterIsland', monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "#161e2e";
      ctx.fillRect(mx - 8, my - 5, 16, 10);
      ctx.fillStyle = color;
      ctx.fillText(label, mx, my + 2.5);
    }
    ctx.restore();
  }

  renderPlacementPreview(uiState) {
    if (!uiState.worldMouse) return;
    const ctx = this.ctx;
    const ts = this.colony.tileSize;
    const gx = Math.floor(uiState.worldMouse.x / ts);
    const gy = Math.floor(uiState.worldMouse.y / ts);

    if (uiState.placementMode === "BUILDING" && uiState.placementType) {
      const def = BUILDINGS[uiState.placementType];
      if (!def) return;
      const { w, h } = def.footprint;
      const tx = gx - Math.floor(w * 0.5);
      const ty = gy - Math.floor(h * 0.5);
      const valid = this.colony.canPlaceFootprint(tx, ty, w, h) && this.colony.gold >= def.cost;
      const wx = (tx + w * 0.5) * ts;
      const wy = (ty + h * 0.5) * ts;

      ctx.save();
      ctx.fillStyle = valid ? "rgba(99, 198, 77, 0.28)" : "rgba(232, 93, 93, 0.35)";
      ctx.strokeStyle = valid ? "#73e659" : "#e85d5d";
      ctx.lineWidth = 1.5;
      ctx.fillRect(tx * ts, ty * ts, w * ts, h * ts);
      ctx.strokeRect(tx * ts, ty * ts, w * ts, h * ts);
      this.drawSprite(def.sprite, wx, wy, w * ts, h * ts, false, 0.72);
      ctx.restore();
    } else if (uiState.placementMode === "MOVE_BUILDING" && uiState.movingBuildingId) {
      const b = this.colony.getBuilding(uiState.movingBuildingId);
      if (!b) return;
      const def = BUILDINGS[b.type];
      const tx = gx - Math.floor(b.w * 0.5);
      const ty = gy - Math.floor(b.h * 0.5);
      const valid = this.colony.canPlaceFootprint(tx, ty, b.w, b.h, b.id);
      const wx = (tx + b.w * 0.5) * ts;
      const wy = (ty + b.h * 0.5) * ts;

      ctx.save();
      ctx.fillStyle = valid ? "rgba(107, 229, 255, 0.28)" : "rgba(232, 93, 93, 0.35)";
      ctx.strokeStyle = valid ? "#6be5ff" : "#e85d5d";
      ctx.lineWidth = 1.5;
      ctx.fillRect(tx * ts, ty * ts, b.w * ts, b.h * ts);
      ctx.strokeRect(tx * ts, ty * ts, b.w * ts, b.h * ts);
      this.drawSprite(def.sprite, wx, wy, b.w * ts, b.h * ts, false, 0.75);
      ctx.restore();
    } else if (uiState.placementMode === "DECOR" && uiState.placementType) {
      const def = DECORATIONS[uiState.placementType];
      if (!def) return;
      if (def.isLandClear) {
        const chunk = this.colony.forestChunks.find(
          (c) => !c.cleared && gx >= c.gx && gx < c.gx + c.w && gy >= c.gy && gy < c.gy + c.h
        );
        if (chunk) {
          const cost = this.colony.getBuyLandCost();
          const canAfford = this.colony.gold >= cost;
          ctx.save();
          ctx.fillStyle = canAfford ? "rgba(255, 221, 85, 0.25)" : "rgba(232, 93, 93, 0.3)";
          ctx.strokeStyle = canAfford ? "#ffdd55" : "#e85d5d";
          ctx.lineWidth = 2;
          ctx.fillRect(chunk.gx * ts, chunk.gy * ts, chunk.w * ts, chunk.h * ts);
          ctx.strokeRect(chunk.gx * ts, chunk.gy * ts, chunk.w * ts, chunk.h * ts);
          ctx.font = "bold 9px 'YosterIsland', monospace";
          ctx.textAlign = "center";
          ctx.fillStyle = "#ffffff";
          ctx.fillText(`Clear Land: ${cost}g`, (chunk.gx + 2) * ts, (chunk.gy + 2) * ts);
          ctx.restore();
        }
      } else {
        const { w, h } = def.footprint;
        const valid = this.colony.canPlaceFootprint(gx, gy, w, h) && this.colony.gold >= def.cost;
        const wx = (gx + w * 0.5) * ts;
        const wy = (gy + h * 0.5) * ts;
        ctx.save();
        ctx.fillStyle = valid ? "rgba(99, 198, 77, 0.28)" : "rgba(232, 93, 93, 0.35)";
        ctx.fillRect(gx * ts, gy * ts, w * ts, h * ts);
        this.drawSprite(def.sprite, wx, wy, w * ts, h * ts, false, 0.75);
        ctx.restore();
      }
    } else if (uiState.placementMode === "MINION" && uiState.placementType) {
      const def = MINION_TYPES[uiState.placementType];
      if (!def) return;
      const valid = this.colony.isTileCleared(gx, gy) && this.colony.gold >= def.cost;
      ctx.save();
      ctx.strokeStyle = valid ? "#73e659" : "#e85d5d";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(uiState.worldMouse.x, uiState.worldMouse.y, 10, 0, Math.PI * 2);
      ctx.stroke();
      this.drawSprite(def.icon, uiState.worldMouse.x, uiState.worldMouse.y - 2, 14, 14, false, 0.8);
      ctx.restore();
    }
  }

  renderColonyLighting() {
    const ctx = this.ctx;
    const ts = this.colony.tileSize;
    const cx = 18 * ts;
    const cy = 11.5 * ts;

    // Soft radial torchlight falloff (Light 2D)
    const grad = ctx.createRadialGradient(cx, cy, ts * 8, cx, cy, ts * 20);
    grad.addColorStop(0, "rgba(255, 240, 190, 0.04)");
    grad.addColorStop(0.65, "rgba(15, 25, 20, 0.12)");
    grad.addColorStop(1, "rgba(6, 12, 10, 0.58)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.colony.gridWidth * ts, this.colony.gridHeight * ts);
  }

  renderBattleView(uiState) {
    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    const scale = this.battleCamera.zoom * dpr;
    const tilePx = 28;

    ctx.fillStyle = "#142219";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.save();
    const origin = this.getScreenOrigin(true);
    ctx.translate(Math.round(origin.x), Math.round(origin.y));
    ctx.scale(scale, scale);
    ctx.translate(Math.round(-this.battleCamera.x), Math.round(-this.battleCamera.y));
    ctx.imageSmoothingEnabled = false;

    const arenaW = 12;
    const arenaH = 8;

    // 1. Render Battle Meadow & Perimeter Forest
    for (let gy = -arenaH; gy <= arenaH; gy++) {
      for (let gx = -arenaW; gx <= arenaW; gx++) {
        const wx = gx * tilePx;
        const wy = gy * tilePx;
        const inClearedArena = gx >= -6 && gx <= 6 && gy >= -3 && gy <= 3;
        ctx.fillStyle = (gx + gy) % 2 === 0 ? "#477d3b" : "#427536";
        ctx.fillRect(wx - tilePx * 0.5, wy - tilePx * 0.5, tilePx + 0.5, tilePx + 0.5);
        this.drawSprite("tile_grass_0", wx, wy, tilePx, tilePx);

        if (!inClearedArena) {
          const h = this.tileHash(gx + 50, gy + 50);
          const tKey = `tile_tree_${h % 5}`;
          this.drawSprite(tKey, wx, wy - 4, tilePx * 1.35, tilePx * 1.35);
        }
      }
    }

    // 2. If in FORMATION state, render the 5x5 Ally Placement Grid (-5..-1, -2..2) and Enemy Previews
    if (this.battle.state === "FORMATION" && this.battle.currentMission) {
      for (let gy = -2; gy <= 2; gy++) {
        for (let gx = -5; gx <= -1; gx++) {
          const wx = gx * tilePx;
          const wy = gy * tilePx;
          const isHovered =
            uiState.hoveredFormationTile &&
            uiState.hoveredFormationTile.gx === gx &&
            uiState.hoveredFormationTile.gy === gy;
          ctx.fillStyle = isHovered ? "rgba(255, 221, 85, 0.35)" : "rgba(255, 255, 255, 0.14)";
          ctx.strokeStyle = isHovered ? "#ffdd55" : "rgba(18, 28, 20, 0.75)";
          ctx.lineWidth = isHovered ? 1.5 : 1;
          ctx.fillRect(wx - tilePx * 0.48, wy - tilePx * 0.48, tilePx * 0.96, tilePx * 0.96);
          ctx.strokeRect(wx - tilePx * 0.48, wy - tilePx * 0.48, tilePx * 0.96, tilePx * 0.96);
        }
      }

      // Draw placed ally formation slots
      for (const slot of this.battle.formation) {
        const wx = slot.gx * tilePx;
        const wy = slot.gy * tilePx;
        const def = MINION_TYPES[slot.race] || MINION_TYPES.Goblin;
        this.drawSprite("ui_shadow_small", wx, wy + 8, 18, 8, false, 0.75);
        const frame = Math.floor((performance.now() * 0.006) % 8);
        this.drawSheetFrame(`${def.sheetPrefix}_idle`, frame, wx, wy - 3, 1.55, false);

        // Lime health bar indicator under ally unit (matching ref_formation.jpg)
        ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
        ctx.fillRect(wx - 9, wy + 9, 18, 3);
        ctx.fillStyle = "#58e84c";
        ctx.fillRect(wx - 8.5, wy + 9.5, 17, 2);

        // Draw equipped weapon / armour mini-icons at bottom corners of tile
        if (slot.weapon) {
          if (slot.weapon.enchantment) {
            this.drawSprite(ENCHANTMENTS[slot.weapon.enchantment]?.sprite, wx - 9, wy - 9, 11, 11);
          }
          this.drawSprite(slot.weapon.sprite, wx - 9, wy - 9, 10, 10);
        }
        if (slot.armour) {
          if (slot.armour.enchantment) {
            this.drawSprite(ENCHANTMENTS[slot.armour.enchantment]?.sprite, wx + 9, wy - 9, 11, 11);
          }
          this.drawSprite(slot.armour.sprite, wx + 9, wy - 9, 10, 10);
        }
      }

      // Draw enemy formation preview on right side
      for (const e of this.battle.currentMission.enemies) {
        const wx = (e.x + 1.2) * tilePx;
        const wy = e.y * tilePx;
        const def = MINION_TYPES[e.race] || MINION_TYPES.Fighter;
        const isBoss = Boolean(e.isBoss || (e.health && e.health >= 4.0));
        this.drawSprite("ui_shadow_small", wx, wy + 8, isBoss ? 26 : 18, 8, false, 0.75);
        const frame = Math.floor((performance.now() * 0.006) % 8);
        this.drawSheetFrame(`${def.sheetPrefix}_idle`, frame, wx, wy - 3, isBoss ? 2.1 : 1.55, true);

        // Red health bar indicator under enemy unit
        const bw = isBoss ? 24 : 18;
        ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
        ctx.fillRect(wx - bw * 0.5, wy + 9, bw, 3);
        ctx.fillStyle = "#ff4d4d";
        ctx.fillRect(wx - bw * 0.5 + 0.5, wy + 9.5, bw - 1, 2);
      }
    } else {
      // 3. Render Live Combat Units sorted by Y
      const sortedUnits = [...this.battle.units].sort((a, b) => a.y - b.y);
      for (const u of sortedUnits) {
        if (u.dead && u.deathTimer <= 0) continue;
        const def = MINION_TYPES[u.race] || MINION_TYPES.Goblin;
        const sheetKey = `${def.sheetPrefix}_${u.animState}`;
        const sheet = this.sheets.get(sheetKey) || this.sheets.get(`${def.sheetPrefix}_idle`);
        const fps = u.animState === "attack" ? 12 : u.animState === "walk" ? 10 : 7;
        const frame = sheet ? Math.floor(u.animTime * fps) % sheet.frames : 0;
        const uScale = u.isBoss ? 2.1 : 1.55;

        // Shadow stays on ground (u.y), sprite rises by u.z when knocked up
        this.drawSprite("ui_shadow_small", u.x, u.y + 8, 18 * (u.isBoss ? 1.4 : 1.0), 8, false, 0.75);
        this.drawSheetFrame(
          sheet ? sheetKey : `${def.sheetPrefix}_idle`,
          frame,
          u.x,
          u.y - 3 - u.z,
          uScale,
          u.facing < 0,
          u.flashTimer > 0
        );

        // Always render unit health bar below feet (matching ref_battle.jpg)
        if (!u.dead) {
          const bw = u.isBoss ? 28 : 18;
          const bx = u.x - bw * 0.5;
          const by = u.y + 9;
          ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
          ctx.fillRect(bx - 1, by - 1, bw + 2, 4);
          ctx.fillStyle = u.team === "ally" ? "#58e84c" : "#ff4d4d";
          ctx.fillRect(bx, by, bw * Math.max(0, u.hp / u.maxHp), 2.5);
        }
      }

      // 4. Render Projectiles
      for (const p of this.battle.projectiles) {
        const angle = Math.atan2(p.ty - p.y, p.tx - p.x);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(angle);
        this.drawSprite(p.sprite || "proj_arrow", 0, 0, 10, 10);
        ctx.restore();
      }

      // 5. Render Combat VFX (Chain Lightning, Cyclops Laser, Meteors, Shockwaves, Flames)
      for (const v of this.battle.vfx) {
        if (v.type === "chain_beam" || v.type === "laser_beam") {
          this.drawJaggedBeam(v.x1, v.y1, v.x2, v.y2, v.color, v.type === "chain_beam");
        } else if (v.type === "sheet") {
          const sheet = this.sheets.get(v.sheet);
          if (sheet) {
            const frame = Math.floor((v.elapsed / v.duration) * sheet.frames);
            this.drawSheetFrame(v.sheet, frame, v.x, v.y, v.scale);
          }
        }
      }

      // 6. Floating Damage & Heal Numbers
      this.renderFloatingTexts(this.battle.floatingTexts);
    }

    // Radial torchlight vignette around the battle arena
    const grad = ctx.createRadialGradient(0, 0, tilePx * 4, 0, 0, tilePx * 10);
    grad.addColorStop(0, "rgba(255, 240, 190, 0.03)");
    grad.addColorStop(1, "rgba(6, 12, 10, 0.55)");
    ctx.fillStyle = grad;
    ctx.fillRect(-arenaW * tilePx, -arenaH * tilePx, arenaW * 2 * tilePx, arenaH * 2 * tilePx);

    ctx.restore();
  }

  drawJaggedBeam(x1, y1, x2, y2, color = "#6be5ff", jagged = true) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = jagged ? 2.2 : 3.0;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    if (jagged) {
      const segments = 5;
      for (let i = 1; i < segments; i++) {
        const t = i / segments;
        const jx = x1 + (x2 - x1) * t + (Math.random() - 0.5) * 8;
        const jy = y1 + (y2 - y1) * t + (Math.random() - 0.5) * 8;
        ctx.lineTo(jx, jy);
      }
    }
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.0;
    ctx.stroke();
    ctx.restore();
  }

  renderFloatingTexts(list) {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = "bold 8px 'YosterIsland', monospace";
    ctx.textAlign = "center";
    for (const ft of list) {
      const alpha = Math.min(1, ft.life / (ft.maxLife * 0.4));
      ctx.globalAlpha = alpha;
      const offsetX = ft.icon ? -5 : 0;
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 2.5;
      ctx.strokeText(ft.text, ft.x + offsetX, ft.y);
      ctx.fillStyle = ft.color || "#ffffff";
      ctx.fillText(ft.text, ft.x + offsetX, ft.y);
      if (ft.icon) {
        const tw = ctx.measureText(ft.text).width;
        this.drawSprite(ft.icon, ft.x + tw * 0.5 + 2, ft.y - 3, 9, 9, false, alpha);
      }
    }
    ctx.restore();
  }
}
