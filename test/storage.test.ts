import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { SvgCodec } from "../src/infrastructure/SvgCodec";
import { SvgFileStore } from "../src/infrastructure/SvgFileStore";
import { Document } from "../src/domain/Document";
import { ShapeFactory } from "../src/domain/ShapeFactory";

test("roundtrip all six types, nested parents, escaped text and viewBox", () => {
  const factory = new ShapeFactory(), doc = new Document(400, 300), codec = new SvgCodec();
  doc.setViewBox("0 0 200 150"); doc.add(factory.create("g", "outer", []));
  for (const [type, args] of [["rect", ["1", "2", "3", "4", "red"]], ["circle", ["1", "2", "3"]],
    ["ellipse", ["1", "2", "3", "4"]], ["line", ["1", "2", "3", "4", "black"]],
    ["text", ["1", "2", "中文 & <SVG>\r\n\t"]]] as const) doc.add(factory.create(type, type, args), "outer");
  const svg = doc.toSvg(), loaded = codec.parse(svg);
  assert.equal(loaded.document.toSvg(), svg); assert.deepEqual(loaded.warnings, []);
  assert.equal(loaded.document.find("text").attribute("text"), "中文 & <SVG>\r\n\t");
});

test("anonymous IDs use tag counters, avoid later explicit IDs and warn", () => {
  const result = new SvgCodec().parse('<svg><rect width="1" height="1"/><circle r="1"/><rect id="rect1" width="2" height="2"/><rect width="3" height="3"/></svg>');
  assert.deepEqual(result.document.all().map(s => s.id), ["rect2", "circle1", "rect1", "rect3"]);
  assert.deepEqual(result.warnings, ["warning: assigned id rect2 to unnamed <rect>", "warning: assigned id circle1 to unnamed <circle>", "warning: assigned id rect3 to unnamed <rect>"]);
});

test("imports course SVG transforms and text presentation without tag-based editing", () => {
  const doc = new SvgCodec().parse('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><g id="g" transform="translate(200,0) scale(0.8)"><rect id="r" x="0" y="0" width="120" height="60"/><text id="t" x="60" y="38" text-anchor="middle" font-size="16" fill="white">End</text></g></svg>').document;
  assert.match(doc.toSvg(), /transform="matrix\(0.8 0 0 0.8 200 0\)"/);
  assert.equal(doc.find("t").attribute("text-anchor"), "middle");
  const copy = new SvgCodec().parse(doc.toSvg()).document; assert.equal(copy.toSvg(), doc.toSvg());
});

test("rejects malformed XML, duplicate IDs, unsupported types and mixed namespaces", () => {
  for (const source of ['<svg>', '<svg><circle id="a" r="1"/><circle id="a" r="1"/></svg>', '<html/>',
    '<svg><path d="M0 0"/></svg>', '<svg><text id="t"><tspan>x</tspan></text></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><circle xmlns="" r="1"/></svg>',
    '<svg><circle r="NaN"/></svg>', '<svg><circle r="1"/>stray</svg>',
    '<!DOCTYPE svg [<!ENTITY x "boom">]><svg/>', '<svg><script>x</script></svg>', '<svg width="50%"/>']) {
    assert.throws(() => new SvgCodec().parse(source), Error, source);
  }
});

test("text-only whitespace survives serialization and import accepts comments and px", () => {
  const codec = new SvgCodec(); const doc = codec.parse('<svg width="100px" height="20px"><!-- comment --><text id="t">  \t </text><rect id="r" width="5px" height="6px" rx="2"/></svg>').document;
  assert.deepEqual(doc.size, [100, 20]); assert.equal(doc.find("r").attribute("ry"), "2");
  assert.equal(codec.parse(doc.toSvg()).document.find("t").attribute("text"), "  \t ");
});

test("file adapter handles UTF-8 BOM, actual files and specified file errors", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "svg-ts-files-"));
  try {
    const file = path.join(directory, "中文 文件.svg"), store = new SvgFileStore();
    fs.writeFileSync(file, '\ufeff<svg><circle id="c" r="1"/></svg>');
    const doc = store.read(file).document; store.write(file, doc);
    assert.equal(store.read(file).document.toSvg(), doc.toSvg());
    assert.throws(() => store.read(path.join(directory, "missing.svg")), /cannot read file:/);
    assert.throws(() => store.write(path.join(directory, "missing", "a.svg"), doc), /cannot write file:/);
    fs.writeFileSync(file, Buffer.from([255])); assert.throws(() => store.read(file), /UTF-8/);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test("atomic replacement failure preserves existing destination and cleans temporary file", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "svg-ts-atomic-"));
  try {
    const target = path.join(directory, "destination"); fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, "sentinel"), "keep");
    assert.throws(() => new SvgFileStore().write(target, new Document()), /cannot write file:/);
    assert.equal(fs.readFileSync(path.join(target, "sentinel"), "utf8"), "keep");
    assert.deepEqual(fs.readdirSync(directory), ["destination"]);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test("limits apply before unbounded parsing or writing", () => {
  const codec = new SvgCodec();
  assert.throws(() => codec.parse("<svg>" + "<g>".repeat(129) + "</g>".repeat(129) + "</svg>"), /limit/);
  assert.throws(() => codec.parse(" ".repeat(5 * 1024 * 1024 + 1)), /5 MiB/);
});
