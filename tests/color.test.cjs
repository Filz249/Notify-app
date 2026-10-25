const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const api = {};
const source = fs.readFileSync(path.join(__dirname, "../src/color.ts"), "utf8");
vm.runInNewContext(
  ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  { exports: api },
);

test("custom and preset hex colors survive conversion without changing their shade", () => {
  for (const hex of [
    "#000000",
    "#FFFFFF",
    "#808080",
    "#FF0000",
    "#00FF00",
    "#0000FF",
    "#62D2C1",
    "#F2B23D",
    "#F5EBDD",
    "#E77C70",
    "#B49ADF",
  ]) {
    assert.equal(api.hsvToHex(api.hexToHsv(hex)), hex);
  }
});

test("wheel positions cover hues and saturation, with dragging beyond the rim clamped", () => {
  assert.equal(api.hsvToHex(api.wheelColor(100, 100, 200, 1)), "#FFFFFF");
  assert.equal(api.hsvToHex(api.wheelColor(200, 100, 200, 1)), "#FF0000");
  assert.equal(api.hsvToHex(api.wheelColor(0, 100, 200, 1)), "#00FFFF");
  assert.equal(api.hsvToHex(api.wheelColor(400, 100, 200, 1)), "#FF0000");
  assert.equal(api.wheelColor(150, 100, 200, 1).s, 0.5);
});

test("brightness reaches black and hue wraps around the wheel", () => {
  assert.equal(api.hsvToHex({ h: 170, s: 0.7, v: 0 }), "#000000");
  assert.equal(api.hsvToHex({ h: 360, s: 1, v: 1 }), "#FF0000");
  assert.equal(api.hsvToHex({ h: -120, s: 1, v: 1 }), "#0000FF");
});
