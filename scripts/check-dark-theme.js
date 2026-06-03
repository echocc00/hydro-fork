#!/usr/bin/env node
/**
 * check-dark-theme.js ? ????????
 * 
 * ???? .styl ???? background-color / background ??????
 * ?? dark.styl ??????? .theme--dark ???
 * 
 * ??: node scripts/check-dark-theme.js [packages/]
 */

const fs = require("fs");
const path = require("path");

const TARGET_DIR = process.argv[2] || "packages";

// ??/??????HEX, rgb, rgba, hsl ??
const LIGHT_COLOR_PATTERNS = [
    /#(fff|FFF|f[8-9a-fA-F]|e[0-9a-fA-F]|d[0-9a-fA-F]|c[0-9a-fA-F])\b/i, // #fff, #f8f8f8, #eee, etc
    /rgba?\s*\(\s*(2[0-4]\d|25[0-5]|1\d{2}|[2-9]\d)\s*,\s*(2[0-4]\d|25[0-5]|1\d{2}|[2-9]\d)/, // rgb(200+, 200+, ...)
    /white/i,
    /#ffffff/i,
    /background-color\s*:\s*[^;]*?(?:#e[e-f]|#f[0-9a-f]|white|rgb\(\s*2[0-4])/i,
];

const LIGHT_BG_PATTERN = /(?:^|\s|\/\/|\.)([\w.-]+)\s*\{[^}]*?background(?:-color)?\s*:\s*([^;}]+)/gi;

function isLightColor(colorValue) {
    const trimmed = colorValue.trim().toLowerCase();
    if (/^#fff\b|^#ffffff\b|white/.test(trimmed)) return true;
    if (/^#f[0-9a-f]{2}/i.test(trimmed)) return true; // #f0f0f0, #fafafa, etc
    if (/^#e[0-9a-f]{2}/i.test(trimmed)) return true; // #eee, #e8e8e8, etc
    const rgb = trimmed.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (rgb) {
        const r = parseInt(rgb[1]), g = parseInt(rgb[2]), b = parseInt(rgb[3]);
        return r > 200 && g > 200 && b > 200;
    }
    return false;
}

function* walkDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== ".cache") {
            yield* walkDir(fullPath);
        } else if (entry.isFile() && entry.name.endsWith(".styl")) {
            yield fullPath;
        }
    }
}

// --- Main ---
const baseDir = path.resolve(TARGET_DIR);
if (!fs.existsSync(baseDir)) {
    console.error(`?????: ${baseDir}`);
    process.exit(1);
}

console.log(`????????: ${baseDir}\n`);

let totalLightDeclarations = 0;
let darkOverrideCount = 0;
const issues = [];

// 1. ??? dark.styl??? .theme--dark ?????
const darkStylFiles = [];
for (const f of walkDir(baseDir)) {
    if (f.includes("dark.styl") || f.includes("dark-theme") || f.includes("theme-dark")) {
        darkStylFiles.push(f);
    }
}

const darkSelectors = new Set();
for (const darkFile of darkStylFiles) {
    const content = fs.readFileSync(darkFile, "utf-8");
    // ?? .theme--dark ???????????????
    const selectorRegex = /^(\s*)([.#][\w-]+(?:\s*[,>~+]\s*[.#][\w-]+)*)/gm;
    let match;
    while ((match = selectorRegex.exec(content)) !== null) {
        const indent = match[1].length;
        const selector = match[2].trim();
        if (indent > 0) { // ? .theme--dark ??
            darkSelectors.add(selector);
        }
    }
}

darkOverrideCount = darkSelectors.size;
console.log(`dark.styl ??? ${darkOverrideCount} ??????\n`);

// 2. ???? .styl ??????????
for (const filePath of walkDir(baseDir)) {
    // ?? dark.styl ??
    if (filePath.includes("dark.styl") || filePath.includes("dark-theme")) continue;

    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    let currentSelector = "";
    let braceDepth = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith("//")) continue;

        // Track selector context (simplified)
        const selectorMatch = line.match(/^([.#][\w-]+(?:\s*[,\s>~+]\s*[.#][\w-]+)*)\s*\{?/);
        if (selectorMatch && !line.includes(":")) {
            currentSelector = selectorMatch[1].trim();
        }

        // Check for background-color with light value
        const bgMatch = line.match(/background(?:-color)?\s*:\s*(.+?)(?:;|\s*$)/);
        if (bgMatch && isLightColor(bgMatch[1])) {
            totalLightDeclarations++;
            const selector = currentSelector || "(unknown)";

            // Check if dark.styl has this selector
            if (!darkSelectors.has(selector) && selector !== "(unknown)") {
                issues.push({
                    file: path.relative(process.cwd(), filePath),
                    line: i + 1,
                    selector,
                    color: bgMatch[1].trim(),
                });
            }
        }
    }
}

// --- Report ---
console.log(`????:`);
console.log(`  ?? background-color ??: ${totalLightDeclarations}`);
console.log(`  dark.styl ?????: ${darkOverrideCount}`);
console.log(`  ?????????: ${issues.length}\n`);

if (issues.length === 0) {
    console.log("? ??????????");
    process.exit(0);
} else {
    console.log("??  ?????? .theme--dark ??:\n");
    for (const { file, line, selector, color } of issues.slice(0, 20)) {
        console.log(`  ${file}:${line}  ${selector} { background-color: ${color} }`);
    }
    if (issues.length > 20) {
        console.log(`  ... ?? ${issues.length - 20} ?`);
    }
    console.log(`\n  ??: ? theme/dark.styl ????????? .theme--dark ??`);
    
    // ?????????
    console.log(`\n??  ${issues.length} ????????? (?????)`);
    // exit 0 ? ??????
    process.exit(0);
}
