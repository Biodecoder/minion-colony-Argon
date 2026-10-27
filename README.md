# Minion Colony (`minion-colony-Argon`)

A faithful 1:1 pixel-art and gameplay recreation—plus 3 extrapolated endgame missions—of ***Minion Colony*** (Steam App ID `4112400`, developed by Jam Studios).

## Features

- **Authentic Extracted Assets (`Minifantasy` + `Yoster Island` Font + 37 `.m4a` Audio Clips)**:
  - `94` cropped canonical sprites (`assets/sprites/*.png`) and `55` horizontal animation strips (`assets/sprites/sheets/*.png`) extracted directly from the Unity bundle via [`scripts/extract_unity_assets.py`](./scripts/extract_unity_assets.py).
  - Warm radial `Light 2D` torchlight vignette over the meadow and forest perimeter (`Buy Land` chunk clearing).
- **Real-Time Colony Builder & Logistics (`ColonySim`)**:
  - **8 Buildings** (`Store House`, `Barracks`, `Market`, `Mine I–V`, `Farm I–V`, `Smith I–VI`, `Armourer I–VI`, `Wizard Tower I–IV`).
  - **7 Recruitable Minions** (`Goblin`, `Troll`, `Skeleton Sorcerer`, `Sapling`, `Cyclops`, `Demon`, `Giant`) with 6-stat spreads (`CON`, `STR`, `DEX`, `INT`, `WIS`, `CHA`) and `S`–`F` Task Scaling grades (`Mining`, `Farming`, `Smithing`, `Enchanting`, `Move`, `Performance`).
  - **Courier Transport & Store House Item Filtering**: Assign minions to `Move Goods` between buildings with overhead carried items, visual route arrows (`R`), and Store House item filters + reserve threshold protection.
  - **Colony Morale System**: Decorations (`Gladiolus`, `Chrysanthemum`, `Pillar`, `Well`, `Fountain`, `Campfire`) and Minion Charisma boost colony work efficiency up to `220%`.
- **Formation Editor & Real-Time Auto-Battler (`BattleSim`)**:
  - **10 Missions**: All 7 canonical missions (`Savage Duo`, `Local Bandits`, `Troll Horde`, `Wizard Expedition`, `Local Bandits II`, `Giant`, `Silverwood Army`) with exact `EnemyLayouts/*.json` coordinates, plus 3 extrapolated endgame missions (`Obsidian Siege`, `Dragonscale Citadel`, `The King's Citadel`).
  - **6 Tiers of Weapons & Armour + 4 Enchantments**: Craft `Copper` through `Mythril` weapons and `Dragonscale` armour, enchant them with `Lifesteal`, `Burning Strikes`, `Thorns`, or `Rend`, and equip them onto your units in the Formation Editor.
  - **Background Battle Execution**: Toggle `1x / 4x` combat speed, abort missions, or click `Back (Manage Colony)` to manage your colony while battles run in the background.

## Quick Start

Double-click [`Launch.command`](./Launch.command) on macOS, or run from the terminal:

```bash
npm start
```

Then open `http://127.0.0.1:5173` in your browser.

## Verification & Automated Tests

```bash
# Run unit, integration, and 2,000-minion performance tests
npm test

# Run headless Chromium Playwright visual QA & screenshot capture
npm run qa
```
