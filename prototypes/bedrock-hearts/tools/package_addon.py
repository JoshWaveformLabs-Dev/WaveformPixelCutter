"""Build or verify the two nested Bedrock pack archives."""
import argparse
import io
import json
from pathlib import Path
import struct
import uuid
import zipfile

ROOT = Path(__file__).resolve().parents[1]
ARTIFACT = ROOT / "dist/hearts-probe.mcaddon"
ENGINE = [1, 26, 60]
SERVER = "2.11.0"
ITEM = "items/hearts_probe.json"
ATLAS = "textures/item_texture.json"
ICON = "textures/items/hearts_probe.png"
ENTRY = "scripts/main.js"


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
    behavior = source_files("behavior_pack", ["manifest.json", ITEM])
    resources = source_files("resource_pack", ["manifest.json", ATLAS, ICON])
    behavior.update({f"scripts/{name}": data for name, data in
                     source_files(".build/scripts", ["main.js", "diagnostics.js"]).items()})
    return {"hearts_probe_bp.mcpack": behavior, "hearts_probe_rp.mcpack": resources}


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

    item = json.loads(behavior[ITEM])
    require(item["format_version"] == ".".join(map(str, ENGINE)), "Wrong item format version")
    definition = item["minecraft:item"]
    require(definition["description"]["identifier"] == "waveform:hearts_probe", "Wrong item ID")
    components = definition["components"]
    require(components["minecraft:display_name"]["value"] == "Hearts Probe", "Wrong display name")
    require(components["waveform:report_attributes"] == {} and
            b'"waveform:report_attributes"' in behavior[ENTRY], "Missing item component binding")
    icon_key = components["minecraft:icon"]["textures"]["default"]
    atlas = json.loads(resources[ATLAS])
    require(atlas["texture_name"] == "atlas.items" and
            atlas["texture_data"][icon_key]["textures"] + ".png" == ICON, "Broken item texture link")
    png = resources[ICON]
    require(png.startswith(b"\x89PNG\r\n\x1a\n") and png[12:16] == b"IHDR" and
            struct.unpack(">II", png[16:24]) == (16, 16), "Expected a 16x16 PNG")


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
    validate_metadata(packs["hearts_probe_bp.mcpack"], packs["hearts_probe_rp.mcpack"])

    if not args.check:
        ARTIFACT.parent.mkdir(exist_ok=True)
        ARTIFACT.write_bytes(make_zip({name: make_zip(files) for name, files in packs.items()}))

    packaged = read_zip(ARTIFACT.read_bytes(), packs)
    for name, files in packs.items():
        require(read_zip(packaged[name], files) == files, f"Stale or invalid files in {name}")
    print(f"Validated pack JSON, UUIDs, stable API, texture links and {ARTIFACT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
