import { readFileSync, readdirSync } from "fs";
import { extname, join } from "path";

const extensions = [".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".css", ".scss", ".html", ".txt", ".sql", ".csv", ".yml", ".yaml", ".toml"];

function scanDir(dir, files = []) {
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith(".") && entry.name !== "node_modules" && entry.name !== ".next" && entry.name !== ".vercel" && entry.name !== "dist" && entry.name !== "build") {
          scanDir(p, files);
        }
      } else if (entry.isFile() && extensions.includes(extname(entry.name))) {
        files.push(p);
      }
    }
  } catch {}
  return files;
}

const root = "C:\\Users\\jadav\\Zertech";
const files = scanDir(root).filter(f => !f.includes("node_modules") && !f.includes(".next") && !f.includes(".vercel") && !f.includes("fix-mojibake"));
console.log("Scanning " + files.length + " files for mojibake...");

const mojibakePatterns = [
  { char: "\u00e2\u20ac\u00a6", name: "triple-byte mojibake (ellipsis/etc)" },
  { char: "\u00e2\u20ac\u201d", name: "â€"/" (em dash)" },
  { char: "\u00e2\u20ac\u201c", name: "â€"/" (en dash)" },
  { char: "\u00e2\u20ac\u00a2", name: "â€¢ (bullet)" },
  { char: "\u00e2\u2020\u2019", name: "â†\\' (arrow)" },
  { char: "\u00e2\u0082\u00ac", name: "â‚¬ (euro)" },
  { char: "\u00c2\u00b7", name: "Â· (middle dot)" },
  { char: "\u00c3\u0097", name: "Ã— (multiply)" },
  { char: "\u00c2\u00a9", name: "Â© (copyright)" },
  { char: "\u00c2\u00ae", name: "Â® (registered)" },
  { char: "\u00c2\u00b0", name: "Â° (degree)" },
];

let found = false;
for (const f of files) {
  try {
    const content = readFileSync(f, "utf8");
    for (const pattern of mojibakePatterns) {
      if (content.includes(pattern.char)) {
        if (!found) { found = true; console.log("Remaining mojibake found:"); }
        console.log("  " + f + " -> " + pattern.name);
        break;
      }
    }
  } catch {}
}

if (!found) console.log("No mojibake found in any file. All clean!");
