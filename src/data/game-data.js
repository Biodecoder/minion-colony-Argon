/**
 * Canonical game data, stat formulas, building upgrade curves, equipment tiers,
 * enchantments, decorations, and mission layouts for Minion Colony.
 */

export const STAT_KEYS = ["CON", "STR", "DEX", "INT", "WIS", "CHA"];

export const MINION_TYPES = {
  Goblin: {
    id: "Goblin",
    nameKey: "MINION.GOBLIN.NAME",
    descKey: "MINION.GOBLIN.DESCRIPTION",
    recruitable: true,
    unlockedAtStart: true,
    cost: 15,
    sellValue: 10,
    stats: { CON: 1.0, STR: 1.0, DEX: 1.5, INT: 1.5, WIS: 1.0, CHA: 0.75 },
    maxHealth: 100,
    baseDamageLabel: "Medium",
    baseDamage: 18,
    cooldown: 1.4,
    range: 4.2,
    moveSpeed: 2.3,
    abilityType: "arrow",
    icon: "minion_icon_goblin",
    sheetPrefix: "goblin"
  },
  Troll: {
    id: "Troll",
    nameKey: "MINION.TROLL.NAME",
    descKey: "MINION.TROLL.DESCRIPTION",
    recruitable: true,
    unlockedAtStart: true,
    cost: 35,
    sellValue: 24,
    stats: { CON: 2.0, STR: 2.0, DEX: 0.75, INT: 0.25, WIS: 0.5, CHA: 0.5 },
    maxHealth: 220,
    baseDamageLabel: "Low",
    baseDamage: 16,
    cooldown: 1.2,
    range: 1.35,
    moveSpeed: 1.75,
    abilityType: "melee",
    icon: "minion_icon_troll",
    sheetPrefix: "troll"
  },
  LightningMage: {
    id: "LightningMage",
    nameKey: "MINION.LIGHTNING_MAGE.NAME",
    descKey: "MINION.LIGHTNING_MAGE.DESCRIPTION",
    recruitable: true,
    unlockedAtStart: false,
    unlockKey: "Lightning Mage",
    cost: 80,
    sellValue: 55,
    stats: { CON: 0.25, STR: 0.5, DEX: 0.5, INT: 3.0, WIS: 1.25, CHA: 0.5 },
    maxHealth: 75,
    baseDamageLabel: "Medium",
    baseDamage: 24,
    cooldown: 3.0,
    range: 3.8,
    moveSpeed: 1.8,
    abilityType: "chain_lightning",
    chainTargets: 3,
    icon: "minion_icon_lightning_mage",
    sheetPrefix: "lightning_mage"
  },
  Sapling: {
    id: "Sapling",
    nameKey: "MINION.SAPLING.NAME",
    descKey: "MINION.SAPLING.DESCRIPTION",
    recruitable: true,
    unlockedAtStart: false,
    unlockKey: "Sapling",
    cost: 120,
    sellValue: 80,
    stats: { CON: 0.5, STR: 0.5, DEX: 1.0, INT: 1.5, WIS: 3.0, CHA: 1.5 },
    maxHealth: 95,
    baseDamageLabel: "N/A",
    baseDamage: 28,
    cooldown: 2.4,
    range: 4.5,
    moveSpeed: 2.0,
    abilityType: "heal",
    icon: "minion_icon_sapling",
    sheetPrefix: "sapling"
  },
  Cyclops: {
    id: "Cyclops",
    nameKey: "MINION.CYCLOPS.NAME",
    descKey: "MINION.CYCLOPS.DESCRIPTION",
    recruitable: true,
    unlockedAtStart: false,
    unlockKey: "Cyclops",
    cost: 180,
    sellValue: 125,
    stats: { CON: 1.25, STR: 1.5, DEX: 1.0, INT: 0.5, WIS: 2.0, CHA: 1.0 },
    maxHealth: 175,
    baseDamageLabel: "Medium",
    baseDamage: 32,
    cooldown: 2.5,
    range: 5.5,
    moveSpeed: 1.85,
    abilityType: "laser",
    icon: "minion_icon_cyclops",
    sheetPrefix: "cyclops"
  },
  Demon: {
    id: "Demon",
    nameKey: "MINION.DEMON.NAME",
    descKey: "MINION.DEMON.DESCRIPTION",
    recruitable: true,
    unlockedAtStart: false,
    unlockKey: "Demon",
    cost: 280,
    sellValue: 195,
    stats: { CON: 1.0, STR: 1.0, DEX: 0.75, INT: 1.5, WIS: 2.5, CHA: 0.25 },
    maxHealth: 150,
    baseDamageLabel: "High",
    baseDamage: 46,
    cooldown: 3.4,
    range: 4.6,
    moveSpeed: 1.9,
    abilityType: "meteor",
    aoeRadius: 1.6,
    icon: "minion_icon_demon",
    sheetPrefix: "demon"
  },
  Giant: {
    id: "Giant",
    nameKey: "MINION.GIANT.NAME",
    descKey: "MINION.GIANT.DESCRIPTION",
    recruitable: true,
    unlockedAtStart: false,
    unlockKey: "Giant",
    cost: 450,
    sellValue: 315,
    stats: { CON: 3.0, STR: 5.0, DEX: 0.3, INT: 0.05, WIS: 0.5, CHA: 0.0 },
    maxHealth: 380,
    baseDamageLabel: "High",
    baseDamage: 54,
    cooldown: 2.8,
    range: 1.7,
    moveSpeed: 1.45,
    abilityType: "shockwave",
    aoeRadius: 1.8,
    icon: "minion_icon_giant",
    sheetPrefix: "giant"
  },
  // Enemy-only unit types used in EnemyLayouts/*.json
  Fighter: {
    id: "Fighter",
    nameKey: "MINION.WARRIOR.NAME",
    descKey: "MINION.TROLL.DESCRIPTION",
    recruitable: false,
    stats: { CON: 1.5, STR: 1.5, DEX: 1.0, INT: 0.5, WIS: 0.5, CHA: 0.5 },
    maxHealth: 150,
    baseDamageLabel: "Medium",
    baseDamage: 17,
    cooldown: 1.25,
    range: 1.35,
    moveSpeed: 1.85,
    abilityType: "melee",
    icon: "minion_icon_troll",
    sheetPrefix: "fighter"
  },
  Ranger: {
    id: "Ranger",
    nameKey: "MINION.ARCHER.NAME",
    descKey: "MINION.GOBLIN.DESCRIPTION",
    recruitable: false,
    stats: { CON: 0.9, STR: 1.0, DEX: 1.6, INT: 1.0, WIS: 1.0, CHA: 0.5 },
    maxHealth: 95,
    baseDamageLabel: "Medium",
    baseDamage: 19,
    cooldown: 1.45,
    range: 4.5,
    moveSpeed: 2.1,
    abilityType: "arrow",
    icon: "minion_icon_goblin",
    sheetPrefix: "ranger"
  },
  BlueMage: {
    id: "BlueMage",
    nameKey: "MINION.MAGE.NAME",
    descKey: "MINION.LIGHTNING_MAGE.DESCRIPTION",
    recruitable: false,
    stats: { CON: 0.6, STR: 0.5, DEX: 0.8, INT: 2.5, WIS: 1.5, CHA: 0.5 },
    maxHealth: 90,
    baseDamageLabel: "Medium",
    baseDamage: 24,
    cooldown: 2.8,
    range: 4.0,
    moveSpeed: 1.8,
    abilityType: "chain_lightning",
    chainTargets: 3,
    icon: "minion_icon_lightning_mage",
    sheetPrefix: "blue_mage"
  },
  Priest: {
    id: "Priest",
    nameKey: "MINION.PRIEST.NAME",
    descKey: "MINION.SAPLING.DESCRIPTION",
    recruitable: false,
    stats: { CON: 0.8, STR: 0.5, DEX: 1.0, INT: 1.5, WIS: 2.8, CHA: 1.2 },
    maxHealth: 105,
    baseDamageLabel: "N/A",
    baseDamage: 26,
    cooldown: 2.5,
    range: 4.5,
    moveSpeed: 1.9,
    abilityType: "heal",
    icon: "minion_icon_priest",
    sheetPrefix: "priest"
  }
};

