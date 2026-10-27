/**
 * Formation Editor and Real-Time Auto-Battler Engine for Minion Colony.
 * Supports 6x5/6x6 formation placement, continuous weapon/armour equipping,
 * 1x / 4x battle speed, background execution while managing the colony,
 * 7 unit ability archetypes, and 4 weapon/armour enchantments.
 */

import {
  ARMOUR_TIERS,
  ENCHANTMENTS,
  MINION_TYPES,
  MISSIONS,
  WEAPON_TIERS
} from "../data/game-data.js";
import { t } from "../data/localization.js";

export class BattleSim {
  constructor(colonySim, audio = null) {
    this.colony = colonySim;
    this.audio = audio;

    this.state = "IDLE"; // IDLE, FORMATION, IN_PROGRESS, FINISHED
    this.inBackground = false;
    this.speedMultiplier = 1;
    this.currentMission = null;

    // Formation state: Array of { id, gx, gy, race, weapon: eqObj|null, armour: eqObj|null }
    this.formation = [];
    this.selectedBarracksRace = "Goblin";
    this.selectedEquipmentUid = null;

    // Live combat entities
    this.units = [];
    this.projectiles = [];
    this.vfx = [];
    this.floatingTexts = [];
    this.elapsedBattleTime = 0;
    this.result = null; // { victory, mission, startingMinions, survivingMinions, survivingByRace, returnedEquipment, goldEarned, newUnlocks }
  }

  openFormation(missionId) {
    const mission = MISSIONS.find(
      (m) => m.id === missionId || `mission_${m.index}` === missionId || m.index === Number(missionId)
    );
    if (!mission) return false;

    // If switching from an older formation, return any staged units/gear back to colony first
    this.clearFormationBackToColony();

    this.currentMission = mission;
    this.state = "FORMATION";
    this.inBackground = false;

    // If Barracks is completely empty, automatically pull idle minions from Colony into Barracks
    const totalInBarracks = Object.values(this.colony.barracks).reduce((a, b) => a + b, 0);
    if (totalInBarracks === 0 && this.colony.minions.length > 0) {
      const idleOrAll = this.colony.minions.filter((m) => m.state === "IDLE");
      const toPull = (idleOrAll.length > 0 ? idleOrAll : this.colony.minions).slice(0, mission.minionLimit);
      for (const m of toPull) {
        this.colony.detachMinionFromAssignments(m);
        this.colony.barracks[m.type] = (this.colony.barracks[m.type] || 0) + 1;
        const idx = this.colony.minions.findIndex((x) => x.id === m.id);
        if (idx !== -1) this.colony.minions.splice(idx, 1);
      }
      this.colony.recalculateMorale();
    }

    // Select first available race in barracks
    const availableRace = Object.keys(this.colony.barracks).find((r) => (this.colony.barracks[r] || 0) > 0);
    this.selectedBarracksRace = availableRace || "Goblin";
    this.selectedEquipmentUid = null;
    return true;
  }

  clearFormationBackToColony() {
    for (const slot of this.formation) {
      if (this.colony.barracks[slot.race] !== undefined) {
        this.colony.barracks[slot.race] += 1;
      }
      if (slot.weapon) this.colony.depositItemToStoreHouse(slot.weapon);
      if (slot.armour) this.colony.depositItemToStoreHouse(slot.armour);
    }
    this.formation = [];
  }

  cancelFormation() {
    this.clearFormationBackToColony();
    this.currentMission = null;
    this.state = "IDLE";
  }

  getPlacedSlotAt(gx, gy) {
    return this.formation.find((s) => s.gx === gx && s.gy === gy) || null;
  }

