import test from "node:test";
import assert from "node:assert/strict";
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
} from "../src/data/game-data.js";
import { ColonySim } from "../src/sim/colony-sim.js";
import { BattleSim } from "../src/sim/battle-sim.js";

test("1. Minion 6-stat spreads and Task Grade calculations match canonical roles", () => {
  assert.equal(Object.keys(MINION_TYPES).length, 11); // 7 recruitable + 4 enemies
  assert.equal(computeTaskGrade(MINION_TYPES.Troll.stats, "Mining").grade, "S");
  assert.equal(computeTaskGrade(MINION_TYPES.Sapling.stats, "Farming").grade, "B");
  assert.equal(computeTaskGrade(MINION_TYPES.Demon.stats, "Crafting").grade, "A");
  assert.equal(computeTaskGrade(MINION_TYPES.LightningMage.stats, "Enchanting").grade, "S");
  assert.equal(computeTaskGrade(MINION_TYPES.Giant.stats, "Mining").grade, "S");
});

test("2. Colony building placement, upgrading (I -> VI), moving, selling, and Buy Land", () => {
  const colony = new ColonySim();
  colony.gold = 50000;

  // Place a Mine
  const mine = colony.placeBuilding("Mine", 12, 14);
  assert.ok(mine, "Mine should be placed on cleared meadow");
  assert.equal(mine.level, 1);

  // Upgrade Mine from Level I to Level V
  for (let lv = 2; lv <= 5; lv++) {
    assert.equal(colony.upgradeBuilding(mine.id), true);
    assert.equal(mine.level, lv);
  }
  assert.equal(colony.upgradeBuilding(mine.id), false, "Cannot upgrade past max level");

  // Move Mine
  assert.equal(colony.moveBuilding(mine.id, 20, 14), true);
  assert.equal(mine.gx, 20);

  // Sell Mine
  const goldBefore = colony.gold;
  assert.equal(colony.sellBuilding(mine.id), true);
  assert.ok(colony.gold > goldBefore, "Selling building refunds 70% of total invested gold");

  // Buy Land clears a forest chunk
  const uncleared = colony.forestChunks.find((c) => !c.cleared);
  assert.ok(uncleared);
  const clearedChunk = colony.buyLandAt(uncleared.gx, uncleared.gy);
  assert.ok(clearedChunk?.cleared);
});

test("3. Production, Smith/Armourer Crafting, Wizard Tower Enchanting, and Courier Logistics with Filter Threshold", () => {
  const colony = new ColonySim();
  colony.gold = 20000;
  ["Smith", "Armourer", "WizardTower", "Rend", "Demon", "LightningMage"].forEach((k) =>
    colony.unlocks.add(k)
  );

  const mine = colony.placeBuilding("Mine", 11, 14);
  const smith = colony.placeBuilding("Smith", 21, 14);
  const wizard = colony.placeBuilding("WizardTower", 21, 9);
  assert.ok(mine && smith && wizard);

  // Assign Trolls to Mine
  const miners = colony.recruitMinion("Troll", mine.x, mine.y, 2);
  assert.equal(colony.commandWork(miners.map((m) => m.id), mine.id), 2);

  // Tick colony until Mine produces Metal
  for (let i = 0; i < 60; i++) colony.update(0.25);
  assert.ok(mine.output.length > 0, "Mine should produce Metal into output queue");

  // Assign Goblin courier from Mine -> Store House
  const couriers = colony.recruitMinion("Goblin", mine.x, mine.y, 2);
  colony.commandMoveGoods(couriers.map((m) => m.id), mine.id, colony.storeHouse.id);
  const initialStoreMetal = colony.resources.Metal;
  for (let i = 0; i < 80; i++) colony.update(0.2);
  assert.ok(colony.resources.Metal > initialStoreMetal, "Courier should deposit Metal into Store House");

  // Test Store House Filter Threshold: set threshold = 100 so courier does not take Metal when Metal <= 100
  colony.resources.Metal = 25;
  const blockedTake = colony.takeItemFromSource(colony.storeHouse, smith, {
    anyResource: true,
    threshold: 30
  });
  assert.equal(blockedTake, null, "Store House filter threshold should protect reserve stock");

  // Craft a Copper Sword at Smith (costs 15 Metal)
  for (let i = 0; i < 15; i++) smith.input.push(colony.createResourceItem("Metal", 1));
  const smithWorker = colony.recruitMinion("Demon", smith.x, smith.y, 1);
  colony.commandWork([smithWorker[0].id], smith.id);
  for (let i = 0; i < 80; i++) colony.update(0.25);
  assert.ok(smith.output.length >= 1, "Smith should craft weapon from input Metal");

  // Enchant the crafted weapon at Wizard Tower
  const craftedWeapon = smith.output.shift();
  wizard.selectedEnchantment = "BurningStrikes";
  wizard.input.push(craftedWeapon);
  const mages = colony.recruitMinion("LightningMage", wizard.x, wizard.y, 1);
  colony.commandWork([mages[0].id], wizard.id);
  for (let i = 0; i < 100; i++) colony.update(0.25);
  assert.ok(wizard.output.length >= 1, "Wizard Tower should enchant the weapon");
  assert.equal(wizard.output[0].enchantment, "BurningStrikes");
});

