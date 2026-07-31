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
  assert.match(course, /new URLSearchParams\(window\.location\.search\)/);
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

test("lesson one teaches allreduce from an exact numerical training example", async () => {
  const lesson = await readFile(new URL("app/lesson-one.tsx", root), "utf8");

  assert.match(lesson, /Why does distributed training need collective communication/);
  assert.match(lesson, /gradient = \(prediction − target\) × x/);
  assert.match(lesson, /GPU0.*−2/s);
  assert.match(lesson, /GPU3.*−32/s);
  assert.match(lesson, /sum = −2 \+ \(−8\) \+ \(−18\) \+ \(−32\)/);
  assert.match(lesson, /average = −60 \/ 4 = −15/);
  assert.match(lesson, /replicas have diverged/);
  assert.match(lesson, /Combine values using an operator such as SUM/);
  assert.match(lesson, /Deliver the combined result to every participating rank/);
  assert.match(lesson, /local_gradients/);

  const chapterCount = lesson.match(/<Chapter number=/g)?.length ?? 0;
  assert.ok(chapterCount >= 15, `expected at least 15 chapters, found ${chapterCount}`);
});
