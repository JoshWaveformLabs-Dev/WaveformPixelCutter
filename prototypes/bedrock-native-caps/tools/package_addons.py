"""Build or verify two separate, deterministic Bedrock diagnostic add-ons."""
import argparse
from hashlib import sha256
import io
import json
from pathlib import Path
import uuid
import zipfile

ROOT = Path(__file__).resolve().parents[1]
ENGINE = [1, 26, 60]
SERVER = "2.11.0"
VERSION = [0, 1, 0]
BASELINE_SHA = "91d833706b33477293053921af7604c29c687b33e7064130342b37e3b6614434"
ENTRY = "scripts/main.js"
PROBE = "scripts/probe.js"
PACKS = {
    "health": {
        "caps": [20, 18, 19, 10, 2],
        "component": "minecraft:health",
        "uuids": [
            "e9803385-9a5d-4063-a0e4-9e98d0856510",
            "a017e39c-1c98-416a-ab49-386e0f6ee96e",
            "82f9b759-7eaa-4e0c-b81a-8201beb286cb",
        ],
    },
    "hunger": {
        "caps": [20, 18, 10, 6, 2],
        "component": "minecraft:player.hunger",
        "uuids": [
            "cf208092-e90a-4b7d-8b55-83f7af6ecc73",
            "00ede3ca-1b9b-46d2-a541-9733e4c8de46",
            "d1663042-5d37-4759-a7eb-29b1759683e1",
        ],
    },
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def json_bytes(data):
    return (json.dumps(data, indent=2) + "\n").encode()


def group_name(namespace, cap):
    return f"{namespace}:max_{cap}"


def group_action(operation, groups):
    return {operation: {"component_groups": groups}}


def create_player(baseline, namespace, caps, component):
    player = json.loads(baseline)
    entity = player["minecraft:entity"]
    groups = [group_name(namespace, cap) for cap in caps]
    for cap, group in zip(caps, groups, strict=True):
        entity["component_groups"][group] = {component: {"value": cap, "max": cap}}
        entity["events"][f"{namespace}:cap_{cap}"] = {"sequence": [
            group_action("remove", [other for other in groups if other != group]),
            group_action("add", [group]),
        ]}
    entity["events"][f"{namespace}:reset"] = group_action("remove", groups)
    return json_bytes(player)


def manifest(stat, ids):
    header_id, data_id, script_id = ids
    return {
        "format_version": 2,
        "header": {
            "name": f"Native {stat.title()} Probe",
            "description": f"Retail 26.60 {stat} cap experiment. Use alone in a disposable world.",
            "uuid": header_id,
            "version": VERSION,
            "min_engine_version": ENGINE,
        },
        "modules": [
            {"type": "data", "uuid": data_id, "version": VERSION},
            {"type": "script", "language": "javascript", "entry": ENTRY,
             "uuid": script_id, "version": VERSION},
        ],
        "dependencies": [{"module_name": "@minecraft/server", "version": SERVER}],
    }


def validate_player(payload, baseline, namespace, caps, component):
    player = json.loads(payload)
    entity = player["minecraft:entity"]
    expected_groups = {f"{namespace}:max_{cap}": cap for cap in caps}
    for group, cap in expected_groups.items():
        require(entity["component_groups"].pop(group) == {component: {"max": cap, "value": cap}},
                f"Wrong attribute values for {group}")
        event = entity["events"].pop(f"{namespace}:cap_{cap}")["sequence"]
        require(len(event) == 2 and event[1] == {"add": {"component_groups": [group]}},
                f"Missing exclusive activation for {group}")
        removed = event[0]["remove"]["component_groups"]
        require(len(removed) == len(caps) - 1 and set(removed) == expected_groups.keys() - {group},
                f"Wrong groups removed for {group}")

    removed = entity["events"].pop(f"{namespace}:reset")["remove"]["component_groups"]
    require(len(removed) == len(caps) and set(removed) == expected_groups.keys(),
            f"Wrong reset groups for {namespace}")
    require(player == json.loads(baseline), "Non-experimental player definition changed")


def make_zip(files):
    payload = io.BytesIO()
    with zipfile.ZipFile(payload, "w") as archive:
        for name, contents in sorted(files.items()):
            entry = zipfile.ZipInfo(name)
            entry.create_system = 3
            entry.external_attr = 0o100644 << 16
            archive.writestr(entry, contents, compress_type=zipfile.ZIP_DEFLATED)
    return payload.getvalue()


def read_zip(payload, names):
    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        require(sorted(archive.namelist()) == sorted(names), "Unexpected archive entries")
        require(archive.testzip() is None, "Archive CRC check failed")
        return {name: archive.read(name) for name in names}


def validate_versions_and_ids():
    package = json.loads((ROOT / "package.json").read_bytes())
    lock = json.loads((ROOT / "package-lock.json").read_bytes())
    require(package["devDependencies"]["@minecraft/server"] == SERVER and
            lock["packages"]["node_modules/@minecraft/server"]["version"] == SERVER,
            "Manifest dependency and API declarations must match")
    live = ROOT.parent / "bedrock-hearts"
    live_ids = set()
    for path in (live / "behavior_pack/manifest.json", live / "resource_pack/manifest.json"):
        metadata = json.loads(path.read_bytes())
        live_ids.update(part["uuid"] for part in [metadata["header"], *metadata["modules"]])
    ids = [value for config in PACKS.values() for value in config["uuids"]]
    require(len(set(ids)) == 6 and not live_ids.intersection(ids) and
            all(str(uuid.UUID(value, version=4)) == value for value in ids),
            "Probe UUIDs must be distinct v4 UUIDs and separate from Hearts & Lives")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Verify the checked-in add-ons")
    args = parser.parse_args()

    baseline = (ROOT / "vendor/player.json").read_bytes()
    require(sha256(baseline).hexdigest() == BASELINE_SHA, "Mojang baseline checksum changed")
    compiled = (ROOT / ".build" / PROBE).read_bytes()
    validate_versions_and_ids()

    for stat, config in PACKS.items():
        namespace = f"native{stat}"
        caps = config["caps"]
        component = config["component"]
        player = create_player(baseline, namespace, caps, component)
        settings = json.dumps({"namespace": namespace, "stat": stat, "caps": caps})
        files = {
            "manifest.json": json_bytes(manifest(stat, config["uuids"])),
            "entities/player.json": player,
            ENTRY: f'import {{ installProbe }} from "./probe.js";\ninstallProbe({settings});\n'.encode(),
            PROBE: compiled,
        }

        artifact = ROOT / f"dist/native-{stat}.mcaddon"
        pack_name = f"native-{stat}.mcpack"
        if not args.check:
            artifact.parent.mkdir(exist_ok=True)
            artifact.write_bytes(make_zip({pack_name: make_zip(files)}))
        packed = read_zip(read_zip(artifact.read_bytes(), [pack_name])[pack_name], files)
        validate_player(packed["entities/player.json"], baseline, namespace, caps, component)
        require(packed == files, f"Stale or invalid build contents in {pack_name}")
        print(f"Validated {artifact.relative_to(ROOT)} (baseline, isolated override, events, manifest, ZIP CRC and payload)")


if __name__ == "__main__":
    main()