  placeOrEquipAtFormationTile(gx, gy) {
    if (this.state !== "FORMATION" || !this.currentMission) return false;
    // Valid ally grid coordinates: gx in [-5, -1], gy in [-3, 2]
    if (gx < -5 || gx > -1 || gy < -3 || gy > 2) return false;

    const existing = this.getPlacedSlotAt(gx, gy);

    // If an equipment item is selected, equip it onto the unit at (gx, gy)
    if (this.selectedEquipmentUid && existing) {
      return this.equipSelectedOnSlot(existing);
    }

    if (existing) {
      // Remove unit back to barracks
      this.removeFormationSlot(gx, gy);
      return true;
    }

    // Check minion limit
    if (this.formation.length >= this.currentMission.minionLimit) {
      if (this.audio) this.audio.playUiSfx("denied");
      return false;
    }

    let race = this.selectedBarracksRace;
    if (!race || (this.colony.barracks[race] || 0) <= 0) {
      // Auto-select next available race in Barracks
      race = Object.keys(this.colony.barracks).find((r) => (this.colony.barracks[r] || 0) > 0) || null;
      if (race) this.selectedBarracksRace = race;
    }
    if (!race || (this.colony.barracks[race] || 0) <= 0) {
      if (this.audio) this.audio.playUiSfx("denied");
      return false;
    }

    this.colony.barracks[race] -= 1;
    // If that race is now depleted, advance selectedBarracksRace to next available race
    if ((this.colony.barracks[race] || 0) <= 0) {
      const nextRace = Object.keys(this.colony.barracks).find((r) => (this.colony.barracks[r] || 0) > 0);
      if (nextRace) this.selectedBarracksRace = nextRace;
    }
    const slot = {
      id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      gx,
      gy,
      race,
      weapon: null,
      armour: null
    };
    this.formation.push(slot);
    if (this.audio) this.audio.playUiSfx("pop");
    return true;
  }

  removeFormationSlot(gx, gy) {
    const idx = this.formation.findIndex((s) => s.gx === gx && s.gy === gy);
    if (idx === -1) return false;
    const slot = this.formation[idx];
    this.formation.splice(idx, 1);
    if (this.colony.barracks[slot.race] !== undefined) {
      this.colony.barracks[slot.race] += 1;
    }
    if (slot.weapon) this.colony.depositItemToStoreHouse(slot.weapon);
    if (slot.armour) this.colony.depositItemToStoreHouse(slot.armour);
    if (this.audio) this.audio.playUiSfx("pop_down");
    return true;
  }

  equipSelectedOnSlot(slot) {
    if (!slot || !this.selectedEquipmentUid) return false;
    const eqIdx = this.colony.equipment.findIndex((e) => e.uid === this.selectedEquipmentUid);
    if (eqIdx === -1) {
      this.selectedEquipmentUid = null;
      return false;
    }
    const eq = this.colony.equipment[eqIdx];
    this.colony.equipment.splice(eqIdx, 1);

    if (eq.category === "weapon") {
      if (slot.weapon) this.colony.depositItemToStoreHouse(slot.weapon);
      slot.weapon = eq;
    } else if (eq.category === "armour") {
      if (slot.armour) this.colony.depositItemToStoreHouse(slot.armour);
      slot.armour = eq;
    }

    // Continuous equipping (Patch 0.0.3): if another identical item exists in inventory, auto-select it
    const nextMatching = this.colony.equipment.find(
      (e) => e.itemId === eq.itemId && e.enchantment === eq.enchantment
    );
    this.selectedEquipmentUid = nextMatching ? nextMatching.uid : null;

    if (this.audio) this.audio.playUiSfx("Equip");
    return true;
  }

  computeUnitPreviewStats(race, weapon = null, armour = null, healthMult = 1.0, potencyMult = 1.0, durabilityMult = 1.0) {
    const def = MINION_TYPES[race] || MINION_TYPES.Goblin;
    const potency = potencyMult + (weapon?.potencyBonus || 0);
    const durability = durabilityMult + (armour?.durabilityBonus || 0);
    const maxHp = Math.round(def.maxHealth * healthMult);
    const effectiveDamage = Math.round(def.baseDamage * potency);
    return {
      race,
      name: t(def.nameKey),
      description: t(def.descKey),
      maxHealth: maxHp,
      potencyPct: Math.round(potency * 100),
      durabilityPct: Math.round(durability * 100),
      potency,
      durability,
      baseDamageLabel: def.baseDamageLabel,
      effectiveDamage,
      cooldown: def.cooldown,
      range: def.range,
      weapon,
      armour
    };
  }

