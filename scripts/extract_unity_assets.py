#!/usr/bin/env python3
"""
Extracts 1:1 pixel-art sprites, animation sheets, fonts, and audio clips from the
unpacked Minion Colony UnityFS bundle (sharedassets0.assets + sharedassets0.resource).
"""

import json
import os
import re
import struct
import zlib

UNPACKED_DIR = "/Users/derya/.gemini/antigravity/brain/3db5a48c-3d51-4382-9d84-44badd2c7af3/scratch/media/unpacked"
UNITYFS_BIN = os.path.join(UNPACKED_DIR, "unityfs_unpacked.bin")
RESOURCE_BIN = os.path.join(UNPACKED_DIR, "sharedassets0.resource")

OUT_ROOT = "/Users/derya/Gemini-4/minion-colony-Argon/assets"
SPRITES_DIR = os.path.join(OUT_ROOT, "sprites")
SHEETS_DIR = os.path.join(OUT_ROOT, "sprites", "sheets")
FONTS_DIR = os.path.join(OUT_ROOT, "fonts")
AUDIO_DIR = os.path.join(OUT_ROOT, "audio")


def write_png_rgba(path, width, height, rgba_bottom_up):
    """Writes an RGBA32 bottom-up buffer (Unity Texture2D convention) as a standard top-down PNG."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    stride = width * 4
    raw_rows = bytearray()
    for y in range(height - 1, -1, -1):
        raw_rows.append(0)  # filter type 0 (None)
        row_start = y * stride
        raw_rows.extend(rgba_bottom_up[row_start : row_start + stride])

    def png_chunk(chunk_type, data):
        crc = zlib.crc32(chunk_type + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + chunk_type + data + struct.pack(">I", crc)

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    compressed = zlib.compress(bytes(raw_rows), 6)
    with open(path, "wb") as out:
        out.write(b"\x89PNG\r\n\x1a\n")
        out.write(png_chunk(b"IHDR", ihdr))
        out.write(png_chunk(b"IDAT", compressed))
        out.write(png_chunk(b"IEND", b""))


def crop_rgba_bottom_up(atlas_buf, atlas_w, rx, ry, rw, rh):
    """Crops a rectangle (rx, ry, rw, rh) from a bottom-up RGBA32 buffer."""
    out = bytearray(rw * rh * 4)
    atlas_stride = atlas_w * 4
    row_bytes = rw * 4
    for y in range(rh):
        src_off = (ry + y) * atlas_stride + rx * 4
        dst_off = y * row_bytes
        out[dst_off : dst_off + row_bytes] = atlas_buf[src_off : src_off + row_bytes]
    return out


def blit_rgba_bottom_up(dst_buf, dst_w, src_buf, src_w, src_h, dst_x, dst_y):
    """Blits a bottom-up RGBA32 buffer into dst_buf at (dst_x, dst_y)."""
    dst_stride = dst_w * 4
    row_bytes = src_w * 4
    for y in range(src_h):
        s_off = y * row_bytes
        d_off = (dst_y + y) * dst_stride + dst_x * 4
        dst_buf[d_off : d_off + row_bytes] = src_buf[s_off : s_off + row_bytes]


def main():
    os.makedirs(SPRITES_DIR, exist_ok=True)
    os.makedirs(SHEETS_DIR, exist_ok=True)
    os.makedirs(FONTS_DIR, exist_ok=True)
    os.makedirs(AUDIO_DIR, exist_ok=True)

    f = open(UNITYFS_BIN, "rb")
    base_sa = 7187096
    data_off_sa = 308304
    f.seek(base_sa)
    meta = f.read(data_off_sa)

    p = 48
    e = meta.find(b"\x00", p)
    p = e + 1 + 5
    num_types = struct.unpack("<i", meta[p : p + 4])[0]
    p += 4
    types = []
    for _ in range(num_types):
        cid = struct.unpack("<i", meta[p : p + 4])[0]
        p += 7
        if cid == 114:
            p += 16
        p += 16
        types.append(cid)

    num_objs = struct.unpack("<i", meta[p : p + 4])[0]
    p += 4
    objs = {}
    for _ in range(num_objs):
        p = (p + 3) & ~3
        pid, bs, bsz, tid = struct.unpack("<qQII", meta[p : p + 24])
        p += 24
        objs[pid] = (bs, bsz, types[tid])

    def read_obj(pid):
        bs, bsz, _ = objs[pid]
        f.seek(base_sa + data_off_sa + bs)
        return f.read(bsz)

    # 1. Extract Font (Yoster Island, pid=104)
    font_bytes = read_obj(104)
    ttf_start = font_bytes.find(b"\x00\x01\x00\x00")
    if ttf_start != -1:
        ttf_path = os.path.join(FONTS_DIR, "YosterIsland.ttf")
        with open(ttf_path, "wb") as wf:
            wf.write(font_bytes[ttf_start:])
        print(f"Extracted font: {ttf_path} ({len(font_bytes) - ttf_start} bytes)")

    # 2. Extract all 37 AudioClips (cid=83)
    res_bytes = open(RESOURCE_BIN, "rb").read()
    audio_manifest = {}
    for pid, (bs, bsz, cid) in sorted(objs.items()):
        if cid == 83:
            b = read_obj(pid)
            nlen = struct.unpack("<I", b[:4])[0]
            name = b[4 : 4 + nlen].decode("utf-8", "ignore").strip()
            off = (4 + nlen + 3) & ~3
            # Find 'sharedassets0.resource' string
            res_tag = b"sharedassets0.resource"
            rpos = b.find(res_tag, off)
            if rpos != -1:
                after_str = (rpos + len(res_tag) + 3) & ~3
                a_offset, a_size = struct.unpack("<QQ", b[after_str : after_str + 16])
                safe_name = re.sub(r"[^a-zA-Z0-9_\-]", "_", name).lower()
                out_file = f"{safe_name}.m4a"
                out_path = os.path.join(AUDIO_DIR, out_file)
                with open(out_path, "wb") as af:
                    af.write(res_bytes[a_offset : a_offset + a_size])
                audio_manifest[name] = f"assets/audio/{out_file}"
    with open(os.path.join(AUDIO_DIR, "audio_manifest.json"), "w") as mf:
        json.dump(audio_manifest, mf, indent=2)
    print(f"Extracted {len(audio_manifest)} audio clips.")

    # 3. Extract standalone Texture2D assets
    standalone_textures = {}
    for pid in [26, 27, 28, 31, 32, 34, 35, 36, 37, 38, 41, 42, 44, 45, 48]:
        if pid in objs:
            b = read_obj(pid)
            nlen = struct.unpack("<I", b[:4])[0]
            name = b[4 : 4 + nlen].decode("utf-8", "ignore").strip()
            off = (4 + nlen + 3) & ~3
            ints = struct.unpack("<20I", b[off : off + 80])
            w, h, img_size, _, fmt = ints[1], ints[2], ints[3], ints[4], ints[5]
            # Find where pixel data starts (last img_size bytes or before streaming info)
            # In Texture2D, pixel data starts right after the byte_size uint32 field
            # Find the uint32 equal to img_size after off+48
            data_pos = -1
            for scan in range(off + 48, off + 120, 4):
                if struct.unpack("<I", b[scan : scan + 4])[0] == img_size:
                    data_pos = scan + 4
                    break
            if data_pos != -1 and fmt == 4 and img_size == w * h * 4:
                pix = b[data_pos : data_pos + img_size]
                safe_name = re.sub(r"[^a-zA-Z0-9_\-]", "_", name).lower()
                write_png_rgba(os.path.join(SPRITES_DIR, f"tex_{safe_name}.png"), w, h, pix)
                standalone_textures[pid] = (name, w, h, pix)
                print(f"Extracted Texture2D pid={pid} '{name}' ({w}x{h})")

    # 4. Load the 8192x4096 uncompressed RGBA32 SpriteAtlas texture (pid=55)
    print("Loading 8192x4096 SpriteAtlas texture (pid=55)...")
    b55 = read_obj(55)
    nlen55 = struct.unpack("<I", b55[:4])[0]
    off55 = (4 + nlen55 + 3) & ~3
    img_size55 = 8192 * 4096 * 4
    data_pos55 = -1
    for scan in range(off55 + 48, off55 + 120, 4):
        if struct.unpack("<I", b55[scan : scan + 4])[0] == img_size55:
            data_pos55 = scan + 4
            break
    atlas_rgba = memoryview(b55)[data_pos55 : data_pos55 + img_size55]

    # Parse SpriteAtlas (pid=10934) render_data table
    sa_bytes = read_obj(10934)
    sa_off = 263932
    atlas_map = {}
    for i in range(7254):
        e = sa_bytes[sa_off + i * 108 : sa_off + (i + 1) * 108]
        key = e[:24]
        tex_fid, tex_pid, atex_fid, atex_pid = struct.unpack("<iqiq", e[24:48])
        tx, ty, tw, th, ox, oy, px, py = struct.unpack("<8f", e[48:80])
        atlas_map[key] = (tex_pid, int(round(tx)), int(round(ty)), int(round(tw)), int(round(th)), px, py)

    # Index all Sprite (cid=213) objects
    sprites_by_pid = {}
    sprites_by_name = {}
    for pid, (bs, bsz, cid) in objs.items():
        if cid == 213:
            b = read_obj(pid)
            nlen = struct.unpack("<I", b[:4])[0]
            name = b[4 : 4 + nlen].decode("utf-8", "ignore")
            off = (4 + nlen + 3) & ~3
            rx, ry, rw, rh = struct.unpack("<4f", b[off : off + 16])
            ppu = struct.unpack("<f", b[off + 40 : off + 44])[0]
            rkey = b[off + 60 : off + 84]
            am = atlas_map.get(rkey)
            info = {
                "pid": pid,
                "name": name,
                "rect": (int(round(rx)), int(round(ry)), int(round(rw)), int(round(rh))),
                "ppu": ppu,
                "atlas": am,
            }
            sprites_by_pid[pid] = info
            sprites_by_name[name] = info

    def get_sprite_rgba(info):
        am = info["atlas"]
        if am and am[0] == 55:
            _, tx, ty, tw, th, _, _ = am
            return tw, th, crop_rgba_bottom_up(atlas_rgba, 8192, tx, ty, tw, th)
        # Fallback for standalone texture sprites (Well, Water fountain, bonfire, plants, Stone structures)
        name = info["name"]
        rx, ry, rw, rh = info["rect"]
        for tpid, (tname, tw, th, tpix) in standalone_textures.items():
            if name.startswith(tname.strip()):
                return rw, rh, crop_rgba_bottom_up(tpix, tw, rx, ry, rw, rh)
        return None, None, None

    def export_single_sprite(pid_or_name, out_filename):
        info = sprites_by_pid.get(pid_or_name) if isinstance(pid_or_name, int) else sprites_by_name.get(pid_or_name)
        if not info:
            # Try prefix match
            for k, v in sprites_by_name.items():
                if k.startswith(str(pid_or_name)):
                    info = v
                    break
        if not info:
            print(f"WARNING: Sprite {pid_or_name} not found!")
            return None
        w, h, rgba = get_sprite_rgba(info)
        if rgba is None:
            print(f"WARNING: Sprite {pid_or_name} ({info['name']}) has no pixel data!")
            return None
        out_path = os.path.join(SPRITES_DIR, out_filename)
        write_png_rgba(out_path, w, h, rgba)
        return {"file": f"assets/sprites/{out_filename}", "w": w, "h": h, "name": info["name"], "pid": info["pid"]}

    # 5. Export canonical single sprites (Buildings, Resources, Weapons, Armour, Enchantments, Icons, Tiles)
    named_exports = {
        # Buildings
        "building_store_house.png": 3731,
        "building_barracks.png": 7006,
        "building_market.png": 5366,
        "building_mine.png": 3728,
        "building_farm.png": 3699,
        "building_smith.png": 3691,
        "building_smith_shadow.png": 3722,
        "building_smith_sharpening.png": 3718,
        "building_armourer.png": 3744,
        "building_armourer_workbench.png": 3732,
        "building_armourer_loom.png": 3693,
        "building_wizard_tower.png": 3700,
        # Resources
        "res_metal.png": 6184,
        "res_carrot.png": 3209,
        "res_carrot_crop.png": 3224,
        "res_golden_carrot.png": 3735,
        "res_amethyst.png": 5245,
        "res_sapphire.png": 4526,
        "res_ruby.png": 1797,
        "icon_coin.png": 3368,
        # 6 Weapons
        "weapon_copper.png": 6037,
        "weapon_iron.png": 2289,
        "weapon_gold.png": 7108,
        "weapon_platinum.png": 6229,
        "weapon_cobalt.png": 977,
        "weapon_mythril.png": 4712,
        # 6 Armours
        "armour_copper.png": 2211,
        "armour_iron.png": 3996,
        "armour_gold.png": 2224,
        "armour_cobalt.png": 4766,
        "armour_obsidian.png": 5294,
        "armour_dragonscale.png": 3161,
        # 4 Enchantment Frames
        "enchant_lifesteal.png": 5274,
        "enchant_burning_strikes.png": 6772,
        "enchant_thorns.png": 7210,
        "enchant_rend.png": 6610,
        # Minion & Enemy Icons
        "minion_icon_goblin.png": 150,
        "minion_icon_troll.png": 7112,
        "minion_icon_lightning_mage.png": 3737,
        "minion_icon_sapling.png": 3752,
        "minion_icon_cyclops.png": 6438,
        "minion_icon_demon.png": 3741,
        "minion_icon_giant.png": 2419,
        "minion_icon_priest.png": "priest-icon",
        # Decorations
        "decor_gladiolus.png": 2191,
        "decor_chrysanthemum.png": 1958,
        "decor_pillar.png": 6611,
        "decor_well.png": 1433,
        "decor_campfire.png": 6383,
        "decor_fountain.png": 5421,
        # UI Icons & Silhouettes
        "ui_icon_mine.png": 3692,
        "ui_icon_farm.png": 3738,
        "ui_icon_smith.png": 3734,
        "ui_icon_armour.png": 3750,
        "ui_icon_enchant.png": 3714,
        "ui_icon_building.png": 3742,
        "ui_icon_market.png": 1762,
        "ui_icon_worker.png": 3720,
        "ui_icon_resource.png": 3721,
        "ui_icon_weapon.png": 3713,
        "ui_icon_move.png": "move-icon",
        "ui_icon_upgrade.png": "upgrade-icon",
        "ui_icon_question.png": "question-mark-icon",
        "ui_icon_cogwheel.png": "cogwheel",
        "ui_icon_bin.png": 3703,
        "ui_icon_refresh.png": 3708,
        "ui_icon_red_x.png": 611,
        "ui_icon_swords.png": 5201,
        "ui_icon_clock.png": "clock icon",
        "ui_icon_unlock.png": "padlock-unlock",
        "ui_icon_idle.png": "idle-silhouette",
        "ui_icon_wrench.png": "wrench_white",
        "ui_panel_9slice.png": 3739,
        "ui_inventory_9slice.png": 3725,
        "ui_button.png": 5348,
        "ui_selector_box.png": 3702,
        "ui_place_guide.png": 6581,
        "ui_shadow_small.png": 2230,
        "ui_shadow_large.png": "shadow",
        "ui_healthbar_border.png": 3729,
        "ui_healthbar_fill.png": 3705,
        "ui_bubble.png": 5126,
        # Emotes (EmoteIconLookup)
        "emote_entertained.png": 3392,
        "emote_bored.png": 4105,
        "emote_commanded.png": 4972,
        "emote_battle.png": 2643,
        "emote_low_hp.png": 3105,
        # Projectiles & Beams
        "proj_arrow.png": 3733,
        "proj_fireball.png": "Fireball_Projectile_0",
        "vfx_beam.png": "beam",
        # Grass & Forest Tiles
        "tile_grass_base.png": 3291,
        "tile_grass_0.png": 4091,
        "tile_grass_1.png": 428,
        "tile_grass_2.png": 7090,
        "tile_grass_3.png": 6511,
        "tile_grass_4.png": 7383,
        "tile_grass_5.png": 4456,
        "tile_grass_6.png": 3522,
        "tile_grass_flower1.png": 2697,
        "tile_grass_flower2.png": 878,
        "tile_grass_pebble.png": 2992,
        "tile_tree_0.png": 3922,
        "tile_tree_1.png": 4438,
        "tile_tree_2.png": 2921,
        "tile_tree_3.png": 3174,
        "tile_tree_4.png": 3215,
        "tile_tree_5.png": 3163,
        "tile_tree_6.png": 3551,
        "tile_tree_7.png": 3936,
        "tile_tree_canopy.png": 4481,
    }

    manifest = {"sprites": {}, "sheets": {}, "audio": audio_manifest}
    for fname, key in named_exports.items():
        res = export_single_sprite(key, fname)
        if res:
            manifest["sprites"][fname.replace(".png", "")] = res

    # 6. Build horizontal sprite-sheet strips for all Minion, Enemy, Building, and VFX animations
    def export_strip_by_prefix(sheet_name, prefix_pattern, max_frames=16):
        matched = []
        rx_pat = re.compile(prefix_pattern)
        for sname, info in sprites_by_name.items():
            m = rx_pat.match(sname)
            if m:
                idx = int(m.group(1)) if m.groups() else 0
                matched.append((idx, sname, info))
        matched.sort(key=lambda x: x[0])
        matched = matched[:max_frames]
        if not matched:
            print(f"WARNING: No frames matched for sheet {sheet_name} ({prefix_pattern})")
            return
        frames_rgba = []
        fw, fh = 0, 0
        for _, sname, info in matched:
            w, h, rgba = get_sprite_rgba(info)
            if rgba is not None:
                fw = max(fw, w)
                fh = max(fh, h)
                frames_rgba.append((w, h, rgba))
        if not frames_rgba:
            return
        n = len(frames_rgba)
        strip_w = fw * n
        strip_h = fh
        strip_buf = bytearray(strip_w * strip_h * 4)
        for i, (w, h, rgba) in enumerate(frames_rgba):
            ox = i * fw + (fw - w) // 2
            oy = (fh - h) // 2
            blit_rgba_bottom_up(strip_buf, strip_w, rgba, w, h, ox, oy)
        out_file = f"{sheet_name}.png"
        write_png_rgba(os.path.join(SHEETS_DIR, out_file), strip_w, strip_h, strip_buf)
        manifest["sheets"][sheet_name] = {
            "file": f"assets/sprites/sheets/{out_file}",
            "frameWidth": fw,
            "frameHeight": fh,
            "frames": n,
        }
        print(f"Packed sheet '{sheet_name}': {n} frames ({fw}x{fh})")

    # Character & VFX animation sheets
    sheet_specs = [
        # Goblin
        ("goblin_idle", r"^GoblinIdle_(\d+)$", 8),
        ("goblin_walk", r"^GoblinWalk_(\d+)$", 8),
        ("goblin_attack", r"^GoblinAttack_(\d+)$", 8),
        ("goblin_die", r"^GoblinSpinDie_(\d+)$", 12),
        # Troll
        ("troll_idle", r"^TrollIdle_y0_x(\d+)$", 8),
        ("troll_walk", r"^TrollWalk_y0_x(\d+)$", 6),
        ("troll_attack", r"^TrollAttack_y0_x(\d+)$", 4),
        ("troll_die", r"^TrollDie_y0_x(\d+)$", 10),
        # Skeleton Sorcerer (LightningMage)
        ("lightning_mage_idle", r"^Wizard_Idle_y0_x(\d+)$", 8),
        ("lightning_mage_walk", r"^Wizard_Walk_y0_x(\d+)$", 4),
        ("lightning_mage_attack", r"^Wizard_Summon_Fire_Familiar_y0_x(\d+)$", 8),
        ("lightning_mage_die", r"^Wizard_Die_y0_x(\d+)$", 10),
        # Sapling (Oak)
        ("sapling_idle", r"^Oak_Idle_(\d+)$", 8),
        ("sapling_walk", r"^Oak_Walk_(\d+)$", 8),
        ("sapling_attack", r"^Oak_Heal_(\d+)$", 8),
        ("sapling_die", r"^Oak_Die_(\d+)$", 8),
        # Cyclops
        ("cyclops_idle", r"^CyclopIdle_(\d+)$", 8),
        ("cyclops_walk", r"^CyclopWalk_(\d+)$", 6),
        ("cyclops_attack", r"^CyclopIdle_(\d+)$", 8),
        ("cyclops_die", r"^CyclopDie_(\d+)$", 10),
        # Demon
        ("demon_idle", r"^Idle_(\d+)$", 8),
        ("demon_walk", r"^Walk_(\d+)$", 6),
        ("demon_attack", r"^Cast_(\d+)$", 6),
        ("demon_die", r"^Die_(\d+)$", 10),
        # Giant
        ("giant_idle", r"^GiantIdle_y0_x(\d+)$", 8),
        ("giant_walk", r"^GiantWalk_y0_x(\d+)$", 8),
        ("giant_attack", r"^GiantAttack_y0_x(\d+)$", 8),
        ("giant_die", r"^GiantDie_y0_x(\d+)$", 12),
        ("giant_shockwave", r"^GiantAttackEffect_y0_x(\d+)$", 8),
        # Enemy Fighter (Warrior)
        ("fighter_idle", r"^Figther_Idle_y0_x(\d+)$", 8),
        ("fighter_walk", r"^Figther_walk_y0_x(\d+)$", 4),
        ("fighter_attack", r"^Figther_Attack_y0_x(\d+)$", 4),
        ("fighter_die", r"^Figther_Die_y0_x(\d+)$", 10),
        # Enemy Ranger (Archer)
        ("ranger_idle", r"^Ranger_Idle_(\d+)$", 8),
        ("ranger_walk", r"^Ranger_walk_(\d+)$", 8),
        ("ranger_attack", r"^Ranger_SingleShot_Orthogonal_(\d+)$", 10),
        ("ranger_die", r"^Ranger_Die_(\d+)$", 10),
        # Enemy BlueMage
        ("blue_mage_idle", r"^Blue_Wizard_Idle_y0_x(\d+)$", 8),
        ("blue_mage_walk", r"^blue_#Wizard_Walk_y0_x(\d+)$", 4),
        ("blue_mage_attack", r"^Blue_Wizard_Summon_Fire_Familiar_y0_x(\d+)$", 8),
        ("blue_mage_die", r"^Blue_Wizard_Die_y0_x(\d+)$", 10),
        # Enemy Priest (Cleric)
        ("priest_idle", r"^ClericIdle_y0_x(\d+)$", 8),
        ("priest_walk", r"^ClericWalk_y0_x(\d+)$", 4),
        ("priest_attack", r"^_ClericPray_y0_x(\d+)$", 8),
        ("priest_die", r"^ClericDie_y0_x(\d+)$", 10),
        # Building & Decor Props
        ("prop_furnace", r"^Furnace_(\d+)$", 10),
        ("prop_anvil", r"^Anvil_(\d+)$", 8),
        ("prop_bonfire", r"^bonfire_(\d+)$", 6),
        ("prop_fountain", r"^Water fountain_(\d+)$", 4),
        # Combat & World VFX
        ("vfx_hitspark", r"^hitspark_(\d+)$", 5),
        ("vfx_lightning", r"^lightning_(\d+)$", 4),
        ("vfx_meteor", r"^meteor_1_orange_(\d+)$", 6),
        ("vfx_meteor_exp", r"^meteor_exp_1_orange_(\d+)$", 5),
        ("vfx_burst_fire", r"^Burst_Fire_(\d+)$", 10),
        ("vfx_small_flame", r"^small_flame_(\d+)$", 6),
        ("vfx_smoke_place", r"^Free Smoke Fx  Pixel 06_(\d+)$", 10),
        ("vfx_smoke_sell", r"^Free Smoke Fx  Pixel 07_(\d+)$", 10),
    ]

    for sname, pat, maxf in sheet_specs:
        export_strip_by_prefix(sname, pat, maxf)

    manifest_path = os.path.join(OUT_ROOT, "asset_manifest.json")
    with open(manifest_path, "w") as mf:
        json.dump(manifest, mf, indent=2)
    print(f"Saved asset manifest to {manifest_path}")


if __name__ == "__main__":
    main()