// Task Type Config recovered from resources.assets
export const TASK_WEIGHTS = {
  Mining: { STR: 3, CON: 1 },
  Farming: { STR: 1, DEX: 4, WIS: 1 },
  Smithing: { STR: 2, DEX: 4, WIS: 4 },
  Crafting: { STR: 2, DEX: 4, WIS: 4 },
  Enchanting: { INT: 8, WIS: 1, CHA: 1 },
  Move: { DEX: 4, CON: 1 },
  Carrying: { DEX: 4, CON: 1 },
  Performance: { CHA: 6, WIS: 1, INT: 1 }
};

export const GRADE_THRESHOLDS = [
  { grade: "S", minScore: 0.85, color: "#ffcf40" },
  { grade: "A", minScore: 0.65, color: "#73e659" },
  { grade: "B", minScore: 0.45, color: "#52b8ff" },
  { grade: "C", minScore: 0.3, color: "#d6a3ff" },
  { grade: "D", minScore: 0.15, color: "#f5935b" },
  { grade: "F", minScore: 0.0, color: "#e85d5d" }
];

export function computeTaskScore(minionOrStats, taskName) {
  const stats =
    typeof minionOrStats === "string"
      ? MINION_TYPES[minionOrStats]?.stats
      : minionOrStats?.stats || minionOrStats;
  const weights = TASK_WEIGHTS[taskName] || TASK_WEIGHTS.Mining;
  if (!stats || !weights) return 0.4;
  let weightedSum = 0;
  let totalWeight = 0;
  for (const [stat, w] of Object.entries(weights)) {
    weightedSum += (stats[stat] || 0) * w;
    totalWeight += w;
  }
  return (weightedSum / Math.max(1, totalWeight)) / 2.25;
}

export function computeTaskGrade(minionOrStats, taskName) {
  const score = computeTaskScore(minionOrStats, taskName);
  for (const entry of GRADE_THRESHOLDS) {
    if (score >= entry.minScore) {
      return { ...entry, score, speedMultiplier: Math.max(0.35, score * 1.45) };
    }
  }
  return { grade: "F", minScore: 0, color: "#e85d5d", score, speedMultiplier: 0.35 };
}

// ItemTierLookup recovered from resources.assets
export const RESOURCES = {
  Metal: {
    id: "Metal",
    nameKey: "RESOURCES.METAL",
    category: "resource",
    sellGold: 3,
    sprite: "res_metal"
  },
  Carrot: {
    id: "Carrot",
    nameKey: "RESOURCES.FOOD.CARROT",
    category: "resource",
    sellGold: 3,
    sprite: "res_carrot"
  },
  GoldenCarrot: {
    id: "GoldenCarrot",
    nameKey: "RESOURCES.FOOD.GOLDEN_CARROT",
    category: "resource",
    sellGold: 12,
    sprite: "res_golden_carrot"
  },
  Amethyst: {
    id: "Amethyst",
    nameKey: "RESOURCES.VALUABLE.AMETHYST",
    category: "resource",
    sellGold: 30,
    sprite: "res_amethyst"
  },
  Sapphire: {
    id: "Sapphire",
    nameKey: "RESOURCES.VALUABLE.SAPPHIRE",
    category: "resource",
    sellGold: 50,
    sprite: "res_sapphire"
  },
  Ruby: {
    id: "Ruby",
    nameKey: "RESOURCES.VALUABLE.RUBY",
    category: "resource",
    sellGold: 80,
    sprite: "res_ruby"
  }
};