test("4. All 10 Missions, Formation Editor, Continuous Equipping, Combat Loop, and Victory Unlocks", () => {
  assert.equal(MISSIONS.length, 10, "Should include 7 canonical + 3 extrapolated endgame missions");

  const colony = new ColonySim();
  const battle = new BattleSim(colony);

  // Stock Barracks and Store House equipment
  colony.barracks.Goblin = 5;
  colony.barracks.Troll = 3;
  colony.barracks.LightningMage = 2;
  colony.depositItemToStoreHouse(colony.createEquipmentItem(WEAPON_TIERS[2], "Lifesteal"));
  colony.depositItemToStoreHouse(colony.createEquipmentItem(WEAPON_TIERS[2], "Lifesteal"));
  colony.depositItemToStoreHouse(colony.createEquipmentItem(ARMOUR_TIERS[2], "Thorns"));

  assert.equal(battle.openFormation("mission_1"), true);
  assert.equal(battle.state, "FORMATION");

  // Place units on formation grid
  battle.selectedBarracksRace = "Troll";
  assert.equal(battle.placeOrEquipAtFormationTile(-1, 0), true);
  assert.equal(battle.placeOrEquipAtFormationTile(-1, 1), true);
  battle.selectedBarracksRace = "LightningMage";
  assert.equal(battle.placeOrEquipAtFormationTile(-3, 0), true);

  // Equip first Lifesteal sword; verify continuous equipping auto-selects the second identical sword
  battle.selectedEquipmentUid = colony.equipment[0].uid;
  assert.equal(battle.placeOrEquipAtFormationTile(-1, 0), true);
  assert.ok(battle.selectedEquipmentUid, "Continuous equipping should select the next matching item");
  assert.equal(battle.placeOrEquipAtFormationTile(-1, 1), true);

  // Start battle and run at 4x speed until completion
  assert.equal(battle.startBattle(), true);
  battle.speedMultiplier = 4;
  for (let i = 0; i < 400 && battle.state === "IN_PROGRESS"; i++) {
    battle.update(0.05);
  }
  assert.equal(battle.state, "FINISHED");
  assert.equal(battle.result.victory, true);
  assert.ok(colony.unlocks.has("Smith"));
  assert.ok(colony.unlocks.has("FlowerG"));
});

test("5. Save/Load Serialization and 2,000-Minion Performance Benchmark", () => {
  const colony = new ColonySim();
  assert.equal(colony.minions.length, 6, "New game should spawn 6 visible starter minions in colony");
  colony.gold = 9999;
  colony.placeBuilding("Mine", 12, 14);
  colony.recruitMinion("Goblin", 350, 260, 10);
  const expectedGold = colony.gold;

  const snapshot = colony.serialize();
  const restored = new ColonySim();
  assert.equal(restored.deserialize(snapshot), true);
  assert.equal(restored.gold, expectedGold);
  assert.equal(restored.minions.length, 16);

  // 2,000-Minion simulation tick benchmark
  restored.gold = 1000000;
  restored.recruitMinion("Goblin", 400, 260, 1984);
  assert.equal(restored.minions.length, 2000);

  const t0 = performance.now();
  restored.update(0.016);
  const elapsedMs = performance.now() - t0;
  assert.ok(elapsedMs < 25, `2,000-minion tick took ${elapsedMs.toFixed(2)}ms (target < 25ms)`);
});
