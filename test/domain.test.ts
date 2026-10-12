import test from "node:test";
import assert from "node:assert/strict";
import { Document } from "../src/domain/Document";
import { ShapeFactory } from "../src/domain/ShapeFactory";
import { Group } from "../src/domain/Group";
import { Rect } from "../src/domain/Rect";
import { Circle } from "../src/domain/Circle";
import { Text } from "../src/domain/Text";

test("factory creates the six built-in types and rejects Phase 2 types", () => {
  const factory = new ShapeFactory();
  for (const [type, args] of [["rect", ["1", "2", "3", "4"]], ["circle", ["1", "2", "3"]],
    ["ellipse", ["1", "2", "3", "4"]], ["line", ["1", "2", "3", "4"]],
    ["text", ["1", "2", "Hello world"]], ["g", []]] as const) {
    assert.equal(factory.create(type, `${type}1`, args).type, type);
  }
  for (const type of ["box", "polygon", "hexagon"]) assert.throws(() => factory.create(type, "a", []), /unknown shape type/);
  assert.throws(() => factory.create("rect", "a", ["1", "2"]), /invalid parameters/);
  assert.throws(() => factory.create("circle", "a", ["0", "0", "-1"]), /nonnegative/);
});

test("move and scale change all geometry directly, including positions", () => {
  const rect = new Rect("r", 10, 20, 100, 50);
  rect.move(30, -10); rect.scale(2);
  assert.equal(rect.attribute("x"), "80"); assert.equal(rect.attribute("y"), "20");
  assert.equal(rect.attribute("width"), "200"); assert.equal(rect.attribute("height"), "100");
  assert.throws(() => rect.scale(0), /scale factor must be positive/);
  assert.throws(() => rect.scale(-1), /scale factor must be positive/);
});

test("composite moves and scales every descendant through polymorphism", () => {
  const outer = new Group("outer"), inner = new Group("inner"), rect = new Rect("r", 10, 20, 5, 6), text = new Text("t", 30, 40, "标题");
  outer.insert(inner); inner.insert(rect); inner.insert(text);
  outer.move(3, 4); outer.scale(2);
  assert.equal(rect.attribute("x"), "26"); assert.equal(text.attribute("y"), "88");
  assert.equal(rect.attribute("width"), "10"); assert.equal(text.attribute("text"), "标题");
});

test("set has the exact whitelist and text content is child text", () => {
  const factory = new ShapeFactory(); const rect = new Rect("r", 1, 2, 3, 4), text = new Text("t", 1, 2, "a");
  rect.set("fill", "red"); rect.set("stroke-width", "2"); text.set("text", "<中文 & SVG>");
  assert.throws(() => rect.set("opacity", "0.5"), /unknown attribute: opacity/);
  assert.throws(() => rect.set("text", "x"), /unknown attribute: text/);
  assert.throws(() => rect.set("rx", "2"), /unknown attribute: rx/);
  assert.match(text.toSvg(), /&lt;中文 &amp; SVG&gt;<\/text>/);
  assert.equal(factory.create("rect", "plain", ["0", "0", "1", "2"]).attribute("fill"), undefined);
});

test("group collects nonadjacent members from multiple parents in document order", () => {
  const doc = new Document(), left = new Group("left"), right = new Group("right");
  doc.add(left); doc.add(right);
  doc.add(new Circle("a", 0, 0, 1), "left"); doc.add(new Circle("stay", 0, 0, 1), "left");
  doc.add(new Circle("b", 0, 0, 1), "right"); doc.add(new Circle("c", 0, 0, 1), "right");
  doc.group("collected", ["c", "a"]);
  assert.deepEqual(doc.container("collected").children.map(s => s.id), ["a", "c"]);
  assert.deepEqual(doc.children.map(s => s.id), ["collected", "left", "right"]);
  assert.deepEqual(doc.container("left").children.map(s => s.id), ["stay"]);
  assert.deepEqual(doc.container("right").children.map(s => s.id), ["b"]); doc.validate();
});