// EquipmentTierLookup recovered from resources.assets
export const WEAPON_TIERS = [
  {
    id: "Weapon_Copper",
    tierIndex: 0,
    tierKey: "ITEM.EQUIPMENT_TIER.COPPER",
    category: "weapon",
    metalCost: 15,
    potencyBonus: 0.25,
    sellGold: 50,
    craftSeconds: 7.0,
    sprite: "weapon_copper"
  },
  {
    id: "Weapon_Iron",
    tierIndex: 1,
    tierKey: "ITEM.EQUIPMENT_TIER.IRON",
    category: "weapon",
    metalCost: 30,
    potencyBonus: 0.5,
    sellGold: 120,
    craftSeconds: 9.0,
    sprite: "weapon_iron"
  },
  {
    id: "Weapon_Gold",
    tierIndex: 2,
    tierKey: "ITEM.EQUIPMENT_TIER.GOLD",
    category: "weapon",
    metalCost: 60,
    potencyBonus: 0.75,
    sellGold: 250,
    craftSeconds: 11.5,
    sprite: "weapon_gold"
  },
  {
    id: "Weapon_Platinum",
    tierIndex: 3,
    tierKey: "ITEM.EQUIPMENT_TIER.PLATINUM",
    category: "weapon",
    metalCost: 100,
    potencyBonus: 1.0,
    sellGold: 400,
    craftSeconds: 14.0,
    sprite: "weapon_platinum"
  },
  {
    id: "Weapon_Cobalt",
    tierIndex: 4,
    tierKey: "ITEM.EQUIPMENT_TIER.COBALT",
    category: "weapon",
    metalCost: 250,
    potencyBonus: 2.0,
    sellGold: 1000,
    craftSeconds: 17.5,
    sprite: "weapon_cobalt"
  },
  {
    id: "Weapon_Mythril",
    tierIndex: 5,
    tierKey: "ITEM.EQUIPMENT_TIER.MYTHRIL",
    category: "weapon",
    metalCost: 500,
    potencyBonus: 3.0,
    sellGold: 2000,
    craftSeconds: 22.0,
    sprite: "weapon_mythril"
  }
];

export const ARMOUR_TIERS = [
  {
    id: "Armour_Copper",
    tierIndex: 0,
    tierKey: "ITEM.EQUIPMENT_TIER.COPPER",
    category: "armour",
    metalCost: 20,
    durabilityBonus: 0.1,
    sellGold: 80,
    craftSeconds: 7.5,
    sprite: "armour_copper"
  },
  {
    id: "Armour_Iron",
    tierIndex: 1,
    tierKey: "ITEM.EQUIPMENT_TIER.IRON",
    category: "armour",
    metalCost: 30,
    durabilityBonus: 0.15,
    sellGold: 115,
    craftSeconds: 9.5,
    sprite: "armour_iron"
  },
  {
    id: "Armour_Gold",
    tierIndex: 2,
    tierKey: "ITEM.EQUIPMENT_TIER.GOLD",
    category: "armour",
    metalCost: 45,
    durabilityBonus: 0.25,
    sellGold: 150,
    craftSeconds: 11.5,
    sprite: "armour_gold"
  },
  {
    id: "Armour_Cobalt",
    tierIndex: 3,
    tierKey: "ITEM.EQUIPMENT_TIER.COBALT",
    category: "armour",
    metalCost: 100,
    durabilityBonus: 0.5,
    sellGold: 350,
    craftSeconds: 14.5,
    sprite: "armour_cobalt"
  },
  {
    id: "Armour_Obsidian",
    tierIndex: 4,
    tierKey: "ITEM.EQUIPMENT_TIER.OBSIDIAN",
    category: "armour",
    metalCost: 300,
    durabilityBonus: 1.0,
    sellGold: 1200,
    craftSeconds: 18.0,
    sprite: "armour_obsidian"
  },
  {
    id: "Armour_Dragonscale",
    tierIndex: 5,
    tierKey: "ITEM.EQUIPMENT_TIER.DRAGONSCALE",
    category: "armour",
    metalCost: 500,
    durabilityBonus: 2.0,
    sellGold: 2000,
    craftSeconds: 22.0,
    sprite: "armour_dragonscale"
  }
];

export const ENCHANTMENTS = {
  Lifesteal: {
    id: "Lifesteal",
    nameKey: "ENCHANTMENT.LIFESTEAL.NAME",
    descKey: "ENCHANTMENT.LIFESTEAL.DESCRIPTION",
    unlockedAtStart: true,
    lifestealRatio: 0.25,
    enchantSeconds: 10.0,
    sellBonusMultiplier: 1.4,
    sprite: "enchant_lifesteal",
    tint: "#ff5577"
  },
  BurningStrikes: {
    id: "BurningStrikes",
    nameKey: "ENCHANTMENT.BURNING_STRIKES.NAME",
    descKey: "ENCHANTMENT.BURNING_STRIKES.DESCRIPTION",
    unlockedAtStart: true,
    burnDpsRatio: 0.16,
    burnDuration: 3.0,
    enchantSeconds: 10.0,
    sellBonusMultiplier: 1.4,
    sprite: "enchant_burning_strikes",
    tint: "#ff8c2b"
  },
  Thorns: {
    id: "Thorns",
    nameKey: "ENCHANTMENT.THORNS.NAME",
    descKey: "ENCHANTMENT.THORNS.DESCRIPTION",
    unlockedAtStart: true,
    thornsReflectRatio: 0.25,
    enchantSeconds: 10.0,
    sellBonusMultiplier: 1.4,
    sprite: "enchant_thorns",
    tint: "#58d66d"
  },
  Rend: {
    id: "Rend",
    nameKey: "ENCHANTMENT.REND.NAME",
    descKey: "ENCHANTMENT.REND.DESCRIPTION",
    unlockedAtStart: false,
    unlockKey: "Rend",
    bonusDamageRatio: 0.35,
    enchantSeconds: 12.0,
    sellBonusMultiplier: 1.65,
    sprite: "enchant_rend",
    tint: "#b85cff"
  }
};