  startBattle() {
    if (this.state !== "FORMATION" || !this.currentMission || this.formation.length === 0) {
      if (this.audio) this.audio.playUiSfx("denied");
      return false;
    }

    this.units = [];
    this.projectiles = [];
    this.vfx = [];
    this.floatingTexts = [];
    this.elapsedBattleTime = 0;
    this.result = null;

    const tilePx = 28;
    // Arena center is (0, 0) in grid coordinates
    let uidCounter = 1;

    // Spawn Ally units from formation (left side: gx in -5..-1)
    for (const slot of this.formation) {
      const def = MINION_TYPES[slot.race];
      const stats = this.computeUnitPreviewStats(slot.race, slot.weapon, slot.armour);
      this.units.push({
        id: `ally_${uidCounter++}`,
        team: "ally",
        race: slot.race,
        x: slot.gx * tilePx,
        y: slot.gy * tilePx,
        z: 0,
        vz: 0,
        facing: 1,
        hp: stats.maxHealth,
        maxHp: stats.maxHealth,
        potency: stats.potency,
        durability: stats.durability,
        baseDamage: def.baseDamage,
        cooldown: def.cooldown,
        cooldownTimer: Math.random() * 0.4,
        range: def.range * tilePx,
        moveSpeed: def.moveSpeed * tilePx,
        abilityType: def.abilityType,
        chainTargets: def.chainTargets || 3,
        aoeRadius: (def.aoeRadius || 1.5) * tilePx,
        weapon: slot.weapon,
        armour: slot.armour,
        burnTimer: 0,
        burnDps: 0,
        burnTickAccum: 0,
        flashTimer: 0,
        animState: "idle",
        animTime: Math.random() * 3,
        dead: false,
        deathTimer: 0,
        isBoss: false
      });
    }

    // Spawn Enemy units from currentMission.enemies (right side: gx in 0..4, shifted to +1..+5)
    for (const e of this.currentMission.enemies) {
      const def = MINION_TYPES[e.race] || MINION_TYPES.Fighter;
      const stats = this.computeUnitPreviewStats(
        e.race,
        null,
        null,
        e.health || 1.0,
        e.potency || 1.0,
        e.durability || 1.0
      );
      this.units.push({
        id: `enemy_${uidCounter++}`,
        team: "enemy",
        race: e.race,
        x: (e.x + 1.2) * tilePx,
        y: e.y * tilePx,
        z: 0,
        vz: 0,
        facing: -1,
        hp: stats.maxHealth,
        maxHp: stats.maxHealth,
        potency: stats.potency,
        durability: stats.durability,
        baseDamage: def.baseDamage,
        cooldown: def.cooldown,
        cooldownTimer: 0.25 + Math.random() * 0.5,
        range: def.range * tilePx,
        moveSpeed: def.moveSpeed * tilePx,
        abilityType: def.abilityType,
        chainTargets: def.chainTargets || 3,
        aoeRadius: (def.aoeRadius || 1.5) * tilePx,
        weapon: null,
        armour: null,
        burnTimer: 0,
        burnDps: 0,
        burnTickAccum: 0,
        flashTimer: 0,
        animState: "idle",
        animTime: Math.random() * 3,
        dead: false,
        deathTimer: 0,
        isBoss: Boolean(e.isBoss || (e.health && e.health >= 4.0))
      });
    }

    this.state = "IN_PROGRESS";
    this.inBackground = false;
    if (this.audio) this.audio.startBattleMusic();
    return true;
  }

