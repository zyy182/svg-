import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { Readable, Writable } from "node:stream";
import { Cli } from "../src/cli/Cli";
import { Tokenizer } from "../src/cli/Tokenizer";
import { DocumentSession } from "../src/application/DocumentSession";
import { SvgFileStore } from "../src/infrastructure/SvgFileStore";
import { MemoryStore } from "./helpers/MemoryStore";

test("tokenizer respects Chinese, spaces, quotes, hex colors and whole-line comments", () => {
  const tokenizer = new Tokenizer();
  assert.deepEqual(tokenizer.split('create text t 10 20 "开始 SVG \\"quoted\\""'), ["create", "text", "t", "10", "20", '开始 SVG "quoted"']);
  assert.deepEqual(tokenizer.split('create rect r 0 0 10 20 #4a90d9'), ["create", "rect", "r", "0", "0", "10", "20", "#4a90d9"]);
  assert.deepEqual(tokenizer.split("  # comment"), []); assert.deepEqual(tokenizer.split(""), []);
  assert.deepEqual(tokenizer.split('create text t 0 0 ""'), ["create", "text", "t", "0", "0", ""]);
  assert.throws(() => tokenizer.split('set t text "unclosed'), /unterminated quoted argument/);
});

test("CLI uses exact course positional create/set syntax and in for all six types", () => {
  const session = new DocumentSession(new MemoryStore()), cli = new Cli(session); cli.execute("init"); cli.execute("create g scene");
  for (const command of ['create rect r 10 20 100 50 #eee in scene', 'create circle c 100 100 20 red in scene',
    'create ellipse e 10 20 30 40 in scene', 'create line l 1 2 3 4 black in scene',
    'create text t 20 40 "My Diagram" in scene', 'create g nested in scene']) cli.execute(command);
  assert.equal(session.requireDocument().container("scene").children.length, 6);
  assert.equal(cli.execute('set t text "My Diagram v2"'), 'text#t updated: text="My Diagram v2"');
  assert.match(cli.execute("show c"), /circle#c  parent=g#scene/); assert.match(cli.execute("tree scene"), /^g#scene\n/);
});

test("specified error strings are exact and every failed command preserves state", () => {
  const session = new DocumentSession(new MemoryStore()), cli = new Cli(session);
  assert.throws(() => cli.execute("create circle c 1 2 3"), { message: "no document. use 'init' or 'read' first" });
  cli.execute("init"); cli.execute("create g markers"); cli.execute("create circle c1 100 100 20 in markers");
  const before = session.requireDocument().toSvg(), history = session.historyCounts;
  const cases = new Map([
    ["create circle c1 1 2 3", "id already exists: c1"], ["delete r9", "no such shape: r9"],
    ["create g child in node9", "no such container: node9"], ["create g child in c1", "not a container: c1"],
    ["create hexagon h", "unknown shape type: hexagon (is the plugin loaded?)"],
    ["create box n1 1 2 3 4 Title", "unknown shape type: box (is the plugin loaded?)"],
    ["group bad c1 markers", "cannot group a container into its own descendant: markers"],
    ["ungroup markers", "cannot ungroup top-level container: markers"],
    ["scale c1 0", "scale factor must be positive"], ["scale c1 -1", "scale factor must be positive"],
    ["set c1 opacity 0.5", "unknown attribute: opacity"],
  ]);
  for (const [command, message] of cases) {
    assert.throws(() => cli.execute(command), { message }, command);
    assert.equal(session.requireDocument().toSvg(), before, command); assert.deepEqual(session.historyCounts, history, command);
  }
});

test("IDs are explicit, case-sensitive and extra positional parameters are refused", () => {
  const s = new DocumentSession(new MemoryStore()), cli = new Cli(s); cli.execute("init");
  cli.execute("create circle A 0 0 1"); cli.execute("create circle a 0 0 1");
  for (const command of ["create circle", "create circle b 0 0", "create g c extra", "set a fill=red",
    "scale a 2 3", "show", "tree a extra", "group", "move a NaN 2"]) assert.throws(() => cli.execute(command));
  assert.equal(s.requireDocument().all().length, 2);
});

test("init/canvas optional dimensions, queries and barrier behavior match the protocol", () => {
  const s = new DocumentSession(new MemoryStore()), cli = new Cli(s);
  assert.equal(cli.execute("init 400"), "canvas 400x600 created");
  assert.equal(cli.execute("canvas"), "canvas 400x600"); assert.equal(cli.execute("canvas 500"), "canvas resized to 500x600");
  assert.throws(() => cli.execute("undo"), /io command/); cli.execute("create g g");
  cli.execute("canvas"); cli.execute("undo"); assert.equal(s.requireDocument().all().length, 0);
});

test("complete course transcript runs in a real process and matches prescribed feedback", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "svg-ts-transcript-"));
  try {
    const output = path.join(directory, "demo.svg");
    const commands = ['init 800 600', 'create rect bg 0 0 800 600 #ffffff', 'create text title 20 40 "My Diagram"',
      'create circle c1 100 100 20 red', 'create rect box 200 80 60 60 #3366ff', 'group markers c1 box', 'tree',
      'move c1 30 0', 'undo', 'redo', 'set title text "My Diagram v2"', 'undo', 'group bad c1 markers',
      'delete box', 'undo', `save "${output}"`, 'undo', 'read examples/other.svg', 'tree'].join("\n") + "\n";
    const result = spawnSync(process.execPath, ["dist/src/main.js"], { input: commands, encoding: "utf8", cwd: process.cwd() });
    assert.equal(result.status, 1); // The transcript deliberately contains two errors.
    assert.equal(result.stderr, 'error: cannot group a container into its own descendant: markers\nerror: undo not allowed after io command\n');
    for (const expected of ['circle#c1 moved to (130,100)', 'circle#c1 moved back to (100,100)',
      'rect#box restored into g#markers', 'warning: assigned id rect1 to unnamed <rect>',
      'read examples/other.svg (7 elements)', 'svg (400x300)', '├── rect#rect1']) assert.ok(result.stdout.includes(expected), expected);
    assert.equal(new SvgFileStore().read(output).document.all().length, 5);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test("course flowchart creates eight elements and moving a node includes its text", () => {
  const s = new DocumentSession(new MemoryStore()), cli = new Cli(s);
  const lines = fs.readFileSync("examples/flowchart.commands", "utf8").split(/\r?\n/).filter(line => !line.startsWith("save"));
  for (const line of lines) cli.execute(line);
  assert.equal(s.requireDocument().all().length, 8); cli.execute("move node2 0 100");
  assert.equal(s.requireDocument().find("process").attribute("y"), "200");
  assert.equal(s.requireDocument().find("process-label").attribute("y"), "235");
  cli.execute("scale node2 2"); assert.equal(s.requireDocument().find("process").attribute("width"), "320");
  assert.equal(s.requireDocument().find("process-label").attribute("x"), "1090");
});

test("REPL errors have one-line error prefix and continue to accept commands", async () => {
  const s = new DocumentSession(new MemoryStore()), cli = new Cli(s); let output = "", errors = "";
  const out = new Writable({ write(chunk, _encoding, callback) { output += String(chunk); callback(); } });
  const err = new Writable({ write(chunk, _encoding, callback) { errors += String(chunk); callback(); } });
  const code = await cli.run(Readable.from(['show missing\ninit\ncreate text t 1 2 "中文"\nshow t\nquit\n']), out, err);
  assert.equal(code, 1); assert.equal(errors, "error: no document. use 'init' or 'read' first\n");
  assert.ok(output.includes('text="中文"')); assert.ok(!output.includes("svg>"));
});

test("interactive prompt is fixed svg> and help is usable before init", async () => {
  const cli = new Cli(new DocumentSession(new MemoryStore())); let output = "";
  const out = new Writable({ write(chunk, _encoding, callback) { output += String(chunk); callback(); } });
  const err = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
  await cli.run(Readable.from(["help\nquit\n"]), out, err, true);
  assert.ok(output.includes("svg> ")); assert.ok(!output.includes("svg*>"));
  assert.ok(output.includes("create <type> <id>"));
});

test("script mode stops on first error before a later save", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "svg-ts-script-"));
  try {
    const commands = path.join(directory, "bad.commands"), output = path.join(directory, "must-not-exist.svg");
    fs.writeFileSync(commands, `init\ncreate circle c 0 0 1\nmove missing 1 2\nsave "${output}"\n`);
    const result = spawnSync(process.execPath, ["dist/src/main.js", "--script", commands], { encoding: "utf8" });
    assert.equal(result.status, 1); assert.equal(result.stderr, "error: no such shape: missing\n"); assert.ok(!fs.existsSync(output));
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test("missing command script reports exactly one error line", () => {
  const result = spawnSync(process.execPath, ["dist/src/main.js", "--script", "/nonexistent-svg-course-script.txt"], { encoding: "utf8" });
  assert.equal(result.status, 1); assert.equal(result.stderr.trim().split("\n").length, 1); assert.ok(result.stderr.startsWith("error: "));
});
