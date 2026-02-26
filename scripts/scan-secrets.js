const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const ALLOWED_FILES = new Set([
  ".env.example",
]);

const IGNORE_DIRS = new Set([
  ".git",
  "node_modules",
  ".expo",
  "dist",
  "web-build",
  "ios",
  "android",
]);

const FILE_EXT_ALLOWLIST = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".md",
  ".yml",
  ".yaml",
  ".env",
  ".example",
]);

const PATTERNS = [
  { name: "Google API key", regex: /AIza[0-9A-Za-z_-]{20,}/g },
  { name: "Google OAuth client", regex: /[0-9]{12}-[0-9A-Za-z_-]{20,}\.apps\.googleusercontent\.com/g },
  { name: "OpenAI style key", regex: /sk-[0-9A-Za-z]{20,}/g },
  { name: "AWS access key", regex: /AKIA[0-9A-Z]{16}/g },
];

function shouldScanFile(filePath) {
  const basename = path.basename(filePath);
  if (basename.startsWith(".")) {
    return basename === ".env.example";
  }
  const ext = path.extname(filePath);
  return FILE_EXT_ALLOWLIST.has(ext);
}

function walk(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    const rel = path.relative(ROOT, abs).replace(/\\/g, "/");
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      walk(abs, out);
      continue;
    }
    if (shouldScanFile(abs)) {
      out.push({ abs, rel });
    }
  }
  return out;
}

function lineFromIndex(content, index) {
  return content.slice(0, index).split(/\r?\n/).length;
}

const findings = [];
for (const file of walk(ROOT)) {
  if (ALLOWED_FILES.has(file.rel)) continue;
  let content = "";
  try {
    content = fs.readFileSync(file.abs, "utf8");
  } catch {
    continue;
  }

  for (const pattern of PATTERNS) {
    for (const match of content.matchAll(pattern.regex)) {
      findings.push({
        file: file.rel,
        line: lineFromIndex(content, match.index || 0),
        type: pattern.name,
      });
    }
  }
}

if (findings.length) {
  console.error("Potential secret(s) detected:");
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} (${finding.type})`);
  }
  process.exit(1);
}

console.log("No obvious secrets detected.");
