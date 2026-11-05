// Screenshots each assets/marketplace/html/*.html into assets/marketplace/*.png with headless Chrome
// (headless Edge exits 0 without writing the file on some machines).
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const BROWSER = [
	"C:/Program Files/Google/Chrome/Application/chrome.exe",
	"C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
].find(existsSync);
if (!BROWSER) throw new Error("Google Chrome not found");

const root = path.resolve("assets/marketplace");
const sizes = { icon: [288, 288] };

for (const file of readdirSync(path.join(root, "html")).filter((f) => f.endsWith(".html"))) {
	const name = file.replace(/\.html$/, "");
	const [w, h] = sizes[name] ?? [1920, 960];
	const out = path.join(root, `${name}.png`);
	execFileSync(BROWSER, [
		"--headless=new",
		"--disable-gpu",
		"--hide-scrollbars",
		"--force-device-scale-factor=1",
		`--user-data-dir=${path.join(os.tmpdir(), "ringreadiness-chrome")}`,
		"--no-first-run",
		`--window-size=${w},${h}`,
		`--screenshot=${out}`,
		pathToFileURL(path.join(root, "html", file)).href,
	], { stdio: "ignore" });
	console.log(`${name}.png ${w}x${h}`);
}
