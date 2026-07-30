import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("ships the complete course identity and curriculum", async () => {
  const [layout, course, data] = await Promise.all([
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/course-app.tsx", root), "utf8"),
    readFile(new URL("app/course-data.ts", root), "utf8"),
  ]);

  assert.match(layout, /Collective Systems Lab/);
  assert.doesNotMatch(layout, /Starter Project|codex-preview/);
  assert.match(course, /Collective animator/);
  assert.match(course, /Performance model/);
  assert.match(course, /Topology explorer/);
  assert.match(course, /Training timeline/);
  assert.match(data, /number:\s*46/);
  assert.match(data, /NCCL Topology Discovery/);
  assert.match(data, /KV Cache Transfer/);
  assert.match(data, /Simulating 1,024 GPUs/);
});

test("the starter preview was completely removed", async () => {
  const [page, pkg] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
  ]);
  assert.doesNotMatch(page, /SkeletonPreview|codex-preview/);
  assert.doesNotMatch(pkg, /react-loading-skeleton/);
});