export const BUILDINGS = {
  StoreHouse: {
    id: "StoreHouse",
    nameKey: "BUILDING.STORE_HOUSE.NAME",
    descKey: "BUILDING.STORE_HOUSE.DESCRIPTION",
    placeable: false,
    footprint: { w: 3, h: 3 },
    sprite: "building_store_house",
    uiIcon: "ui_icon_building"
  },
  Barracks: {
    id: "Barracks",
    nameKey: "BUILDING.BARRACKS.NAME",
    descKey: "BUILDING.BARRACKS.DESCRIPTION",
    placeable: false,
    footprint: { w: 4, h: 5 },
    sprite: "building_barracks",
    uiIcon: "ui_icon_swords"
  },
  Market: {
    id: "Market",
    nameKey: "BUILDING.MARKET.NAME",
    descKey: "BUILDING.MARKET.DESCRIPTION",
    placeable: false,
    footprint: { w: 3, h: 2 },
    sprite: "building_market",
    uiIcon: "ui_icon_market"
  },
  Mine: {
    id: "Mine",
    nameKey: "BUILDING.MINE.NAME",
    descKey: "BUILDING.MINE.DESCRIPTION",
    placeable: true,
    unlockedAtStart: true,
    cost: 40,
    sellRatio: 0.7,
    footprint: { w: 3, h: 3 },
    taskType: "Mining",
    workSeconds: 3.4,
    sprite: "building_mine",
    uiIcon: "ui_icon_mine",
    levels: [
      { level: 1, roman: "I", workerLimit: 5, outputLimit: 15, rareFindChance: 0.01, yieldAmount: 1, upgradeCost: 100 },
      { level: 2, roman: "II", workerLimit: 10, outputLimit: 30, rareFindChance: 0.03, yieldAmount: 2, upgradeCost: 250 },
      { level: 3, roman: "III", workerLimit: 15, outputLimit: 50, rareFindChance: 0.05, yieldAmount: 2, upgradeCost: 500 },
      { level: 4, roman: "IV", workerLimit: 20, outputLimit: 80, rareFindChance: 0.08, yieldAmount: 3, upgradeCost: 1000 },
      { level: 5, roman: "V", workerLimit: 30, outputLimit: 120, rareFindChance: 0.12, yieldAmount: 4, upgradeCost: null }
    ]
  },
  Farm: {
    id: "Farm",
    nameKey: "BUILDING.FARM.NAME",
    descKey: "BUILDING.FARM.DESCRIPTION",
    placeable: true,
    unlockedAtStart: true,
    cost: 35,
    sellRatio: 0.7,
    footprint: { w: 3, h: 3 },
    taskType: "Farming",
    workSeconds: 3.0,
    sprite: "building_farm",
    uiIcon: "ui_icon_farm",
    levels: [
      { level: 1, roman: "I", workerLimit: 5, outputLimit: 15, rareFindChance: 0.02, yieldAmount: 1, upgradeCost: 90 },
      { level: 2, roman: "II", workerLimit: 10, outputLimit: 30, rareFindChance: 0.04, yieldAmount: 2, upgradeCost: 220 },
      { level: 3, roman: "III", workerLimit: 15, outputLimit: 50, rareFindChance: 0.07, yieldAmount: 2, upgradeCost: 450 },
      { level: 4, roman: "IV", workerLimit: 20, outputLimit: 80, rareFindChance: 0.1, yieldAmount: 3, upgradeCost: 900 },
      { level: 5, roman: "V", workerLimit: 30, outputLimit: 120, rareFindChance: 0.15, yieldAmount: 4, upgradeCost: null }
    ]
  },
  Smith: {
    id: "Smith",
    nameKey: "BUILDING.SMITH.NAME",
    descKey: "BUILDING.SMITH.DESCRIPTION",
    placeable: true,
    unlockedAtStart: false,
    unlockKey: "Smith",
    cost: 85,
    sellRatio: 0.7,
    footprint: { w: 3, h: 3 },
    taskType: "Smithing",
    sprite: "building_smith",
    uiIcon: "ui_icon_smith",
    levels: [
      { level: 1, roman: "I", workerLimit: 4, inputLimit: 60, outputLimit: 8, maxTierIndex: 0, upgradeCost: 150 },
      { level: 2, roman: "II", workerLimit: 6, inputLimit: 120, outputLimit: 12, maxTierIndex: 1, upgradeCost: 350 },
      { level: 3, roman: "III", workerLimit: 8, inputLimit: 240, outputLimit: 16, maxTierIndex: 2, upgradeCost: 700 },
      { level: 4, roman: "IV", workerLimit: 12, inputLimit: 400, outputLimit: 20, maxTierIndex: 3, upgradeCost: 1300 },
      { level: 5, roman: "V", workerLimit: 16, inputLimit: 800, outputLimit: 25, maxTierIndex: 4, upgradeCost: 2400 },
      { level: 6, roman: "VI", workerLimit: 20, inputLimit: 1500, outputLimit: 30, maxTierIndex: 5, upgradeCost: null }
    ]
  },
  Armourer: {
    id: "Armourer",
    nameKey: "BUILDING.ARMOURER.NAME",
    descKey: "BUILDING.ARMOURER.DESCRIPTION",
    placeable: true,
    unlockedAtStart: false,
    unlockKey: "Armourer",
    cost: 120,
    sellRatio: 0.7,
    footprint: { w: 3, h: 3 },
    taskType: "Smithing",
    sprite: "building_armourer",
    uiIcon: "ui_icon_armour",
    levels: [
      { level: 1, roman: "I", workerLimit: 4, inputLimit: 60, outputLimit: 8, maxTierIndex: 0, upgradeCost: 160 },
      { level: 2, roman: "II", workerLimit: 6, inputLimit: 120, outputLimit: 12, maxTierIndex: 1, upgradeCost: 360 },
      { level: 3, roman: "III", workerLimit: 8, inputLimit: 200, outputLimit: 16, maxTierIndex: 2, upgradeCost: 720 },
      { level: 4, roman: "IV", workerLimit: 12, inputLimit: 400, outputLimit: 20, maxTierIndex: 3, upgradeCost: 1350 },
      { level: 5, roman: "V", workerLimit: 16, inputLimit: 900, outputLimit: 25, maxTierIndex: 4, upgradeCost: 2500 },
      { level: 6, roman: "VI", workerLimit: 20, inputLimit: 1500, outputLimit: 30, maxTierIndex: 5, upgradeCost: null }
    ]
  },
  WizardTower: {
    id: "WizardTower",
    nameKey: "BUILDING.WIZARD_TOWER.NAME",
    descKey: "BUILDING.WIZARD_TOWER.DESCRIPTION",
    placeable: true,
    unlockedAtStart: false,
    unlockKey: "Wizard Tower",
    cost: 240,
    sellRatio: 0.7,
    footprint: { w: 2, h: 4 },
    taskType: "Enchanting",
    sprite: "building_wizard_tower",
    uiIcon: "ui_icon_enchant",
    levels: [
      { level: 1, roman: "I", workerLimit: 4, inputLimit: 6, outputLimit: 8, speedBonus: 1.0, upgradeCost: 300 },
      { level: 2, roman: "II", workerLimit: 8, inputLimit: 12, outputLimit: 14, speedBonus: 1.35, upgradeCost: 650 },
      { level: 3, roman: "III", workerLimit: 12, inputLimit: 20, outputLimit: 20, speedBonus: 1.75, upgradeCost: 1200 },
      { level: 4, roman: "IV", workerLimit: 16, inputLimit: 30, outputLimit: 30, speedBonus: 2.25, upgradeCost: null }
    ]
  }
};