test("group rejects ancestor/descendant selections and duplicate IDs", () => {
  const doc = new Document(); doc.add(new Group("markers")); doc.add(new Circle("c1", 0, 0, 1), "markers");
  assert.throws(() => doc.group("bad", ["c1", "markers"]), /cannot group a container into its own descendant: markers/);
  assert.throws(() => doc.add(new Circle("c1", 0, 0, 1)), /id already exists: c1/);
  assert.throws(() => doc.find("missing"), /no such shape: missing/);
  assert.throws(() => doc.add(new Group("child"), "missing"), /no such container: missing/);
  assert.throws(() => doc.add(new Group("child"), "c1"), /not a container: c1/);
});

test("addto reparents at the end and refuses cycles", () => {
  const doc = new Document(); doc.add(new Group("g")); doc.add(new Circle("a", 0, 0, 1));
  doc.add(new Group("nested"), "g"); doc.addTo("g", "a");
  assert.deepEqual(doc.container("g").children.map(s => s.id), ["nested", "a"]);
  assert.throws(() => doc.addTo("nested", "g"), /own descendant/); doc.validate();
});

test("ungroup promotes nested children at the original position and protects root groups", () => {
  const doc = new Document(); doc.add(new Group("outer")); doc.add(new Group("inner"), "outer");
  doc.add(new Circle("a", 0, 0, 1), "inner"); doc.add(new Circle("b", 0, 0, 1), "outer");
  assert.throws(() => doc.ungroup("outer"), /cannot ungroup top-level container: outer/);
  doc.ungroup("inner"); assert.deepEqual(doc.container("outer").children.map(s => s.id), ["a", "b"]); doc.validate();
});

test("front is last painted and back is first painted at the same parent", () => {
  const doc = new Document(); for (const id of ["a", "b", "c"]) doc.add(new Circle(id, 0, 0, 1));
  doc.reorder("a", true); assert.deepEqual(doc.children.map(s => s.id), ["b", "c", "a"]);
  doc.reorder("c", false); assert.deepEqual(doc.children.map(s => s.id), ["c", "b", "a"]);
});

test("clone preserves runtime types, ownership, text and presentation independently", () => {
  const doc = new Document(); doc.add(new Group("g")); doc.add(new Text("t", 1, 2, "original"), "g");
  doc.find("t").set("fill", "red"); const cloned = doc.clone(); cloned.find("t").set("text", "changed");
  assert.ok(cloned.find("t") instanceof Text); assert.ok(cloned.find("g") instanceof Group);
  assert.equal(doc.find("t").attribute("text"), "original"); assert.equal(cloned.find("t").parent, cloned.find("g"));
  doc.validate(); cloned.validate();
});

test("tree shows branches, geometry and subtrees; show identifies the parent", () => {
  const doc = new Document(400, 300); doc.add(new Group("g")); doc.add(new Circle("c", 1, 2, 3), "g");
  assert.match(doc.tree(), /^svg \(400x300\)\n└── g#g\n    └── circle#c  cx=1 cy=2 r=3$/);
  assert.equal(doc.tree("c"), "circle#c  cx=1 cy=2 r=3"); assert.match(doc.find("c").show(), /parent=g#g/);
});

test("SVG IDs are case-sensitive and numeric constraints reject invalid syntax", () => {
  const doc = new Document(); doc.add(new Circle("A", 0, 0, 1)); doc.add(new Circle("a", 0, 0, 1));
  assert.equal(doc.all().length, 2);
  const factory = new ShapeFactory(); for (const value of ["NaN", "Infinity", "1_0", "1e999"]) {
    assert.throws(() => factory.create("circle", "invalid", ["0", "0", value]), /invalid number/);
  }
  assert.throws(() => new Document(0, 10), /positive/);
});

test("Unicode XML names and svg are valid shape IDs without weakening name validation", () => {
  const doc = new Document();
  for (const id of ["节点一", "étiquette", ":shape", "svg", "节点-2", "😀"]) {
    doc.add(new Circle(id, 0, 0, 1));
    assert.equal(doc.find(id).id, id);
  }
  for (const id of ["", "has space", "1circle", "-circle", ".circle", "x\u0000", "x/y"]) {
    assert.throws(() => new Circle(id, 0, 0, 1), /invalid id/);
  }
  doc.validate();
});
