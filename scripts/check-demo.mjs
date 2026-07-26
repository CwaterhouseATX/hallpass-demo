import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const failures = [];

const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
  .map(match => match[1]);

try {
  // Compilation only: verifies JavaScript syntax without running browser code.
  new Function(inlineScripts.join("\n"));
} catch (error) {
  failures.push(`JavaScript does not compile: ${error.message}`);
}

const functionNames = new Set(
  [...html.matchAll(/(?:^|\n)\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g)]
    .map(match => match[1])
);

const routeBlock = html.match(/const views=\{([\s\S]*?)\};\s*const run=/);
if (!routeBlock) {
  failures.push("Could not find the teacher-view route table.");
} else {
  const routedViews = [...routeBlock[1].matchAll(
    /([a-z]+)\s*:\s*\(\)\s*=>\s*([A-Za-z_$][\w$]*)\(v\)/g
  )];

  if (!routedViews.length) {
    failures.push("The teacher-view route table contains no recognizable routes.");
  }

  for (const [, route, functionName] of routedViews) {
    if (!functionNames.has(functionName)) {
      failures.push(`Route "${route}" references missing function ${functionName}().`);
    }
  }
}

const mockStart = html.indexOf("const Mock = {");
const mockEnd = html.indexOf("API LAYER", mockStart);
if (mockStart === -1 || mockEnd === -1) {
  failures.push("Could not find the mock API implementation.");
} else {
  const mockBlock = html.slice(mockStart, mockEnd);
  const calledActions = new Set(
    [...html.slice(mockEnd).matchAll(/\bapi\(\s*["']([a-z_]+)["']/g)]
      .map(match => match[1])
  );

  for (const action of calledActions) {
    const methodPattern = new RegExp(`^\\s{2}${action}\\s*\\(`, "m");
    if (!methodPattern.test(mockBlock)) {
      failures.push(`UI calls api("${action}") but Mock.${action}() is missing.`);
    }
  }
}

if (failures.length) {
  console.error("Hall Pass demo checks failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("Hall Pass demo checks passed.");
  console.log(`- ${functionNames.size} named functions`);
  console.log("- All teacher routes resolve to implemented views");
  console.log("- All explicit UI API calls have mock implementations");
}