export const DECORATIONS = {
  FlowerG: {
    id: "FlowerG",
    nameKey: "DECOR.FLOWER_G.NAME",
    unlockedAtStart: false,
    unlockKey: "FlowerG",
    cost: 25,
    moraleBonus: 3,
    footprint: { w: 1, h: 1 },
    sprite: "decor_gladiolus"
  },
  Pillar: {
    id: "Pillar",
    nameKey: "DECOR.PILLAR.NAME",
    unlockedAtStart: false,
    unlockKey: "Pillar",
    cost: 60,
    moraleBonus: 6,
    footprint: { w: 1, h: 2 },
    sprite: "decor_pillar"
  },
  Well: {
    id: "Well",
    nameKey: "DECOR.WELL.NAME",
    unlockedAtStart: false,
    unlockKey: "Well",
    cost: 110,
    moraleBonus: 10,
    footprint: { w: 2, h: 2 },
    sprite: "decor_well"
  },
  Fountain: {
    id: "Fountain",
    nameKey: "DECOR.FOUNTAIN.NAME",
    unlockedAtStart: false,
    unlockKey: "Fountain",
    cost: 220,
    moraleBonus: 18,
    footprint: { w: 3, h: 3 },
    sprite: "decor_fountain",
    sheet: "prop_fountain"
  },
  FlowerC: {
    id: "FlowerC",
    nameKey: "DECOR.FLOWER_C.NAME",
    unlockedAtStart: false,
    unlockKey: "FlowerC",
    cost: 40,
    moraleBonus: 5,
    footprint: { w: 1, h: 1 },
    sprite: "decor_chrysanthemum"
  },
  Fireplace: {
    id: "Fireplace",
    nameKey: "DECOR.CAMPFIRE.NAME",
    unlockedAtStart: false,
    unlockKey: "Fireplace",
    cost: 150,
    moraleBonus: 14,
    footprint: { w: 1, h: 1 },
    sprite: "decor_campfire",
    sheet: "prop_bonfire"
  },
  Buyland: {
    id: "Buyland",
    nameKey: "DECOR.BUY_LAND.NAME",
    descKey: "DECOR.BUY_LAND.DESCRIPTION",
    unlockedAtStart: false,
    unlockKey: "Buyland",
    cost: 150,
    moraleBonus: 0,
    isLandClear: true,
    sprite: "tile_tree_0"
  }
};

