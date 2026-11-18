import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const script = fileURLToPath(new URL("./package_addon.py", import.meta.url))
const python = process.platform === "win32" ? "python" : "python3"
execFileSync(python, [script, ...process.argv.slice(2)], { stdio: "inherit" })
