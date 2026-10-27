/**
 * Real-time Colony Simulation, Logistics, Crafting, Enchanting, Morale,
 * 7-Step Tutorial, and Save/Load Engine for Minion Colony.
 */

import {
  ARMOUR_TIERS,
  BUILDINGS,
  DECORATIONS,
  ENCHANTMENTS,
  MINION_TYPES,
  MISSIONS,
  RESOURCES,
  WEAPON_TIERS,
  computeTaskGrade
} from "../data/game-data.js";
import { t } from "../data/localization.js";

export class ColonySim {
  constructor(audio = null) {
    this.audio = audio;
    this.gridWidth = 36;
    this.gridHeight = 24;
    this.tileSize = 24;
    this.nextId = 1;
    this.resetNewGame();
  }

  allocId(prefix = "ent") {
    return `${prefix}_${this.nextId++}`;
  }

  resetNewGame() {
    this.nextId = 1;
    this.gold = 220;
    this.totalGoldEarned = 220;
    this.elapsedTime = 0;

    // Settings
    this.settings = {
      enableMorale: true,
      musicVolume: 0.7,
      colonySfxVolume: 0.8,
      battleSfxVolume: 0.8,
      uiSfxVolume: 0.8
    };

    // Unlocks set (keys from mission rewards)
    this.unlocks = new Set([
      "Goblin",
      "Troll",
      "Mine",
      "Farm",
      "Lifesteal",
      "BurningStrikes",
      "Thorns"
    ]);

    // Central Store House inventory:
    // resources: { Metal: number, Carrot: number, GoldenCarrot: number, Amethyst: number, Sapphire: number, Ruby: number }
    // equipment: Array<{ uid, itemId, category: 'weapon'|'armour', tierIndex, enchantment: string|null, sellGold, potencyBonus, durabilityBonus, sprite }>
    this.resources = {
      Metal: 20,
      Carrot: 10,
      GoldenCarrot: 0,
      Amethyst: 0,
      Sapphire: 0,
      Ruby: 0
    };
    this.equipment = [];

    // Barracks reserve pool: { Goblin: number, Troll: number, ... }
    this.barracks = {
      Goblin: 4,
      Troll: 2,
      LightningMage: 0,
      Sapling: 0,
      Cyclops: 0,
      Demon: 0,
      Giant: 0
    };

    // Completed missions
    this.completedMissions = new Set();

    // Forest chunks around the central meadow (clearable via Buy Land)
    this.forestChunks = this.createInitialForestChunks();
    this.landPurchasesCount = 0;

    // Placed buildings & decorations
    this.buildings = [];
    this.decorations = [];
    this.minions = [];

    // Transient visual effects & floating popups
    this.floatingTexts = [];
    this.particles = [];

    // Pre-place Store House, Barracks, and Market at colony center
    this.storeHouse = this.placeBuildingInternal("StoreHouse", 16, 10, true);
    this.barracksBuilding = this.placeBuildingInternal("Barracks", 10, 9, true);
    this.marketBuilding = this.placeBuildingInternal("Market", 16, 5, true);

    // Spawn starter minions in the colony meadow so characters are immediately visible
    const starterPositions = [
      { type: "Goblin", x: 15.5 * this.tileSize, y: 13.8 * this.tileSize },
      { type: "Goblin", x: 17.0 * this.tileSize, y: 14.2 * this.tileSize },
      { type: "Goblin", x: 18.5 * this.tileSize, y: 13.8 * this.tileSize },
      { type: "Goblin", x: 16.2 * this.tileSize, y: 15.0 * this.tileSize },
      { type: "Troll", x: 14.2 * this.tileSize, y: 13.5 * this.tileSize },
      { type: "Troll", x: 19.5 * this.tileSize, y: 13.5 * this.tileSize }
    ];
    for (const sp of starterPositions) {
      this.minions.push({
        id: this.allocId("min"),
        type: sp.type,
        x: sp.x,
        y: sp.y,
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
        animTime: Math.random() * 5,
        wanderTimer: 0.5 + Math.random() * 1.5,
        wanderTarget: null
      });
    }

    // Tutorial state (steps 1..7, 8 = completed)
    this.tutorialStep = 1;
    this.tutorialCompleted = false;

    // Cached morale stats
    this.moraleScore = 0;
    this.moraleEfficiency = 1.0;
    this.recalculateMorale();
  }

  createInitialForestChunks() {
    const chunks = [];
    // Grid is 36x24. Inner cleared area is x: 6..29, y: 3..20.
    // Perimeter 4x4 chunks can be cleared via Buy Land.
    let idx = 1;
    for (let cy = 0; cy < this.gridHeight; cy += 4) {
      for (let cx = 0; cx < this.gridWidth; cx += 4) {
        const isInner = cx >= 8 && cx <= 24 && cy >= 4 && cy <= 16;
        if (!isInner) {
          const borderClearable = cx >= 4 && cx <= 28 && cy >= 0 && cy <= 20;
          chunks.push({
            id: `chunk_${idx++}`,
            gx: cx,
            gy: cy,
            w: 4,
            h: 4,
            cleared: false,
            clearable: borderClearable
          });
        }
      }
    }
    return chunks;
  }

  isTileCleared(gx, gy) {
    if (gx < 2 || gy < 1 || gx >= this.gridWidth - 2 || gy >= this.gridHeight - 1) {
      return false;
    }
    for (const chunk of this.forestChunks) {
      if (!chunk.cleared && gx >= chunk.gx && gx < chunk.gx + chunk.w && gy >= chunk.gy && gy < chunk.gy + chunk.h) {
        return false;
      }
    }
    return true;
  }