// All 7 canonical missions (with exact EnemyLayouts/*.json coordinates) + 3 extrapolated endgame missions
export const MISSIONS = [
  {
    id: "savage_duo",
    index: 1,
    nameKey: "MISSION.SAVAGE_DUO.NAME",
    descKey: "MISSION.SAVAGE_DUO.DESCRIPTION",
    difficultyKey: "MISSION_UI.DIFFICULTY.EASY",
    difficultyTier: 1,
    minionLimit: 4,
    goldReward: 50,
    firstClearBonusGold: 49,
    unlocks: ["Smith", "FlowerG"],
    icon: "minion_icon_troll",
    arenaWidth: 10,
    arenaHeight: 10,
    enemies: [
      { x: 0, y: -1, health: 1.0, durability: 1.0, potency: 1.0, race: "Fighter" },
      { x: 0, y: 0, health: 1.0, durability: 1.0, potency: 1.0, race: "Fighter" }
    ]
  },
  {
    id: "local_bandits",
    index: 2,
    nameKey: "MISSION.LOCAL_BANDITS.NAME",
    descKey: "MISSION.LOCAL_BANDITS.DESCRIPTION",
    difficultyKey: "MISSION_UI.DIFFICULTY.EASY",
    difficultyTier: 1,
    minionLimit: 6,
    goldReward: 100,
    firstClearBonusGold: 300,
    unlocks: ["Lightning Mage", "Pillar"],
    icon: "minion_icon_goblin",
    arenaWidth: 10,
    arenaHeight: 10,
    enemies: [
      { x: 0, y: 0, health: 1.0, durability: 1.0, potency: 1.0, race: "Fighter" },
      { x: 0, y: 1, health: 1.0, durability: 1.0, potency: 1.0, race: "Fighter" },
      { x: 3, y: 0, health: 1.0, durability: 1.0, potency: 1.0, race: "Ranger" },
      { x: 3, y: 1, health: 1.0, durability: 1.0, potency: 1.0, race: "Ranger" },
      { x: 0, y: -1, health: 1.0, durability: 1.0, potency: 1.0, race: "Fighter" }
    ]
  },
  {
    id: "troll_horde",
    index: 3,
    nameKey: "MISSION.TROLL_HORDE.NAME",
    descKey: "MISSION.TROLL_HORDE.DESCRIPTION",
    difficultyKey: "MISSION_UI.DIFFICULTY.EASY",
    difficultyTier: 1,
    minionLimit: 10,
    goldReward: 400,
    firstClearBonusGold: 200,
    unlocks: ["Armourer", "Well", "Buyland"],
    icon: "minion_icon_troll",
    arenaWidth: 10,
    arenaHeight: 10,
    enemies: [
      { x: 0, y: 0, health: 1.0, durability: 1.0, potency: 1.0, race: "Troll" },
      { x: 0, y: 2, health: 1.0, durability: 1.0, potency: 1.0, race: "Troll" },
      { x: 0, y: 1, health: 1.0, durability: 1.0, potency: 1.0, race: "Troll" },
      { x: 0, y: -1, health: 1.0, durability: 1.0, potency: 1.0, race: "Troll" },
      { x: 2, y: -2, health: 1.0, durability: 1.0, potency: 1.0, race: "Troll" },
      { x: 0, y: -2, health: 1.0, durability: 1.0, potency: 1.0, race: "Troll" },
      { x: 1, y: 2, health: 1.0, durability: 1.0, potency: 1.0, race: "Troll" },
      { x: 1, y: 1, health: 1.0, durability: 1.0, potency: 1.0, race: "Troll" },
      { x: 1, y: 0, health: 1.0, durability: 1.0, potency: 1.0, race: "Troll" },
      { x: 1, y: -1, health: 1.0, durability: 1.0, potency: 1.0, race: "Troll" },
      { x: 2, y: -1, health: 1.0, durability: 1.0, potency: 1.0, race: "Troll" },
      { x: 2, y: 1, health: 1.0, durability: 1.0, potency: 1.0, race: "Troll" },
      { x: 1, y: -2, health: 1.0, durability: 1.0, potency: 1.0, race: "Troll" },
      { x: 2, y: 2, health: 1.0, durability: 1.0, potency: 1.0, race: "Troll" },
      { x: 2, y: 0, health: 1.0, durability: 1.0, potency: 1.0, race: "Troll" }
    ]
  },
  {
    id: "wizard_expedition",
    index: 4,
    nameKey: "MISSION.WIZARDS.NAME",
    descKey: "MISSION.WIZARDS.DESCRIPTION",
    difficultyKey: "MISSION_UI.DIFFICULTY.MEDIUM",
    difficultyTier: 2,
    minionLimit: 8,
    goldReward: 600,
    firstClearBonusGold: 200,
    unlocks: ["Wizard Tower", "Fountain"],
    icon: "minion_icon_lightning_mage",
    arenaWidth: 10,
    arenaHeight: 10,
    enemies: [
      { x: 0, y: 0, health: 1.0, durability: 1.0, potency: 1.0, race: "Fighter" },
      { x: 0, y: -1, health: 1.0, durability: 1.0, potency: 1.0, race: "Fighter" },
      { x: 0, y: -2, health: 1.0, durability: 1.0, potency: 1.0, race: "Fighter" },
      { x: 0, y: 1, health: 1.0, durability: 1.0, potency: 1.0, race: "Fighter" },
      { x: 1, y: 2, health: 1.0, durability: 1.0, potency: 1.0, race: "LightningMage" },
      { x: 0, y: 2, health: 1.0, durability: 1.0, potency: 1.0, race: "Fighter" },
      { x: 1, y: -2, health: 1.0, durability: 1.0, potency: 1.0, race: "LightningMage" },
      { x: 2, y: -1, health: 1.0, durability: 1.0, potency: 1.0, race: "LightningMage" },
      { x: 2, y: 1, health: 1.0, durability: 1.0, potency: 1.0, race: "LightningMage" }
    ]
  },
  {
    id: "local_bandits_2",
    index: 5,
    nameKey: "MISSION.LOCAL_BANDITS_2.NAME",
    descKey: "MISSION.LOCAL_BANDITS_2.DESCRIPTION",
    difficultyKey: "MISSION_UI.DIFFICULTY.MEDIUM",
    difficultyTier: 2,
    minionLimit: 12,
    goldReward: 800,
    firstClearBonusGold: 400,
    unlocks: ["Sapling", "FlowerC"],
    icon: "ui_icon_enchant",
    arenaWidth: 10,
    arenaHeight: 10,
    enemies: [
      { x: 0, y: 0, health: 1.0, durability: 1.0, potency: 1.0, race: "Fighter" },
      { x: 0, y: 1, health: 1.0, durability: 1.0, potency: 1.0, race: "Fighter" },
      { x: 0, y: 2, health: 1.0, durability: 1.0, potency: 1.0, race: "Fighter" },
      { x: 0, y: -2, health: 1.0, durability: 1.0, potency: 1.0, race: "Fighter" },
      { x: 0, y: -1, health: 1.0, durability: 1.0, potency: 1.0, race: "Fighter" },
      { x: 1, y: -2, health: 1.0, durability: 1.0, potency: 1.0, race: "Fighter" },
      { x: 1, y: 0, health: 1.0, durability: 1.0, potency: 1.0, race: "Fighter" },
      { x: 1, y: 2, health: 1.0, durability: 1.0, potency: 1.0, race: "Fighter" },
      { x: 3, y: 2, health: 1.0, durability: 1.0, potency: 1.0, race: "BlueMage" },
      { x: 3, y: -1, health: 1.0, durability: 1.0, potency: 1.0, race: "BlueMage" },
      { x: 3, y: -2, health: 1.0, durability: 1.0, potency: 1.0, race: "BlueMage" },
      { x: 3, y: 1, health: 1.0, durability: 1.0, potency: 1.0, race: "BlueMage" },
      { x: 4, y: 2, health: 1.0, durability: 1.0, potency: 1.0, race: "Ranger" },
      { x: 4, y: 1, health: 1.0, durability: 1.0, potency: 1.0, race: "Ranger" },
      { x: 4, y: -1, health: 1.0, durability: 1.0, potency: 1.0, race: "Ranger" },
      { x: 4, y: -2, health: 1.0, durability: 1.0, potency: 1.0, race: "Ranger" }
    ]
  },
  {
    id: "giant_boss",
    index: 6,
    nameKey: "MISSION.GIANT_CYCLOPS.NAME",
    descKey: "MISSION.GIANT_CYCLOPS.DESCRIPTION",
    difficultyKey: "MISSION_UI.DIFFICULTY.HARD",
    difficultyTier: 3,
    minionLimit: 10,
    goldReward: 1200,
    firstClearBonusGold: 300,
    unlocks: ["Cyclops", "Fireplace", "Rend"],
    icon: "minion_icon_cyclops",
    arenaWidth: 10,
    arenaHeight: 10,
    enemies: [
      { x: 3, y: 0, health: 10.0, durability: 1.0, potency: 1.0, race: "Giant", isBoss: true }
    ]
  },
  {
    id: "silverwood_army",
    index: 7,
    nameKey: "MISSION.SILVERWOOD_ARMY.NAME",
    descKey: "MISSION.SILVERWOOD_ARMY.DESCRIPTION",
    difficultyKey: "MISSION_UI.DIFFICULTY.HARD",
    difficultyTier: 3,
    minionLimit: 20,
    goldReward: 1500,
    firstClearBonusGold: 500,
    unlocks: ["Demon"],
    icon: "minion_icon_cyclops",
    arenaWidth: 10,
    arenaHeight: 11,
    enemies: [
      { x: 0, y: 0, health: 1.0, durability: 1.0, potency: 1.0, race: "Fighter" },
      { x: 0, y: -2, health: 1.0, durability: 1.0, potency: 1.0, race: "Fighter" },
      { x: 0, y: -1, health: 1.0, durability: 1.0, potency: 1.0, race: "Fighter" },
      { x: 1, y: -2, health: 1.0, durability: 1.0, potency: 1.0, race: "Fighter" },
      { x: 1, y: -1, health: 1.0, durability: 1.0, potency: 1.0, race: "Fighter" },
      { x: 3, y: -1, health: 1.0, durability: 1.0, potency: 1.0, race: "Priest" },
      { x: 1, y: 0, health: 1.0, durability: 1.0, potency: 1.0, race: "Fighter" },
      { x: 1, y: 2, health: 1.0, durability: 1.0, potency: 1.0, race: "Fighter" },
      { x: 1, y: 1, health: 1.0, durability: 1.0, potency: 1.0, race: "Fighter" },
      { x: 0, y: 1, health: 1.0, durability: 1.0, potency: 1.0, race: "Fighter" },
      { x: 0, y: 2, health: 1.0, durability: 1.0, potency: 1.0, race: "Fighter" },
      { x: 2, y: 0, health: 1.0, durability: 1.0, potency: 1.0, race: "Ranger" },
      { x: 2, y: 1, health: 1.0, durability: 1.0, potency: 1.0, race: "Ranger" },
      { x: 2, y: -1, health: 1.0, durability: 1.0, potency: 1.0, race: "Ranger" },
      { x: 3, y: 1, health: 1.0, durability: 1.0, potency: 1.0, race: "Priest" },
      { x: 3, y: 0, health: 1.0, durability: 1.0, potency: 1.0, race: "Ranger" },
      { x: 4, y: 2, health: 1.0, durability: 1.0, potency: 1.0, race: "Cyclops" },
      { x: 4, y: -2, health: 1.0, durability: 1.0, potency: 1.0, race: "Cyclops" }
    ]
  },
  // 3 Extrapolated Endgame Missions (Missions 8–10)
  {
    id: "obsidian_siege",
    index: 8,
    nameKey: "MISSION.OBSIDIAN_SIEGE.NAME",
    descKey: "MISSION.OBSIDIAN_SIEGE.DESCRIPTION",
    difficultyKey: "MISSION_UI.DIFFICULTY.HARD",
    difficultyTier: 3,
    minionLimit: 22,
    goldReward: 2200,
    firstClearBonusGold: 800,
    unlocks: ["Giant"],
    icon: "minion_icon_demon",
    arenaWidth: 10,
    arenaHeight: 11,
    enemies: [
      { x: 1, y: -1, health: 4.5, durability: 1.3, potency: 1.3, race: "Giant", isBoss: true },
      { x: 1, y: 1, health: 4.5, durability: 1.3, potency: 1.3, race: "Giant", isBoss: true },
      { x: 0, y: -2, health: 1.4, durability: 1.2, potency: 1.2, race: "Fighter" },
      { x: 0, y: 0, health: 1.4, durability: 1.2, potency: 1.2, race: "Fighter" },
      { x: 0, y: 2, health: 1.4, durability: 1.2, potency: 1.2, race: "Fighter" },
      { x: 3, y: -1, health: 1.3, durability: 1.1, potency: 1.3, race: "Priest" },
      { x: 3, y: 1, health: 1.3, durability: 1.1, potency: 1.3, race: "Priest" },
      { x: 4, y: -2, health: 1.5, durability: 1.2, potency: 1.4, race: "Cyclops" },
      { x: 4, y: 0, health: 1.5, durability: 1.2, potency: 1.4, race: "Cyclops" },
      { x: 4, y: 2, health: 1.5, durability: 1.2, potency: 1.4, race: "Cyclops" }
    ]
  },
  {
    id: "dragonscale_citadel",
    index: 9,
    nameKey: "MISSION.DRAGONSCALE_CITADEL.NAME",
    descKey: "MISSION.DRAGONSCALE_CITADEL.DESCRIPTION",
    difficultyKey: "MISSION_UI.DIFFICULTY.EXTREME",
    difficultyTier: 4,
    minionLimit: 25,
    goldReward: 3200,
    firstClearBonusGold: 1000,
    unlocks: [],
    icon: "minion_icon_giant",
    arenaWidth: 10,
    arenaHeight: 11,
    enemies: [
      { x: 0, y: -2, health: 1.8, durability: 1.5, potency: 1.4, race: "Fighter" },
      { x: 0, y: -1, health: 1.8, durability: 1.5, potency: 1.4, race: "Fighter" },
      { x: 0, y: 0, health: 2.0, durability: 1.6, potency: 1.5, race: "Troll" },
      { x: 0, y: 1, health: 1.8, durability: 1.5, potency: 1.4, race: "Fighter" },
      { x: 0, y: 2, health: 1.8, durability: 1.5, potency: 1.4, race: "Fighter" },
      { x: 2, y: -2, health: 1.5, durability: 1.2, potency: 1.5, race: "BlueMage" },
      { x: 2, y: -1, health: 1.5, durability: 1.2, potency: 1.5, race: "BlueMage" },
      { x: 2, y: 1, health: 1.5, durability: 1.2, potency: 1.5, race: "BlueMage" },
      { x: 2, y: 2, health: 1.5, durability: 1.2, potency: 1.5, race: "BlueMage" },
      { x: 3, y: -1, health: 1.6, durability: 1.3, potency: 1.5, race: "Priest" },
      { x: 3, y: 0, health: 1.6, durability: 1.3, potency: 1.5, race: "Priest" },
      { x: 3, y: 1, health: 1.6, durability: 1.3, potency: 1.5, race: "Priest" },
      { x: 4, y: -1, health: 1.6, durability: 1.3, potency: 1.6, race: "Demon" },
      { x: 4, y: 1, health: 1.6, durability: 1.3, potency: 1.6, race: "Demon" }
    ]
  },
  {
    id: "archmage_sanctum",
    index: 10,
    nameKey: "MISSION.ARCHMAGE_SANCTUM.NAME",
    descKey: "MISSION.ARCHMAGE_SANCTUM.DESCRIPTION",
    difficultyKey: "MISSION_UI.DIFFICULTY.EXTREME",
    difficultyTier: 4,
    minionLimit: 30,
    goldReward: 5000,
    firstClearBonusGold: 2500,
    unlocks: [],
    icon: "ui_icon_swords",
    arenaWidth: 10,
    arenaHeight: 11,
    enemies: [
      { x: 1, y: 0, health: 8.0, durability: 1.6, potency: 1.6, race: "Giant", isBoss: true },
      { x: 0, y: -2, health: 2.0, durability: 1.5, potency: 1.5, race: "Troll" },
      { x: 0, y: -1, health: 2.0, durability: 1.5, potency: 1.5, race: "Fighter" },
      { x: 0, y: 1, health: 2.0, durability: 1.5, potency: 1.5, race: "Fighter" },
      { x: 0, y: 2, health: 2.0, durability: 1.5, potency: 1.5, race: "Troll" },
      { x: 2, y: -2, health: 1.8, durability: 1.3, potency: 1.6, race: "BlueMage" },
      { x: 2, y: 0, health: 1.8, durability: 1.3, potency: 1.6, race: "Demon" },
      { x: 2, y: 2, health: 1.8, durability: 1.3, potency: 1.6, race: "BlueMage" },
      { x: 3, y: -1, health: 1.8, durability: 1.4, potency: 1.6, race: "Priest" },
      { x: 3, y: 1, health: 1.8, durability: 1.4, potency: 1.6, race: "Priest" },
      { x: 4, y: -2, health: 1.8, durability: 1.3, potency: 1.6, race: "Cyclops" },
      { x: 4, y: 0, health: 1.8, durability: 1.3, potency: 1.6, race: "Ranger" },
      { x: 4, y: 2, health: 1.8, durability: 1.3, potency: 1.6, race: "Cyclops" }
    ]
  }
];

