import test from "node:test";
import assert from "node:assert/strict";
import { Cli } from "../src/cli/Cli";
import { DocumentSession } from "../src/application/DocumentSession";
import { SvgCodec } from "../src/infrastructure/SvgCodec";
import { ShapeFactory } from "../src/domain/ShapeFactory";
import { EditorError } from "../src/domain/EditorError";
import { MemoryStore } from "./helpers/MemoryStore";

test("each leaf moves and scales every specified geometry field, preserving its paint", () => {
  const factory = new ShapeFactory();
  const cases: readonly [string, readonly string[], Record<string, string>][] = [
    ["rect", ["10", "20", "30", "40"], { x: "6", y: "8.5", width: "15", height: "20" }],
    ["circle", ["10", "20", "30"], { cx: "6", cy: "8.5", r: "15" }],
    ["ellipse", ["10", "20", "30", "40"], { cx: "6", cy: "8.5", rx: "15", ry: "20" }],
    ["line", ["10", "20", "30", "40"], { x1: "6", y1: "8.5", x2: "16", y2: "18.5" }],
    ["text", ["10", "20", "内容 & <SVG>"], { x: "6", y: "8.5", text: "内容 & <SVG>" }],
  ];
  for (const [type, args, expected] of cases) {
    const shape = factory.create(type, "item", args);
    shape.set("fill", "red"); shape.set("stroke", "blue"); shape.set("stroke-width", "3");
    shape.move(2, -3); shape.scale(0.5);
    for (const [key, value] of Object.entries(expected)) assert.equal(shape.attribute(key), value, `${type}.${key}`);
    assert.equal(shape.attribute("fill"), "red"); assert.equal(shape.attribute("stroke-width"), "3");
    for (const key of Object.keys(expected)) {
      shape.set(key, key === "text" ? "新内容" : "7");
      assert.equal(shape.attribute(key), key === "text" ? "新内容" : "7");
    }
  }
});

test("deleting a nested group removes its whole subtree and undo restores ownership and order", () => {
  const session = new DocumentSession(new MemoryStore()), cli = new Cli(session);
  for (const line of ["init", "create g scene", "create g node in scene", "create g detail in node",
    "create rect body 1 2 30 40 in node", 'create text label 2 3 "开始" in detail',
    "create circle after 0 0 1 in scene"]) cli.execute(line);
  const before = session.requireDocument().toSvg();
  cli.execute("delete node");
  assert.deepEqual(session.requireDocument().all().map(shape => shape.id), ["scene", "after"]);
  cli.execute("undo"); assert.equal(session.requireDocument().toSvg(), before);
  assert.equal(session.requireDocument().find("label").parent?.label, "g#detail");
  cli.execute("redo"); cli.execute("create g node in scene");
  assert.throws(() => cli.execute("redo"), /nothing to redo/);
  assert.deepEqual(session.requireDocument().container("scene").children.map(shape => shape.id), ["after", "node"]);
});

test("nested ungroup preserves inherited paint, relative weight and composed transforms across undo", () => {
  const codec = new SvgCodec(), store = new MemoryStore();
  store.put("styled.svg", codec.parse('<svg><g id="outer" font-weight="100"><g id="inner" fill="red" font-weight="bolder" transform="translate(10,20)">' +
    '<text id="label" font-weight="bolder" transform="scale(2)">标题</text><circle id="dot" fill="blue" r="3"/></g></g></svg>').document);
  const session = new DocumentSession(store), cli = new Cli(session); cli.execute("read styled.svg");
  const before = session.requireDocument().toSvg(); cli.execute("ungroup inner");
  const label = session.requireDocument().find("label");
  assert.equal(label.parent?.label, "g#outer"); assert.equal(label.attribute("font-weight"), "700");
  assert.equal(label.attribute("fill"), "red"); assert.equal(session.requireDocument().find("dot").attribute("fill"), "blue");
  assert.match(label.toSvg(), /transform="matrix\(2 0 0 2 10 20\)"/);
  const after = session.requireDocument().toSvg(); cli.execute("undo"); assert.equal(session.requireDocument().toSvg(), before);
  cli.execute("redo"); assert.equal(session.requireDocument().toSvg(), after);
});

test("ordinary nested groups can be ungrouped even with imported compositing opacity", () => {
  const store = new MemoryStore();
  store.put("opacity.svg", new SvgCodec().parse('<svg><g id="outer"><g id="inner" opacity="0.5"><circle id="c" r="1"/></g></g></svg>').document);
  const session = new DocumentSession(store), cli = new Cli(session); cli.execute("read opacity.svg");
  const before = session.requireDocument().toSvg();
  assert.equal(cli.execute("ungroup inner"), "g#inner ungrouped");
  assert.equal(session.requireDocument().find("c").parent?.label, "g#outer");
  assert.throws(() => session.requireDocument().find("inner"), /no such shape/);
  cli.execute("undo"); assert.equal(session.requireDocument().toSvg(), before);
});

test("seeded mixed editing sequences preserve state on failures and completely undo and redo", () => {
  const session = new DocumentSession(new MemoryStore()), cli = new Cli(session), codec = new SvgCodec();
  cli.execute("init"); const snapshots = [session.requireDocument().toSvg()];
  let seed = 12345, serial = 0, failures = 0;
  const next = (size: number): number => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % size; };
  const edit = (line: string): void => {
    const before = session.requireDocument().toSvg(), history = session.historyCounts;
    try { cli.execute(line); snapshots.push(session.requireDocument().toSvg()); }
    catch (error) {
      assert.ok(error instanceof EditorError); failures++;
      assert.equal(session.requireDocument().toSvg(), before, line);
      assert.deepEqual(session.historyCounts, history, line);
    }
    const document = session.requireDocument(); document.validate();
    assert.equal(codec.parse(document.toSvg()).document.toSvg(), document.toSvg(), line);
  };
  edit("create g root"); edit("create g left in root"); edit("create g right in root");
  for (let step = 0; step < 300; step++) {
    const shapes = session.requireDocument().all(), target = shapes[next(shapes.length)]!;
    const groups = shapes.filter(shape => shape.asContainer());
    const group = groups[next(groups.length)]!;
    const choice = next(9);
    const commands = [
      `create circle shape${serial++} ${next(20)} ${next(20)} 3 in ${group.id}`,
      `move ${target.id} 1 -2`, `scale ${target.id} 0.5`, `set ${target.id} fill red`,
      `front ${target.id}`, `back ${target.id}`, `addto ${group.id} ${target.id}`,
      `group cluster${serial++} ${target.id} ${shapes[next(shapes.length)]!.id}`,
      `ungroup ${target.id}`,
    ];
    edit(commands[choice]!);
    if (step % 25 === 0) {
      const counts = session.historyCounts; cli.execute("tree"); cli.execute(`show ${session.requireDocument().all()[0]!.id}`); cli.execute("help");
      assert.deepEqual(session.historyCounts, counts);
    }
  }
  assert.ok(failures > 0); assert.ok(snapshots.length > 100);
  for (const expected of snapshots.slice(0, -1).reverse()) { cli.execute("undo"); assert.equal(session.requireDocument().toSvg(), expected); }
  for (const expected of snapshots.slice(1)) { cli.execute("redo"); assert.equal(session.requireDocument().toSvg(), expected); }
});
