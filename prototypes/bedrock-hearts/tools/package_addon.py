"""Build or verify the two nested Bedrock pack archives."""
import argparse
import io
import json
from pathlib import Path
import struct
import uuid
import zipfile

ROOT = Path(__file__).resolve().parents[1]
ARTIFACT = ROOT / "dist/hearts-and-lives-dev.mcaddon"
ENGINE = [1, 26, 60]
SERVER = "2.11.0"
ATLAS = "textures/item_texture.json"
ENTRY = "scripts/main.js"
BP = "hearts_and_lives_bp.mcpack"
RP = "hearts_and_lives_rp.mcpack"
ITEMS = {
    "hearts_probe": ("Hearts Probe", "waveform:report_attributes", ENTRY, 1),
    "artificial_heart": ("Artificial Heart", "waveform:recover_capacity", "scripts/lives-bedrock.js", 16),
    "half_artificial_heart": ("Half Artificial Heart", "waveform:recover_capacity", "scripts/lives-bedrock.js", 16),
}
RECIPES = {
    "artificial_heart": ["DND", "DHD", "DND"],
    "half_artificial_heart": ["DN", "DH", "D "],
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def source_files(directory, expected):
    root = ROOT / directory
    files = {path.relative_to(root).as_posix(): path.read_bytes()
             for path in root.rglob("*") if path.is_file()}
    require(files.keys() == set(expected), f"Unexpected payload in {directory}")
    return files


def collect_packs():
    behavior = source_files("behavior_pack", ["manifest.json",
                            *(f"items/{name}.json" for name in ITEMS),
                            *(f"recipes/{name}.json" for name in RECIPES)])
    resources = source_files("resource_pack", ["manifest.json", ATLAS,
                             *(f"textures/items/{name}.png" for name in ITEMS)])
    behavior.update({f"scripts/{name}": data for name, data in
                     source_files(".build/scripts", ["main.js", "diagnostics.js", "lives-bedrock.js",
                                  "lives-state.js", "lives-store.js", "recovery.js"]).items()})
    return {BP: behavior, RP: resources}


def validate_metadata(behavior, resources):
    behavior_manifest = json.loads(behavior["manifest.json"])
    resource_manifest = json.loads(resources["manifest.json"])
    ids = []
    for manifest, expected_types in [(behavior_manifest, {"data", "script"}),
                                     (resource_manifest, {"resources"})]:
        header = manifest["header"]
        modules = manifest["modules"]
        require(manifest["format_version"] == 2, "Use manifest format 2")
        require(header["min_engine_version"] == ENGINE, "Wrong retail baseline")
        require(header["name"] and header["description"], "Incomplete pack header")
        version = header["version"]
        require(len(version) == 3 and all(type(part) is int and part >= 0 for part in version),
                "Invalid pack version")
        require(len(modules) == len(expected_types) and
                {module["type"] for module in modules} == expected_types, "Wrong module types")
        require(all(module["version"] == version for module in modules), "Wrong module version")
        require("capabilities" not in manifest, "Unexpected manifest capabilities")
        ids.extend(section["uuid"] for section in [header, *modules])

    require(len(set(ids)) == len(ids) and all(str(uuid.UUID(value, version=4)) == value
                                              for value in ids), "Pack UUIDs must be distinct v4 UUIDs")

    script = next(module for module in behavior_manifest["modules"] if module["type"] == "script")
    require(script["language"] == "javascript" and script["entry"] == ENTRY and ENTRY in behavior,
            "Wrong script entry")
    resource_header = resource_manifest["header"]
    require(resource_header["pack_scope"] == "world", "Resource pack should attach to the world")
    require(not resource_manifest.get("dependencies"), "Unexpected resource pack dependencies")
    require(behavior_manifest["dependencies"] == [
        {"uuid": resource_header["uuid"], "version": resource_header["version"]},
        {"module_name": "@minecraft/server", "version": SERVER},
    ], "Wrong pack linkage or stable script dependency")

    package = json.loads((ROOT / "package.json").read_bytes())
    lock = json.loads((ROOT / "package-lock.json").read_bytes())
    require(package["devDependencies"]["@minecraft/server"] == SERVER and
            lock["packages"]["node_modules/@minecraft/server"]["version"] == SERVER,
            "Installed declarations must match the stable script dependency")

    atlas = json.loads(resources[ATLAS])
    require(atlas["texture_name"] == "atlas.items", "Wrong texture atlas")
    for name in ITEMS:
        validate_item(name, behavior, resources, atlas["texture_data"])
    for name, pattern in RECIPES.items():
        validate_recipe(name, pattern, behavior)


def validate_item(name, behavior, resources, textures):
    label, component, script, stack_size = ITEMS[name]
    item = json.loads(behavior[f"items/{name}.json"])
    require(item["format_version"] == ".".join(map(str, ENGINE)), "Wrong item format version")
    definition = item["minecraft:item"]
    require(definition["description"]["identifier"] == f"waveform:{name}", "Wrong item ID")
    components = definition["components"]
    require(components["minecraft:display_name"]["value"] == label, "Wrong display name")
    require(components["minecraft:max_stack_size"] == stack_size, "Wrong max stack size")
    require(components[component] == {} and f'"{component}"'.encode() in behavior[script],
            "Missing item component binding")
    require("minecraft:food" not in components, "Script must control item consumption")
    icon_key = components["minecraft:icon"]["textures"]["default"]
    icon = f"textures/items/{name}"
    require(textures[icon_key]["textures"] == icon, "Broken item texture link")
    png = resources[f"{icon}.png"]
    require(png.startswith(b"\x89PNG\r\n\x1a\n") and png[12:16] == b"IHDR" and
            struct.unpack(">II", png[16:24]) == (16, 16), "Expected a 16x16 PNG")


def validate_recipe(name, pattern, behavior):
    recipe = json.loads(behavior[f"recipes/{name}.json"])
    require(recipe["format_version"] == "1.21.20", "Wrong recipe format version")
    shaped = recipe["minecraft:recipe_shaped"]
    require(shaped["description"]["identifier"] == f"waveform:{name}", "Wrong recipe ID")
    require(shaped["tags"] == ["crafting_table"] and shaped["pattern"] == pattern,
            "Wrong crafting station or recipe pattern")
    require(shaped["key"] == {"D": {"item": "minecraft:diamond"},
                              "N": {"item": "minecraft:netherite_ingot"},
                              "H": {"item": "minecraft:heart_of_the_sea"}},
            "Wrong recipe ingredients")
    require(shaped["unlock"] == [{"item": "minecraft:diamond"}], "Wrong recipe unlock")
    require(shaped["result"] == {"item": f"waveform:{name}", "count": 1}, "Wrong recipe output")


def make_zip(files):
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        for name, contents in sorted(files.items()):
            entry = zipfile.ZipInfo(name)
            entry.create_system = 3
            entry.external_attr = 0o100644 << 16
            archive.writestr(entry, contents, compress_type=zipfile.ZIP_DEFLATED)
    return buffer.getvalue()


def read_zip(data, expected_names):
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        require(sorted(archive.namelist()) == sorted(expected_names), "Unexpected archive entries")
        require(archive.testzip() is None, "Archive CRC check failed")
        return {name: archive.read(name) for name in expected_names}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Verify the existing artifact")
    args = parser.parse_args()
    packs = collect_packs()
    validate_metadata(packs[BP], packs[RP])

    if not args.check:
        ARTIFACT.parent.mkdir(exist_ok=True)
        ARTIFACT.write_bytes(make_zip({name: make_zip(files) for name, files in packs.items()}))

    packaged = read_zip(ARTIFACT.read_bytes(), packs)
    for name, files in packs.items():
        require(read_zip(packaged[name], files) == files, f"Stale or invalid files in {name}")
    print(f"Validated pack JSON, UUIDs, stable API, textures, recipes and {ARTIFACT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