// Normalize convenience properties used across UI & Simulation
for (const tier of [...WEAPON_TIERS, ...ARMOUR_TIERS]) {
  tier.nameKey = tier.nameKey || tier.tierKey;
}
for (const ench of Object.values(ENCHANTMENTS)) {
  ench.frameSprite = ench.frameSprite || ench.sprite;
}
for (const b of Object.values(BUILDINGS)) {
  b.task = b.task || b.taskType || null;
  if (b.levels) {
    for (const lv of b.levels) {
      lv.workEfficiency = lv.workEfficiency ?? lv.speedBonus ?? Number((1 + (lv.level - 1) * 0.25).toFixed(2));
      if (lv.maxTierIndex !== undefined && lv.maxRecipeTier === undefined) {
        lv.maxRecipeTier = lv.maxTierIndex;
      }
    }
  }
}
for (const d of Object.values(DECORATIONS)) {
  if (!d.descKey && d.nameKey) {
    d.descKey = d.nameKey.replace(".NAME", ".DESCRIPTION");
  }
}
for (const m of MISSIONS) {
  m.number = m.number ?? m.index;
  m.difficulty =
    m.difficulty ||
    (m.difficultyTier === 1 ? "easy" : m.difficultyTier === 2 ? "medium" : m.difficultyTier === 3 ? "hard" : "endgame");
}