  canPlaceFootprint(gx, gy, w, h, ignoreBuildingId = null) {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const tx = gx + dx;
        const ty = gy + dy;
        if (!this.isTileCleared(tx, ty)) return false;
      }
    }
    for (const b of this.buildings) {
      if (b.id === ignoreBuildingId) continue;
      if (gx < b.gx + b.w && gx + w > b.gx && gy < b.gy + b.h && gy + h > b.gy) {
        return false;
      }
    }
    for (const d of this.decorations) {
      if (gx < d.gx + d.w && gx + w > d.gx && gy < d.gy + d.h && gy + h > d.gy) {
        return false;
      }
    }
    return true;
  }

  placeBuildingInternal(typeId, gx, gy, free = false) {
    const def = BUILDINGS[typeId];
    if (!def) return null;
    const { w, h } = def.footprint;
    if (!free && !this.canPlaceFootprint(gx, gy, w, h)) return null;
    if (!free) {
      if (this.gold < def.cost) return null;
      this.gold -= def.cost;
    }
    const b = {
      id: this.allocId("bld"),
      type: typeId,
      gx,
      gy,
      w,
      h,
      x: (gx + w * 0.5) * this.tileSize,
      y: (gy + h * 0.5) * this.tileSize,
      level: 1,
      workers: [],
      couriers: [],
      workProgress: 0,
      input: [],
      output: [],
      selectedRecipeIndex: 0,
      selectedEnchantment: "Lifesteal",
      animTime: 0
    };
    this.buildings.push(b);
    this.spawnParticles("vfx_smoke_place", b.x, b.y, 1);
    if (!free && this.audio) this.audio.playColonySfx("heavy-thud");
    if (this.tutorialStep === 1 && typeId === "Mine") {
      this.advanceTutorial(1, 30);
    }
    return b;
  }

  placeBuilding(typeId, gx, gy) {
    const def = BUILDINGS[typeId];
    if (!def || !def.placeable) return null;
    if (!this.isUnlocked(def.unlockKey || typeId)) return null;
    return this.placeBuildingInternal(typeId, gx, gy, false);
  }

  moveBuilding(buildingId, newGx, newGy) {
    const b = this.getBuilding(buildingId);
    if (!b) return false;
    if (!this.canPlaceFootprint(newGx, newGy, b.w, b.h, b.id)) return false;
    b.gx = newGx;
    b.gy = newGy;
    b.x = (newGx + b.w * 0.5) * this.tileSize;
    b.y = (newGy + b.h * 0.5) * this.tileSize;
    this.spawnParticles("vfx_smoke_place", b.x, b.y, 1);
    if (this.audio) this.audio.playColonySfx("light-thud");
    return true;
  }

  sellBuilding(buildingId) {
    const idx = this.buildings.findIndex((b) => b.id === buildingId);
    if (idx === -1) return false;
    const b = this.buildings[idx];
    const def = BUILDINGS[b.type];
    if (!def || !def.placeable) return false;

    this.ejectAllWorkers(b.id);
    this.ejectAllCouriers(b.id);
    // Also eject couriers targeting this building
    for (const other of this.buildings) {
      if (other.id !== b.id) {
        const toEject = other.couriers.filter((cid) => {
          const m = this.getMinion(cid);
          return m && (m.courierFromId === b.id || m.courierToId === b.id);
        });
        for (const cid of toEject) this.ejectMinion(cid);
      }
    }

    const refund = this.getBuildingSellValue(b);
    this.gold += refund;
    this.totalGoldEarned += refund;
    this.spawnFloatingText(`+${refund}`, b.x, b.y - 10, "#ffdd55", "icon_coin");
    this.spawnParticles("vfx_smoke_sell", b.x, b.y, 1);
    this.buildings.splice(idx, 1);
    if (this.audio) this.audio.playColonySfx("buy");
    return true;
  }

  getBuildingSellValue(b) {
    const def = BUILDINGS[b.type];
    if (!def || !def.placeable) return 0;
    let invested = def.cost || 0;
    for (let lv = 0; lv < b.level - 1; lv++) {
      invested += def.levels[lv]?.upgradeCost || 0;
    }
    return Math.round(invested * (def.sellRatio || 0.7));
  }

  getBuildingLevelInfo(b) {
    const def = BUILDINGS[b.type];
    if (!def || !def.levels) return null;
    return def.levels[Math.min(b.level - 1, def.levels.length - 1)];
  }

  getBuildingNextLevelInfo(b) {
    const def = BUILDINGS[b.type];
    if (!def || !def.levels) return null;
    if (b.level >= def.levels.length) return null;
    return def.levels[b.level];
  }

  upgradeBuilding(buildingId) {
    const b = this.getBuilding(buildingId);
    if (!b) return false;
    const curr = this.getBuildingLevelInfo(b);
    const next = this.getBuildingNextLevelInfo(b);
    if (!curr || !next || curr.upgradeCost === null) return false;
    if (this.gold < curr.upgradeCost) return false;

    this.gold -= curr.upgradeCost;
    b.level += 1;
    this.spawnParticles("vfx_smoke_place", b.x, b.y, 1);
    this.spawnFloatingText(`Lv ${next.roman}!`, b.x, b.y - 16, "#73e659");
    if (this.audio) this.audio.playColonySfx("buy");
    return true;
  }

  placeDecoration(decorId, gx, gy) {
    const def = DECORATIONS[decorId];
    if (!def) return null;
    if (!this.isUnlocked(def.unlockKey || decorId)) return null;

    if (def.isLandClear) {
      return this.buyLandAt(gx, gy);
    }

    const { w, h } = def.footprint;
    if (!this.canPlaceFootprint(gx, gy, w, h)) return null;
    if (this.gold < def.cost) return null;

    this.gold -= def.cost;
    const d = {
      id: this.allocId("dec"),
      type: decorId,
      gx,
      gy,
      w,
      h,
      x: (gx + w * 0.5) * this.tileSize,
      y: (gy + h * 0.5) * this.tileSize,
      animTime: 0
    };
    this.decorations.push(d);
    this.recalculateMorale();
    this.spawnParticles("vfx_smoke_place", d.x, d.y, 1);
    if (this.audio) this.audio.playColonySfx("light-thud");
    return d;
  }

  sellDecoration(decorId) {
    const idx = this.decorations.findIndex((d) => d.id === decorId);
    if (idx === -1) return false;
    const d = this.decorations[idx];
    const def = DECORATIONS[d.type];
    const refund = Math.round((def?.cost || 20) * 0.7);
    this.gold += refund;
    this.spawnFloatingText(`+${refund}`, d.x, d.y - 8, "#ffdd55", "icon_coin");
    this.spawnParticles("vfx_smoke_sell", d.x, d.y, 1);
    this.decorations.splice(idx, 1);
    this.recalculateMorale();
    if (this.audio) this.audio.playColonySfx("buy");
    return true;
  }

  getBuyLandCost() {
    return 150 + this.landPurchasesCount * 75;
  }

  buyLandAt(gx, gy) {
    const chunk = this.forestChunks.find(
      (c) => !c.cleared && gx >= c.gx && gx < c.gx + c.w && gy >= c.gy && gy < c.gy + c.h
    );
    if (!chunk) return null;
    const cost = this.getBuyLandCost();
    if (this.gold < cost) return null;

    this.gold -= cost;
    chunk.cleared = true;
    this.landPurchasesCount += 1;
    const wx = (chunk.gx + chunk.w * 0.5) * this.tileSize;
    const wy = (chunk.gy + chunk.h * 0.5) * this.tileSize;
    this.spawnParticles("vfx_smoke_sell", wx, wy, 1);
    this.spawnFloatingText("Land Cleared!", wx, wy - 10, "#73e659");
    if (this.audio) this.audio.playColonySfx("heavy-thud");
    return chunk;
  }

  isUnlocked(key) {
    if (!key) return true;
    if (this.unlocks.has(key)) return true;
    const noSpace = String(key).replace(/\s+/g, "");
    if (this.unlocks.has(noSpace)) return true;
    const spaced = String(key).replace(/([a-z])([A-Z])/g, "$1 $2");
    return this.unlocks.has(spaced);
  }

  recruitMinion(typeId, worldX, worldY, count = 1) {
    const def = MINION_TYPES[typeId];
    if (!def || !def.recruitable) return [];
    if (!def.unlockedAtStart && !this.isUnlocked(def.unlockKey || typeId)) return [];

    const spawned = [];
    for (let i = 0; i < count; i++) {
      if (this.gold < def.cost) break;
      this.gold -= def.cost;
      const angle = (i / Math.max(1, count)) * Math.PI * 2;
      const radius = count > 1 ? 8 + (i % 5) * 4 : 0;
      const mx = Math.max(60, Math.min((this.gridWidth - 3) * this.tileSize, worldX + Math.cos(angle) * radius));
      const my = Math.max(60, Math.min((this.gridHeight - 3) * this.tileSize, worldY + Math.sin(angle) * radius));

      const minion = {
        id: this.allocId("min"),
        type: typeId,
        x: mx,
        y: my,
        vx: 0,
        vy: 0,
        facing: 1,
        state: "IDLE", // IDLE, GOING_TO_WORK, WORKING, GOING_TO_SOURCE, CARRYING_TO_DEST, GOING_TO_BARRACKS
        workBuildingId: null,
        courierFromId: null,
        courierToId: null,
        courierFilter: null,
        carriedItem: null,
        emote: null,
        emoteTimer: 0,
        animTime: Math.random() * 5,
        wanderTimer: 1 + Math.random() * 3,
        wanderTarget: null
      };
      this.minions.push(minion);
      spawned.push(minion);
      this.spawnParticles("vfx_smoke_place", mx, my, 0.65);
    }

    if (spawned.length > 0) {
      this.recalculateMorale();
      if (this.audio) this.audio.playColonySfx("pop");
      if (this.tutorialStep === 2 && this.minions.filter((m) => m.type === "Goblin").length >= 3) {
        this.advanceTutorial(2, 45);
      }
    }
    return spawned;
  }

  getBuilding(id) {
    return this.buildings.find((b) => b.id === id) || null;
  }

  getMinion(id) {
    return this.minions.find((m) => m.id === id) || null;
  }

  detachMinionFromAssignments(minion) {
    if (!minion) return;
    if (minion.workBuildingId) {
      const b = this.getBuilding(minion.workBuildingId);
      if (b) b.workers = b.workers.filter((id) => id !== minion.id);
      minion.workBuildingId = null;
    }
    if (minion.courierFromId) {
      const b = this.getBuilding(minion.courierFromId);
      if (b) b.couriers = b.couriers.filter((id) => id !== minion.id);
      minion.courierFromId = null;
      minion.courierToId = null;
      minion.courierFilter = null;
    }
    if (minion.carriedItem) {
      // Return carried item to Store House so items are never lost
      this.depositItemToStoreHouse(minion.carriedItem);
      minion.carriedItem = null;
    }
  }

  ejectMinion(minionId) {
    const m = this.getMinion(minionId);
    if (!m) return false;
    this.detachMinionFromAssignments(m);
    m.state = "IDLE";
    m.x += (Math.random() - 0.5) * 18;
    m.y += 14 + Math.random() * 10;
    return true;
  }

  ejectAllWorkers(buildingId) {
    const b = this.getBuilding(buildingId);
    if (!b) return;
    for (const id of [...b.workers]) {
      this.ejectMinion(id);
    }
  }

  ejectAllCouriers(buildingId) {
    const b = this.getBuilding(buildingId);
    if (!b) return;
    for (const id of [...b.couriers]) {
      this.ejectMinion(id);
    }
  }

  commandWork(minionIds, buildingId) {
    const b = this.getBuilding(buildingId);
    if (!b) return 0;
    const lv = this.getBuildingLevelInfo(b);
    if (!lv || !lv.workerLimit) return 0;

    let assigned = 0;
    for (const id of minionIds) {
      if (b.workers.length >= lv.workerLimit) break;
      const m = this.getMinion(id);
      if (!m) continue;
      this.detachMinionFromAssignments(m);
      b.workers.push(m.id);
      m.workBuildingId = b.id;
      m.state = "GOING_TO_WORK";
      m.emote = "emote_commanded";
      m.emoteTimer = 1.5;
      assigned++;
    }
    if (assigned > 0) {
      if (this.audio) this.audio.playColonySfx("ChangeDrop1");
      if (this.tutorialStep === 3 && b.type === "Mine") {
        this.advanceTutorial(3, 30);
      }
    }
    return assigned;
  }

  commandMoveGoods(minionIds, fromBuildingId, toBuildingId, filterConfig = null) {
    const fromB = this.getBuilding(fromBuildingId);
    const toB = this.getBuilding(toBuildingId);
    if (!fromB || !toB || fromB.id === toB.id) return 0;

    const defaultFilter = {
      anyResource: true,
      anyWeapon: true,
      anyArmour: true,
      allowEnchanted: true,
      whitelist: null,
      threshold: 0,
      ...(filterConfig || {})
    };

    let assigned = 0;
    for (const id of minionIds) {
      const m = this.getMinion(id);
      if (!m) continue;
      this.detachMinionFromAssignments(m);
      fromB.couriers.push(m.id);
      m.courierFromId = fromB.id;
      m.courierToId = toB.id;
      m.courierFilter = { ...defaultFilter };
      m.state = "GOING_TO_SOURCE";
      m.emote = "emote_commanded";
      m.emoteTimer = 1.5;
      assigned++;
    }

    if (assigned > 0) {
      if (this.audio) this.audio.playColonySfx("ChangeDrop1");
      if (this.tutorialStep === 4 && fromB.type === "Mine" && toB.type === "StoreHouse") {
        this.advanceTutorial(4, 30);
      } else if (this.tutorialStep === 5 && toB.type === "Market") {
        this.advanceTutorial(5, 60);
      }
    }
    return assigned;
  }

  commandToBarracks(minionIds) {
    if (!this.barracksBuilding) return 0;
    let count = 0;
    for (const id of minionIds) {
      const m = this.getMinion(id);
      if (!m) continue;
      this.detachMinionFromAssignments(m);
      m.state = "GOING_TO_BARRACKS";
      m.emote = "emote_battle";
      m.emoteTimer = 1.5;
      count++;
    }
    if (count > 0 && this.audio) this.audio.playColonySfx("ChangeDrop1");
    return count;
  }

  sendAllIdleToBarracks() {
    const idleIds = this.minions.filter((m) => m.state === "IDLE").map((m) => m.id);
    return this.commandToBarracks(idleIds);
  }

  sellMinions(minionIds) {
    let totalRefund = 0;
    let sold = 0;
    for (const id of minionIds) {
      const idx = this.minions.findIndex((m) => m.id === id);
      if (idx === -1) continue;
      const m = this.minions[idx];
      this.detachMinionFromAssignments(m);
      const def = MINION_TYPES[m.type];
      const refund = def?.sellValue || 10;
      totalRefund += refund;
      sold++;
      this.spawnFloatingText(`+${refund}`, m.x, m.y - 8, "#ffdd55", "icon_coin");
      this.spawnParticles("vfx_smoke_sell", m.x, m.y, 0.7);
      this.minions.splice(idx, 1);
    }
    if (sold > 0) {
      this.gold += totalRefund;
      this.totalGoldEarned += totalRefund;
      this.recalculateMorale();
      if (this.audio) this.audio.playColonySfx("buy");
    }
    return totalRefund;
  }

  advanceTutorial(completedStep, goldReward = 0) {
    if (this.tutorialStep !== completedStep) return;
    this.gold += goldReward;
    this.totalGoldEarned += goldReward;
    if (goldReward > 0 && this.storeHouse) {
      this.spawnFloatingText(`+${goldReward} Tutorial!`, this.storeHouse.x, this.storeHouse.y - 20, "#ffdd55", "icon_coin");
    }
    this.tutorialStep += 1;
    if (this.tutorialStep > 7) {
      this.tutorialCompleted = true;
    }
  }

  recalculateMorale() {
    let decorMorale = 0;
    for (const d of this.decorations) {
      const def = DECORATIONS[d.type];
      if (def) decorMorale += def.moraleBonus || 0;
    }
    let charismaScore = 0;
    for (const m of this.minions) {
      const def = MINION_TYPES[m.type];
      if (def) charismaScore += (def.stats.CHA || 0) * 1.5;
    }
    this.moraleScore = Math.round(decorMorale + charismaScore);
    if (!this.settings.enableMorale) {
      this.moraleEfficiency = 1.0;
    } else {
      // Base 100% + 1% per morale point up to 220%
      this.moraleEfficiency = Math.min(2.2, 1.0 + this.moraleScore * 0.01);
    }
  }

  depositItemToStoreHouse(item) {
    if (!item) return;
    if (item.category === "resource") {
      this.resources[item.itemId] = (this.resources[item.itemId] || 0) + (item.amount || 1);
    } else if (item.category === "weapon" || item.category === "armour") {
      this.equipment.push({
        uid: item.uid || this.allocId("eq"),
        itemId: item.itemId,
        category: item.category,
        tierIndex: item.tierIndex ?? 0,
        enchantment: item.enchantment || null,
        sellGold: item.sellGold,
        potencyBonus: item.potencyBonus || 0,
        durabilityBonus: item.durabilityBonus || 0,
        sprite: item.sprite
      });
    }
  }

  takeItemFromSource(fromB, toB, filter = null) {
    if (!fromB) return null;

    if (fromB.type === "StoreHouse") {
      const f = filter || {
        anyResource: true,
        anyWeapon: true,
        anyArmour: true,
        allowEnchanted: true,
        threshold: 0
      };
      const threshold = Math.max(0, Number(f.threshold) || 0);

      // If destination is Smith or Armourer, only take Metal
      if (toB && (toB.type === "Smith" || toB.type === "Armourer")) {
        if ((this.resources.Metal || 0) > threshold) {
          this.resources.Metal -= 1;
          return this.createResourceItem("Metal", 1);
        }
        return null;
      }

      // If destination is WizardTower, only take unenchanted Weapon or Armour
      if (toB && toB.type === "WizardTower") {
        const eqIdx = this.equipment.findIndex(
          (eq) =>
            !eq.enchantment &&
            ((f.anyWeapon && eq.category === "weapon") || (f.anyArmour && eq.category === "armour")) &&
            (!f.whitelist || f.whitelist.includes(eq.itemId))
        );
        if (eqIdx !== -1 && this.equipment.length > threshold) {
          return this.equipment.splice(eqIdx, 1)[0];
        }
        return null;
      }

      // Destination is Market or another building: check resources first if allowed
      if (f.anyResource) {
        for (const resKey of ["GoldenCarrot", "Ruby", "Sapphire", "Amethyst", "Carrot", "Metal"]) {
          if (f.whitelist && !f.whitelist.includes(resKey)) continue;
          if ((this.resources[resKey] || 0) > threshold) {
            this.resources[resKey] -= 1;
            return this.createResourceItem(resKey, 1);
          }
        }
      }

      // Check equipment in Store House
      if (f.anyWeapon || f.anyArmour) {
        const eqIdx = this.equipment.findIndex((eq) => {
          if (eq.category === "weapon" && !f.anyWeapon) return false;
          if (eq.category === "armour" && !f.anyArmour) return false;
          if (eq.enchantment && !f.allowEnchanted) return false;
          if (f.whitelist && !f.whitelist.includes(eq.itemId)) return false;
          return true;
        });
        if (eqIdx !== -1 && this.equipment.length > threshold) {
          return this.equipment.splice(eqIdx, 1)[0];
        }
      }
      return null;
    }

    // Standard production building: take from output queue
    if (fromB.output && fromB.output.length > 0) {
      // If going to Smith/Armourer, only take Metal
      if (toB && (toB.type === "Smith" || toB.type === "Armourer")) {
        const idx = fromB.output.findIndex((it) => it.itemId === "Metal");
        if (idx !== -1) return fromB.output.splice(idx, 1)[0];
        return null;
      }
      // If going to WizardTower, only take unenchanted weapon/armour
      if (toB && toB.type === "WizardTower") {
        const idx = fromB.output.findIndex((it) => (it.category === "weapon" || it.category === "armour") && !it.enchantment);
        if (idx !== -1) return fromB.output.splice(idx, 1)[0];
        return null;
      }
      return fromB.output.shift();
    }
    return null;
  }

  canDestinationAccept(toB, item) {
    if (!toB || !item) return false;
    if (toB.type === "Market" || toB.type === "StoreHouse") return true;
    const lv = this.getBuildingLevelInfo(toB);
    if (toB.type === "Smith" || toB.type === "Armourer") {
      return item.itemId === "Metal" && toB.input.length < (lv?.inputLimit || 60);
    }
    if (toB.type === "WizardTower") {
      return (
        (item.category === "weapon" || item.category === "armour") &&
        !item.enchantment &&
        toB.input.length < (lv?.inputLimit || 6)
      );
    }
    return false;
  }

  deliverItemToBuilding(toB, item, courierX, courierY) {
    if (!toB || !item) return false;
    if (toB.type === "Market") {
      const gold = item.sellGold || 3;
      this.gold += gold;
      this.totalGoldEarned += gold;
      this.spawnFloatingText(`+${gold}`, toB.x, toB.y - 12, "#ffdd55", "icon_coin");
      if (this.audio) this.audio.playColonySfx("buy");
      return true;
    }
    if (toB.type === "StoreHouse") {
      this.depositItemToStoreHouse(item);
      this.spawnFloatingText(`+1`, toB.x, toB.y - 12, "#ffffff", item.sprite);
      if (this.audio) this.audio.playColonySfx("pop_down");
      return true;
    }
    if (toB.type === "Smith" || toB.type === "Armourer" || toB.type === "WizardTower") {
      const lv = this.getBuildingLevelInfo(toB);
      if (toB.input.length < (lv?.inputLimit || 60)) {
        toB.input.push(item);
        this.spawnFloatingText(`+1`, toB.x, toB.y - 12, "#a8d5ff", item.sprite);
        if (this.audio) this.audio.playColonySfx("pop_down");
        return true;
      }
    }
    // If destination input is full, fall back to Store House so item isn't lost
    this.depositItemToStoreHouse(item);
    return true;
  }

  createResourceItem(resId, amount = 1) {
    const def = RESOURCES[resId];
    return {
      uid: this.allocId("res"),
      itemId: resId,
      category: "resource",
      amount,
      sellGold: (def?.sellGold || 3) * amount,
      sprite: def?.sprite || "res_metal"
    };
  }

  createEquipmentItem(tierDef, enchantmentId = null) {
    const ench = enchantmentId ? ENCHANTMENTS[enchantmentId] : null;
    const sellGold = Math.round(tierDef.sellGold * (ench ? ench.sellBonusMultiplier : 1.0));
    return {
      uid: this.allocId("eq"),
      itemId: tierDef.id,
      category: tierDef.category,
      tierIndex: tierDef.tierIndex,
      enchantment: enchantmentId,
      sellGold,
      potencyBonus: tierDef.potencyBonus || 0,
      durabilityBonus: tierDef.durabilityBonus || 0,
      sprite: tierDef.sprite
    };
  }

  update(dt) {
    const clampedDt = Math.min(0.1, Math.max(0, dt));
    this.elapsedTime += clampedDt;

    // 1. Update Buildings (Production, Crafting, Enchanting)
    for (const b of this.buildings) {
      b.animTime += clampedDt;
      this.updateBuildingProduction(b, clampedDt);
    }

    // 2. Update Decorations
    for (const d of this.decorations) {
      d.animTime += clampedDt;
    }

    // 3. Update Minions (Movement, Working, Courier Transport, Barracks Entry)
    for (let i = this.minions.length - 1; i >= 0; i--) {
      const m = this.minions[i];
      this.updateMinion(m, clampedDt, i);
    }

    // 4. Update Floating Texts & Particles
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y -= 18 * clampedDt;
      ft.life -= clampedDt;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.elapsed += clampedDt;
      if (p.elapsed >= p.duration) this.particles.splice(i, 1);
    }
  }

  updateBuildingProduction(b, dt) {
    const def = BUILDINGS[b.type];
    if (!def || !def.taskType) return;
    const lv = this.getBuildingLevelInfo(b);
    if (!lv) return;

    // Sum active workers currently inside the building
    const activeWorkers = b.workers
      .map((id) => this.getMinion(id))
      .filter((m) => m && m.state === "WORKING");

    if (activeWorkers.length === 0) return;

    // Check output capacity
    if (b.output.length >= (lv.outputLimit || 15)) {
      for (const w of activeWorkers) {
        w.emote = "emote_bored";
        w.emoteTimer = 0.5;
      }
      return;
    }

    // Compute total work speed from worker task grades and colony morale
    let speedSum = 0;
    for (const w of activeWorkers) {
      const g = computeTaskGrade(w.type, def.taskType);
      speedSum += g.speedMultiplier * this.moraleEfficiency;
      if (this.moraleEfficiency > 1.15 && Math.random() < 0.005) {
        w.emote = "emote_entertained";
        w.emoteTimer = 1.2;
      }
    }

    if (b.type === "Mine") {
      b.workProgress += dt * speedSum;
      if (b.workProgress >= def.workSeconds) {
        b.workProgress -= def.workSeconds;
        const yieldCount = lv.yieldAmount || 1;
        for (let k = 0; k < yieldCount; k++) {
          if (b.output.length < lv.outputLimit) {
            b.output.push(this.createResourceItem("Metal", 1));
          }
        }
        this.spawnFloatingText(`+${yieldCount}`, b.x, b.y - 14, "#d8e3f0", "res_metal");
        // Roll Rare Find Chance for Amethyst / Sapphire / Ruby
        if (Math.random() < (lv.rareFindChance || 0.01) && b.output.length < lv.outputLimit) {
          const r = Math.random();
          const gemId = r < 0.55 ? "Amethyst" : r < 0.85 ? "Sapphire" : "Ruby";
          b.output.push(this.createResourceItem(gemId, 1));
          this.spawnFloatingText(`Rare ${gemId}!`, b.x, b.y - 26, "#ff77ff", RESOURCES[gemId].sprite);
          if (this.audio) this.audio.playColonySfx("rare-find");
        } else if (this.audio) {
          this.audio.playColonySfx("item-generated");
        }
      }
    } else if (b.type === "Farm") {
      b.workProgress += dt * speedSum;
      if (b.workProgress >= def.workSeconds) {
        b.workProgress -= def.workSeconds;
        const yieldCount = lv.yieldAmount || 1;
        for (let k = 0; k < yieldCount; k++) {
          if (b.output.length < lv.outputLimit) {
            b.output.push(this.createResourceItem("Carrot", 1));
          }
        }
        this.spawnFloatingText(`+${yieldCount}`, b.x, b.y - 14, "#ffa94d", "res_carrot");
        if (Math.random() < (lv.rareFindChance || 0.02) && b.output.length < lv.outputLimit) {
          b.output.push(this.createResourceItem("GoldenCarrot", 1));
          this.spawnFloatingText(`Golden Carrot!`, b.x, b.y - 26, "#ffdd44", "res_golden_carrot");
          if (this.audio) this.audio.playColonySfx("rare-find");
        } else if (this.audio) {
          this.audio.playColonySfx("item-generated");
        }
      }
    } else if (b.type === "Smith" || b.type === "Armourer") {
      const tiers = b.type === "Smith" ? WEAPON_TIERS : ARMOUR_TIERS;
      const tierIdx = Math.min(b.selectedRecipeIndex || 0, lv.maxTierIndex ?? 0);
      const recipe = tiers[tierIdx];
      if (!recipe) return;

      if (b.input.length < recipe.metalCost) {
        for (const w of activeWorkers) {
          w.emote = "emote_bored";
          w.emoteTimer = 0.5;
        }
        return;
      }

      b.workProgress += dt * speedSum;
      if (b.workProgress >= recipe.craftSeconds) {
        b.workProgress -= recipe.craftSeconds;
        b.input.splice(0, recipe.metalCost);
        const crafted = this.createEquipmentItem(recipe, null);
        b.output.push(crafted);
        this.spawnFloatingText(`+1 ${t(recipe.tierKey)}`, b.x, b.y - 16, "#ffcf40", recipe.sprite);
        if (this.audio) this.audio.playColonySfx("01_Smith_Anvil_Hit_01");
      }
    } else if (b.type === "WizardTower") {
      const enchId = b.selectedEnchantment || "Lifesteal";
      const ench = ENCHANTMENTS[enchId];
      if (!ench || b.input.length === 0) {
        for (const w of activeWorkers) {
          w.emote = "emote_bored";
          w.emoteTimer = 0.5;
        }
        return;
      }
      const targetSeconds = (ench.enchantSeconds || 10.0) / (lv.speedBonus || 1.0);
      b.workProgress += dt * speedSum;
      if (b.workProgress >= targetSeconds) {
        b.workProgress -= targetSeconds;
        const baseItem = b.input.shift();
        const tierList = baseItem.category === "weapon" ? WEAPON_TIERS : ARMOUR_TIERS;
        const tierDef = tierList[baseItem.tierIndex || 0] || tierList[0];
        const enchantedItem = this.createEquipmentItem(tierDef, enchId);
        b.output.push(enchantedItem);
        this.spawnFloatingText(`+${t(ench.nameKey)}!`, b.x, b.y - 18, ench.tint, ench.sprite);
        if (this.audio) this.audio.playColonySfx("rare-find");
      }
    }
  }

  updateMinion(m, dt, indexInArray) {
    m.animTime += dt;
    if (m.emoteTimer > 0) {
      m.emoteTimer -= dt;
      if (m.emoteTimer <= 0) m.emote = null;
    }

    const def = MINION_TYPES[m.type];
    const moveGrade = computeTaskGrade(m.type, "Move");
    const speedPx = (def?.moveSpeed || 2.0) * 22 * (0.75 + moveGrade.score * 0.5) * (this.moraleEfficiency ** 0.5);

    const moveTowards = (tx, ty, stopDist = 6) => {
      const dx = tx - m.x;
      const dy = ty - m.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= stopDist) {
        m.vx = 0;
        m.vy = 0;
        return true;
      }
      const step = Math.min(dist, speedPx * dt);
      m.vx = (dx / dist) * speedPx;
      m.vy = (dy / dist) * speedPx;
      m.x += (dx / dist) * step;
      m.y += (dy / dist) * step;
      if (Math.abs(dx) > 0.5) m.facing = dx >= 0 ? 1 : -1;
      return false;
    };

    if (m.state === "IDLE") {
      m.wanderTimer -= dt;
      if (m.wanderTimer <= 0) {
        m.wanderTimer = 2.0 + Math.random() * 3.5;
        if (Math.random() < 0.65) {
          const wx = m.x + (Math.random() - 0.5) * 44;
          const wy = m.y + (Math.random() - 0.5) * 44;
          const gx = Math.floor(wx / this.tileSize);
          const gy = Math.floor(wy / this.tileSize);
          if (this.isTileCleared(gx, gy)) {
            m.wanderTarget = { x: wx, y: wy };
          }
        } else {
          m.wanderTarget = null;
        }
      }
      if (m.wanderTarget) {
        if (moveTowards(m.wanderTarget.x, m.wanderTarget.y, 3)) {
          m.wanderTarget = null;
        }
      } else {
        m.vx = 0;
        m.vy = 0;
      }
    } else if (m.state === "GOING_TO_WORK") {
      const b = this.getBuilding(m.workBuildingId);
      if (!b) {
        m.state = "IDLE";
        return;
      }
      const entranceY = b.y + b.h * this.tileSize * 0.36;
      if (moveTowards(b.x, entranceY, 8)) {
        m.state = "WORKING";
        m.vx = 0;
        m.vy = 0;
      }
    } else if (m.state === "WORKING") {
      const b = this.getBuilding(m.workBuildingId);
      if (!b) {
        m.state = "IDLE";
        return;
      }
      // Visible work movement in front of the building entrance
      const slotIdx = Math.max(0, b.workers.indexOf(m.id));
      const ox = ((slotIdx % 3) - 1) * 14 + Math.sin(m.animTime * 4 + slotIdx) * 3;
      const oy = (Math.floor(slotIdx / 3) % 2) * 8;
      const entranceY = b.y + b.h * this.tileSize * 0.36 + oy;
      moveTowards(b.x + ox, entranceY, 1.5);
    } else if (m.state === "GOING_TO_SOURCE") {
      const fromB = this.getBuilding(m.courierFromId);
      const toB = this.getBuilding(m.courierToId);
      if (!fromB || !toB) {
        this.ejectMinion(m.id);
        return;
      }
      if (moveTowards(fromB.x, fromB.y + 8, 10)) {
        const candidate = this.takeItemFromSource(fromB, toB, m.courierFilter);
        if (candidate) {
          if (this.canDestinationAccept(toB, candidate)) {
            m.carriedItem = candidate;
            m.state = "CARRYING_TO_DEST";
            if (this.audio) this.audio.playColonySfx("pickup");
          } else {
            // Put it back if destination is currently full
            if (fromB.type === "StoreHouse") {
              this.depositItemToStoreHouse(candidate);
            } else {
              fromB.output.unshift(candidate);
            }
            m.emote = "emote_bored";
            m.emoteTimer = 0.6;
          }
        }
      }
    } else if (m.state === "CARRYING_TO_DEST") {
      const toB = this.getBuilding(m.courierToId);
      if (!toB) {
        this.ejectMinion(m.id);
        return;
      }
      if (moveTowards(toB.x, toB.y + 8, 10)) {
        this.deliverItemToBuilding(toB, m.carriedItem, m.x, m.y);
        m.carriedItem = null;
        m.state = "GOING_TO_SOURCE";
      }
    } else if (m.state === "GOING_TO_BARRACKS") {
      const bar = this.barracksBuilding;
      if (!bar) {
        m.state = "IDLE";
        return;
      }
      if (moveTowards(bar.x, bar.y + 12, 12)) {
        this.barracks[m.type] = (this.barracks[m.type] || 0) + 1;
        this.minions.splice(indexInArray, 1);
        this.recalculateMorale();
        this.spawnFloatingText(`+1 ${t(MINION_TYPES[m.type].nameKey)}`, bar.x, bar.y - 18, "#63c64d");
        if (this.audio) this.audio.playColonySfx("pop_down");
        const totalInBarracks = Object.values(this.barracks).reduce((a, b) => a + b, 0);
        if (this.tutorialStep === 6 && totalInBarracks >= 4) {
          this.advanceTutorial(6, 50);
        }
      }
    }
  }

  applyMissionVictory(missionId, survivingMinionsMap, returnedEquipmentList) {
    const mission = MISSIONS.find((m) => m.id === missionId);
    if (!mission) return { goldEarned: 0, newUnlocks: [] };

    const isFirstClear = !this.completedMissions.has(missionId);
    const goldEarned = mission.goldReward + (isFirstClear ? mission.firstClearBonusGold || 0 : 0);
    this.gold += goldEarned;
    this.totalGoldEarned += goldEarned;
    this.completedMissions.add(missionId);

    const newUnlocks = [];
    for (const u of mission.unlocks || []) {
      if (!this.unlocks.has(u)) {
        this.unlocks.add(u);
        newUnlocks.push(u);
      }
    }

    // Return surviving minions to Barracks
    if (survivingMinionsMap) {
      for (const [race, cnt] of Object.entries(survivingMinionsMap)) {
        if (cnt > 0 && this.barracks[race] !== undefined) {
          this.barracks[race] += cnt;
        }
      }
    }

    // Return equipped weapons/armour to Store House
    if (Array.isArray(returnedEquipmentList)) {
      for (const eq of returnedEquipmentList) {
        this.depositItemToStoreHouse(eq);
      }
    }

    if (this.tutorialStep === 7) {
      this.advanceTutorial(7, 100);
    }

    return { goldEarned, newUnlocks, isFirstClear };
  }

  spawnFloatingText(text, x, y, color = "#ffffff", icon = null) {
    this.floatingTexts.push({
      id: this.allocId("ft"),
      text,
      x,
      y,
      color,
      icon,
      life: 1.25,
      maxLife: 1.25
    });
  }

  spawnParticles(sheet, x, y, scale = 1.0, duration = 0.55) {
    this.particles.push({
      id: this.allocId("pt"),
      sheet,
      x,
      y,
      scale,
      elapsed: 0,
      duration
    });
  }

  serialize() {
    return {
      version: 1,
      savedAt: new Date().toISOString(),
      nextId: this.nextId,
      gold: this.gold,
      totalGoldEarned: this.totalGoldEarned,
      elapsedTime: this.elapsedTime,
      settings: { ...this.settings },
      unlocks: Array.from(this.unlocks),
      resources: { ...this.resources },
      equipment: this.equipment.map((e) => ({ ...e })),
      barracks: { ...this.barracks },
      completedMissions: Array.from(this.completedMissions),
      forestChunks: this.forestChunks.map((c) => ({ ...c })),
      landPurchasesCount: this.landPurchasesCount,
      buildings: this.buildings.map((b) => ({
        ...b,
        workers: [...b.workers],
        couriers: [...b.couriers],
        input: b.input.map((i) => ({ ...i })),
        output: b.output.map((o) => ({ ...o }))
      })),
      decorations: this.decorations.map((d) => ({ ...d })),
      minions: this.minions.map((m) => ({
        ...m,
        carriedItem: m.carriedItem ? { ...m.carriedItem } : null,
        courierFilter: m.courierFilter ? { ...m.courierFilter } : null
      })),
      tutorialStep: this.tutorialStep,
      tutorialCompleted: this.tutorialCompleted
    };
  }

  deserialize(data) {
    if (!data || typeof data !== "object") return false;
    this.nextId = data.nextId || 100;
    this.gold = data.gold ?? 220;
    this.totalGoldEarned = data.totalGoldEarned ?? this.gold;
    this.elapsedTime = data.elapsedTime || 0;
    this.settings = { ...this.settings, ...(data.settings || {}) };
    this.unlocks = new Set(data.unlocks || ["Goblin", "Troll", "Mine", "Farm", "Lifesteal", "BurningStrikes", "Thorns"]);
    this.resources = { ...this.resources, ...(data.resources || {}) };
    this.equipment = Array.isArray(data.equipment) ? data.equipment.map((e) => ({ ...e })) : [];
    this.barracks = { ...this.barracks, ...(data.barracks || {}) };
    this.completedMissions = new Set(data.completedMissions || []);
    if (Array.isArray(data.forestChunks)) {
      this.forestChunks = data.forestChunks.map((c) => ({ ...c }));
    }
    this.landPurchasesCount = data.landPurchasesCount || 0;
    if (Array.isArray(data.buildings)) {
      this.buildings = data.buildings.map((b) => ({
        ...b,
        workers: [...(b.workers || [])],
        couriers: [...(b.couriers || [])],
        input: (b.input || []).map((i) => ({ ...i })),
        output: (b.output || []).map((o) => ({ ...o }))
      }));
    }
    this.storeHouse = this.buildings.find((b) => b.type === "StoreHouse") || this.buildings[0];
    this.barracksBuilding = this.buildings.find((b) => b.type === "Barracks") || null;
    this.marketBuilding = this.buildings.find((b) => b.type === "Market") || null;
    this.decorations = Array.isArray(data.decorations) ? data.decorations.map((d) => ({ ...d })) : [];
    this.minions = Array.isArray(data.minions)
      ? data.minions.map((m) => ({
          ...m,
          carriedItem: m.carriedItem ? { ...m.carriedItem } : null,
          courierFilter: m.courierFilter ? { ...m.courierFilter } : null
        }))
      : [];
    this.tutorialStep = data.tutorialStep ?? 1;
    this.tutorialCompleted = Boolean(data.tutorialCompleted);

    // Ensure older empty saves also have visible starter minions & barracks units
    const totalBarracks = Object.values(this.barracks).reduce((a, b) => a + b, 0);
    if (this.minions.length === 0 && totalBarracks === 0) {
      const sh = this.storeHouse;
      const sx = sh ? sh.x : 17.5 * this.tileSize;
      const sy = sh ? sh.y + 32 : 13.0 * this.tileSize;
      const starterRaces = ["Goblin", "Goblin", "Goblin", "Goblin", "Troll", "Troll"];
      starterRaces.forEach((race, idx) => {
        const angle = (idx / starterRaces.length) * Math.PI * 2;
        this.minions.push({
          id: this.allocId("min"),
          type: race,
          x: sx + Math.cos(angle) * 26,
          y: sy + Math.sin(angle) * 14,
          vx: 0,
          vy: 0,
          facing: idx % 2 === 0 ? 1 : -1,
          state: "IDLE",
          workBuildingId: null,
          courierFromId: null,
          courierToId: null,
          courierFilter: null,
          carriedItem: null,
          emote: null,
          emoteTimer: 0,
          animTime: idx * 0.2,
          wanderTimer: 0.4 + idx * 0.25,
          wanderTarget: null
        });
      });
      this.barracks.Goblin = 4;
      this.barracks.Troll = 2;
    }

    this.recalculateMorale();
    return true;
  }

  saveToSlot(slotIndex = 1) {
    const key = `minion_colony_save_${slotIndex}`;
    const payload = JSON.stringify(this.serialize());
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(key, payload);
    }
    return payload;
  }

  loadFromSlot(slotIndex = 1) {
    if (typeof localStorage === "undefined") return false;
    const raw = localStorage.getItem(`minion_colony_save_${slotIndex}`);
    if (!raw) return false;
    try {
      return this.deserialize(JSON.parse(raw));
    } catch {
      return false;
    }
  }

  eraseSlot(slotIndex = 1) {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(`minion_colony_save_${slotIndex}`);
    }
  }

  getSlotSummary(slotIndex = 1) {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(`minion_colony_save_${slotIndex}`);
    if (!raw) return null;
    try {
      const data = JSON.parse(raw);
      return {
        slotIndex,
        gold: data.gold ?? 0,
        minionsCount: (data.minions?.length || 0) + Object.values(data.barracks || {}).reduce((a, b) => a + b, 0),
        missionsCleared: (data.completedMissions || []).length,
        savedAt: data.savedAt
      };
    } catch {
      return null;
    }
  }
}