  abortMission() {
    if (this.state !== "IN_PROGRESS" && this.state !== "FINISHED") return false;
    // Return surviving allies to Barracks and all equipped items to Store House
    const survivingByRace = {};
    const returnedEq = [];
    for (const u of this.units) {
      if (u.team === "ally") {
        if (!u.dead && u.hp > 0) {
          survivingByRace[u.race] = (survivingByRace[u.race] || 0) + 1;
        }
        if (u.weapon) returnedEq.push(u.weapon);
        if (u.armour) returnedEq.push(u.armour);
      }
    }
    for (const [r, cnt] of Object.entries(survivingByRace)) {
      if (this.colony.barracks[r] !== undefined) this.colony.barracks[r] += cnt;
    }
    for (const eq of returnedEq) {
      this.colony.depositItemToStoreHouse(eq);
    }

    this.formation = [];
    this.units = [];
    this.projectiles = [];
    this.vfx = [];
    this.state = "IDLE";
    this.inBackground = false;
    this.currentMission = null;
    if (this.audio) this.audio.startColonyMusic();
    return true;
  }

  getTeamHealthTotals(team) {
    let current = 0;
    let max = 0;
    for (const u of this.units) {
      if (u.team === team) {
        max += u.maxHp;
        if (!u.dead) current += Math.max(0, Math.round(u.hp));
      }
    }
    return { current, max: Math.max(1, max) };
  }

  hasEnchantment(unit, enchId) {
    return unit.weapon?.enchantment === enchId || unit.armour?.enchantment === enchId;
  }

  applyDamage(attacker, target, rawDamage, isReflect = false) {
    if (!target || target.dead) return 0;
    const mitigation = Math.max(0.25, 1.0 / Math.max(0.5, target.durability || 1.0));
    let finalDmg = Math.max(1, Math.round(rawDamage * mitigation));

    // Rend enchantment on attacker: +35% bonus strike damage
    if (!isReflect && attacker && this.hasEnchantment(attacker, "Rend")) {
      const rendBonus = Math.max(1, Math.round(finalDmg * ENCHANTMENTS.Rend.bonusDamageRatio));
      finalDmg += rendBonus;
    }

    target.hp = Math.max(0, target.hp - finalDmg);
    target.flashTimer = 0.14;
    this.spawnFloatingText(`-${finalDmg}`, target.x, target.y - 16 - target.z, target.team === "ally" ? "#ff6b6b" : "#ffffff");

    // Lifesteal enchantment on attacker: heal 25% of damage dealt
    if (!isReflect && attacker && !attacker.dead && this.hasEnchantment(attacker, "Lifesteal")) {
      const healAmt = Math.max(1, Math.round(finalDmg * ENCHANTMENTS.Lifesteal.lifestealRatio));
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + healAmt);
      this.spawnFloatingText(`+${healAmt}`, attacker.x, attacker.y - 18, "#63e67b");
    }

    // Burning Strikes enchantment on attacker: ignite target for 3s
    if (!isReflect && attacker && this.hasEnchantment(attacker, "BurningStrikes")) {
      target.burnTimer = ENCHANTMENTS.BurningStrikes.burnDuration;
      target.burnDps = Math.max(3, Math.round(rawDamage * ENCHANTMENTS.BurningStrikes.burnDpsRatio));
      this.spawnVfx("vfx_small_flame", target.x, target.y, 0.38, 0.5);
    }

    // Thorns enchantment on target: reflect 25% back to attacker
    if (!isReflect && attacker && !attacker.dead && this.hasEnchantment(target, "Thorns")) {
      const reflectDmg = Math.max(1, Math.round(rawDamage * ENCHANTMENTS.Thorns.thornsReflectRatio));
      this.applyDamage(target, attacker, reflectDmg, true);
    }

