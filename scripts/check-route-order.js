#!/usr/bin/env node
/**
 * check-route-order.js ? ????????
 * 
 * ?? ctx.Route() ??????????? /video/:page?
 * ????????? /video/create????
 * 
 * ??: node scripts/check-route-order.js [packages/]
 */

const fs = require("fs");
const path = require("path");

const TARGET_DIR = process.argv[2] || "packages";
const FAILURES = [];

/**
 * ?????????????????
 * ?? "/video/:page/detail/:id" -> [{seg:"video", param:false}, {seg:":page", param:true}, ...]
 */
function parseSegments(routePath) {
    return routePath.split("/").filter(Boolean).map(seg => ({
        seg,
        isParam: seg.startsWith(":"),
    }));
}

/**
 * ??????????????????????
 * 
 * ??????????? /video??????????
 *   - ????? N ??????"create"
 *   - ????? N ???":page"
 * ?????????????????
 */
function checkGroup(routes) {
    const errors = [];

    for (let i = 0; i < routes.length; i++) {
        for (let j = i + 1; j < routes.length; j++) {
            const a = routes[i];
            const b = routes[j];
            const aSegs = parseSegments(a.path);
            const bSegs = parseSegments(b.path);

            // ?????????
            const minLen = Math.min(aSegs.length, bSegs.length);
            for (let k = 0; k < minLen; k++) {
                if (aSegs[k].seg !== bSegs[k].seg) {
                    // a ????????b ???????????
                    // ?? a ???????b ?????? ? ??????????
                    if (aSegs[k].isParam && !bSegs[k].isParam) {
                        errors.push(
                            `??????: "${a.path}" (? ${a.line}) ? "${b.path}" (? ${b.line}) ?????` +
                            `? "${a.path}" ?? ${k + 1} ?????????? "${b.path}" ??????` +
                            `\n  ??: ? "${b.path}" ? ctx.Route() ?? "${a.path}" ???`
                        );
                    }
                    break;
                }
            }

            // ???????????????????????????????
            // ?? /video/:page vs /video/detail/:vid ? ??????
        }
    }

    return errors;
}

/**
 * ???????? ctx.Route() ??
 */
function extractRoutes(filePath, content) {
    const routes = [];
    const lines = content.split("\n");
    const regex = /ctx\.Route\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]/g;

    for (let i = 0; i < lines.length; i++) {
        let match;
        const lineRegex = new RegExp(regex.source, "g");
        while ((match = lineRegex.exec(lines[i])) !== null) {
            routes.push({
                name: match[1],
                path: match[2],
                line: i + 1,
            });
        }
    }

    return routes;
}

/**
 * ???????? .ts ??
 */
function* walkDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== ".cache") {
            yield* walkDir(fullPath);
        } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
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

for (const filePath of walkDir(baseDir)) {
    const content = fs.readFileSync(filePath, "utf-8");

    // ???? ctx.Route ???
    if (!content.includes("ctx.Route")) continue;

    const routes = extractRoutes(filePath, content);
    if (routes.length < 2) continue;

    // ???????
    const groups = {};
    for (const r of routes) {
        const prefix = r.path.split("/").slice(0, 2).join("/"); // e.g. "/video"
        if (!groups[prefix]) groups[prefix] = [];
        groups[prefix].push(r);
    }

    for (const [prefix, groupRoutes] of Object.entries(groups)) {
        if (groupRoutes.length < 2) continue;
        const errors = checkGroup(groupRoutes);
        for (const err of errors) {
            FAILURES.push({ file: path.relative(process.cwd(), filePath), error: err });
        }
    }
}

// --- Report ---
if (FAILURES.length === 0) {
    console.log("? ??????????");
    process.exit(0);
} else {
    console.log(`? ?? ${FAILURES.length} ???????:\n`);
    for (const { file, error } of FAILURES) {
        console.log(`?? ${file}`);
        console.log(`   ${error}\n`);
    }
    process.exit(1);
}