    if (target.hp <= 0 && !target.dead) {
      target.dead = true;
      target.animState = "die";
      target.animTime = 0;
      target.deathTimer = 0.85;
      this.spawnVfx("vfx_hitspark", target.x, target.y, 0.85, 0.35);
      if (this.audio && !this.inBackground) this.audio.playBattleSfx("enemyDeath");
    }
    return finalDmg;
  }

  update(rawDt) {
    if (this.state !== "IN_PROGRESS") return;

    const dt = Math.min(0.05, Math.max(0, rawDt)) * this.speedMultiplier;
    this.elapsedBattleTime += dt;

    // 1. Update Units
    for (const u of this.units) {
      u.animTime += dt;
      if (u.flashTimer > 0) u.flashTimer -= dt;

      // Vertical knock-up physics (from Giant shockwave)
      if (u.z > 0 || u.vz !== 0) {
        u.z += u.vz * dt;
        u.vz -= 280 * dt;
        if (u.z <= 0) {
          u.z = 0;
          u.vz = 0;
        }
      }

      if (u.dead) {
        u.deathTimer -= dt;
        continue;
      }

      // Burn DoT processing
      if (u.burnTimer > 0) {
        u.burnTimer -= dt;
        u.burnTickAccum += dt;
        if (u.burnTickAccum >= 0.5) {
          u.burnTickAccum -= 0.5;
          const tickDmg = Math.max(1, Math.round(u.burnDps * 0.5));
          u.hp = Math.max(0, u.hp - tickDmg);
          this.spawnFloatingText(`-${tickDmg}`, u.x, u.y - 14, "#ff9233");
          this.spawnVfx("vfx_small_flame", u.x, u.y, 0.35, 0.35);
          if (u.hp <= 0) {
            u.dead = true;
            u.animState = "die";
            u.animTime = 0;
            u.deathTimer = 0.85;
            continue;
          }
        }
      }

      u.cooldownTimer = Math.max(0, u.cooldownTimer - dt);

      // Acquire target based on abilityType
      const target = this.findTargetForUnit(u);
      if (!target) {
        u.animState = "idle";
        continue;
      }

      const dx = target.x - u.x;
      const dy = target.y - u.y;
      const dist = Math.hypot(dx, dy);
      if (Math.abs(dx) > 1) u.facing = dx >= 0 ? 1 : -1;

      if (dist <= u.range) {
        // In range: attack if cooldown ready
        if (u.cooldownTimer <= 0) {
          u.cooldownTimer = u.cooldown;
          u.animState = "attack";
          u.animTime = 0;
          this.executeUnitAbility(u, target);
        } else if (u.animState !== "attack" || u.animTime > 0.45) {
          u.animState = "idle";
        }
      } else {
        // Move towards target
        u.animState = "walk";
        const step = Math.min(dist - u.range * 0.85, u.moveSpeed * dt);
        u.x += (dx / dist) * step;
        u.y += (dy / dist) * step;
      }
    }

    // Simple soft separation between living units
    for (let i = 0; i < this.units.length; i++) {
      const a = this.units[i];
      if (a.dead) continue;
      for (let j = i + 1; j < this.units.length; j++) {
        const b = this.units[j];
        if (b.dead) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        const minDist = 14;
        if (d > 0.01 && d < minDist) {
          const push = (minDist - d) * 0.25;
          const nx = dx / d;
          const ny = dy / d;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
        }
      }
    }

    // 2. Update Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      const dist = Math.hypot(dx, dy);
      const step = p.speed * dt;
      if (dist <= step) {
        if (p.target && !p.target.dead) {
          this.applyDamage(p.attacker, p.target, p.damage);
          this.spawnVfx("vfx_hitspark", p.target.x, p.target.y, 0.75, 0.25);
          if (this.audio && !this.inBackground) this.audio.playBattleSfx("Hit_Metal_on_flesh");
        }
        this.projectiles.splice(i, 1);
      } else {
        p.x += (dx / dist) * step;
        p.y += (dy / dist) * step;
        if (p.target && !p.target.dead) {
          p.tx = p.target.x;
          p.ty = p.target.y;
        }
      }
    }

    // 3. Update VFX & Floating Texts
    for (let i = this.vfx.length - 1; i >= 0; i--) {
      const v = this.vfx[i];
      v.elapsed += dt;
      if (v.elapsed >= v.duration) {
        if (v.onComplete) v.onComplete();
        this.vfx.splice(i, 1);
      }
    }
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y -= 20 * dt;
      ft.life -= dt;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }

    // 4. Check Victory / Defeat
    const livingAllies = this.units.filter((u) => u.team === "ally" && !u.dead);
    const livingEnemies = this.units.filter((u) => u.team === "enemy" && !u.dead);
    if (livingEnemies.length === 0 || livingAllies.length === 0) {
      this.finishBattle(livingAllies.length > 0 && livingEnemies.length === 0);
    }
  }

  findTargetForUnit(u) {
    if (u.abilityType === "heal") {
      // Sapling / Priest heals the lowest-health percentage living ally
      const allies = this.units.filter((o) => o.team === u.team && !o.dead);
      if (allies.length === 0) return null;
      allies.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
      return allies[0];
    }

    const enemies = this.units.filter((o) => o.team !== u.team && !o.dead);
    if (enemies.length === 0) return null;

    if (u.abilityType === "laser") {
      // Cyclops targets furthest enemy within range (or nearest enemy if none in range yet)
      const inRange = enemies.filter((e) => Math.hypot(e.x - u.x, e.y - u.y) <= u.range);
      if (inRange.length > 0) {
        inRange.sort((a, b) => Math.hypot(b.x - u.x, b.y - u.y) - Math.hypot(a.x - u.x, a.y - u.y));
        return inRange[0];
      }
    }

    enemies.sort((a, b) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(b.x - u.x, b.y - u.y));
    return enemies[0];
  }

  executeUnitAbility(u, target) {
    const rawDamage = u.baseDamage * u.potency;

    if (u.abilityType === "melee") {
      this.applyDamage(u, target, rawDamage);
      this.spawnVfx("vfx_hitspark", target.x, target.y, 0.8, 0.25);
      if (this.audio && !this.inBackground) this.audio.playBattleSfx("slash");
    } else if (u.abilityType === "arrow") {
      this.projectiles.push({
        id: `proj_${Date.now()}_${Math.random()}`,
        x: u.x,
        y: u.y - 6,
        tx: target.x,
        ty: target.y - 6,
        speed: 190,
        attacker: u,
        target,
        damage: rawDamage,
        sprite: "proj_arrow"
      });
      if (this.audio && !this.inBackground) this.audio.playBattleSfx("Bow_Release");
    } else if (u.abilityType === "heal") {
      const healAmt = Math.max(4, Math.round(rawDamage));
      target.hp = Math.min(target.maxHp, target.hp + healAmt);
      this.spawnFloatingText(`+${healAmt}`, target.x, target.y - 16, "#63e67b");
      this.spawnVfx("vfx_hitspark", target.x, target.y, 0.7, 0.3, "#63e67b");
      if (this.audio && !this.inBackground) this.audio.playBattleSfx("HealBolt");
    } else if (u.abilityType === "chain_lightning") {
      // Chain lightning across up to 3 nearby enemies
      const enemies = this.units
        .filter((o) => o.team !== u.team && !o.dead)
        .sort((a, b) => Math.hypot(a.x - target.x, a.y - target.y) - Math.hypot(b.x - target.x, b.y - target.y))
        .slice(0, u.chainTargets || 3);

      let prevX = u.x;
      let prevY = u.y - 8;
      for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        const hopDmg = rawDamage * (i === 0 ? 1.0 : 0.75);
        this.applyDamage(u, e, hopDmg);
        this.vfx.push({
          type: "chain_beam",
          x1: prevX,
          y1: prevY,
          x2: e.x,
          y2: e.y - 6,
          color: "#6be5ff",
          elapsed: 0,
          duration: 0.28
        });
        this.spawnVfx("vfx_lightning", e.x, e.y - 12, 0.65, 0.32);
        prevX = e.x;
        prevY = e.y - 6;
      }
      if (this.audio && !this.inBackground) this.audio.playBattleSfx("quickShock");
    } else if (u.abilityType === "laser") {
      // Cyclops piercing eye laser beam
      this.applyDamage(u, target, rawDamage);
      this.vfx.push({
        type: "laser_beam",
        x1: u.x + u.facing * 6,
        y1: u.y - 8,
        x2: target.x,
        y2: target.y - 6,
        color: "#ff3855",
        elapsed: 0,
        duration: 0.32
      });
      this.spawnVfx("vfx_hitspark", target.x, target.y, 0.9, 0.3);
      if (this.audio && !this.inBackground) this.audio.playBattleSfx("01_Fire_Cast");
    } else if (u.abilityType === "meteor") {
      // Demon summons sky meteor that lands on target area
      const tx = target.x;
      const ty = target.y;
      if (this.audio && !this.inBackground) this.audio.playBattleSfx("01_Fire_Cast");
      this.vfx.push({
        type: "sheet",
        sheet: "vfx_meteor",
        x: tx,
        y: ty - 18,
        scale: 0.7,
        elapsed: 0,
        duration: 0.42,
        onComplete: () => {
          this.spawnVfx("vfx_meteor_exp", tx, ty, 0.75, 0.45);
          if (this.audio && !this.inBackground) this.audio.playBattleSfx("fire-explosion");
          for (const e of this.units) {
            if (e.team !== u.team && !e.dead && Math.hypot(e.x - tx, e.y - ty) <= u.aoeRadius) {
              this.applyDamage(u, e, rawDamage);
            }
          }
        }
      });
    } else if (u.abilityType === "shockwave") {
      // Giant slams the ground, damaging and launching nearby enemies into the air
      this.spawnVfx("giant_shockwave", target.x, target.y, 1.35, 0.45);
      if (this.audio && !this.inBackground) this.audio.playBattleSfx("shockwave-on-grass");
      for (const e of this.units) {
        if (e.team !== u.team && !e.dead && Math.hypot(e.x - target.x, e.y - target.y) <= u.aoeRadius) {
          this.applyDamage(u, e, rawDamage);
          e.vz = 115;
          e.z = 2;
        }
      }
    }
  }

  finishBattle(victory) {
    const startingMinions = this.formation.length;
    const survivingAllies = this.units.filter((u) => u.team === "ally" && !u.dead);
    const survivingByRace = {};
    for (const u of survivingAllies) {
      survivingByRace[u.race] = (survivingByRace[u.race] || 0) + 1;
    }

    // All equipped weapons and armour are returned to Store House
    const returnedEquipment = [];
    for (const u of this.units) {
      if (u.team === "ally") {
        if (u.weapon) returnedEquipment.push(u.weapon);
        if (u.armour) returnedEquipment.push(u.armour);
      }
    }

    let goldEarned = 0;
    let newUnlocks = [];
    if (victory) {
      const res = this.colony.applyMissionVictory(
        this.currentMission.id,
        survivingByRace,
        returnedEquipment
      );
      goldEarned = res.goldEarned;
      newUnlocks = res.newUnlocks;
      if (this.audio) this.audio.playVictoryMusic();
    } else {
      // Even on defeat, surviving units (if any) and equipment return to colony
      for (const [r, cnt] of Object.entries(survivingByRace)) {
        if (this.colony.barracks[r] !== undefined) this.colony.barracks[r] += cnt;
      }
      for (const eq of returnedEquipment) {
        this.colony.depositItemToStoreHouse(eq);
      }
    }

    this.formation = [];
    this.result = {
      victory,
      mission: this.currentMission,
      startingMinions,
      survivingMinions: survivingAllies.length,
      survivingByRace,
      returnedEquipment,
      goldEarned,
      newUnlocks
    };
    this.state = "FINISHED";
  }

  acknowledgeResult() {
    this.state = "IDLE";
    this.inBackground = false;
    this.currentMission = null;
    this.result = null;
    this.units = [];
    this.projectiles = [];
    this.vfx = [];
    if (this.audio) this.audio.startColonyMusic();
  }

  spawnVfx(sheet, x, y, scale = 1.0, duration = 0.4, tint = null) {
    this.vfx.push({
      type: "sheet",
      sheet,
      x,
      y,
      scale,
      tint,
      elapsed: 0,
      duration
    });
  }

  spawnFloatingText(text, x, y, color = "#ffffff") {
    this.floatingTexts.push({
      text,
      x: x + (Math.random() - 0.5) * 8,
      y,
      color,
      life: 0.95,
      maxLife: 0.95
    });
  }
}
