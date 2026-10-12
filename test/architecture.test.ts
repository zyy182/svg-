import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import ts from "typescript";

const root = path.resolve("src");
const sources = fs.readdirSync(root, { recursive: true }).filter((entry): entry is string => typeof entry === "string" && entry.endsWith(".ts"));
const rules: Record<string, ReadonlySet<string>> = {
  domain: new Set(["domain"]), application: new Set(["application", "domain"]),
  infrastructure: new Set(["infrastructure", "application", "domain"]),
  cli: new Set(["cli", "application", "domain"]),
};

test("source imports obey the declared layer dependency direction", () => {
  let checked = 0;
  for (const file of sources) {
    if (file === "main.ts") continue; // Composition root intentionally binds adapters.
    const layer = file.split(path.sep)[0]!, allowed = rules[layer]; assert.ok(allowed, file);
    const full = path.join(root, file), ast = ts.createSourceFile(full, fs.readFileSync(full, "utf8"), ts.ScriptTarget.Latest, true);
    for (const statement of ast.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
      const name = statement.moduleSpecifier.text;
      if (name.startsWith(".")) {
        const target = path.relative(root, path.resolve(path.dirname(full), name)).split(path.sep)[0]!;
        assert.ok(allowed.has(target), `${file} imports forbidden layer ${target}`); checked++;
      } else if (layer === "domain" || layer === "application") assert.fail(`${file} imports external IO/runtime package ${name}`);
    }
  }
  assert.ok(checked > 50);
});

test("production classes use one class per matching file and encapsulate fields", () => {
  let checked = 0;
  for (const file of sources) {
    const ast = ts.createSourceFile(file, fs.readFileSync(path.join(root, file), "utf8"), ts.ScriptTarget.Latest, true);
    const classes = ast.statements.filter(ts.isClassDeclaration); assert.ok(classes.length <= 1, file);
    for (const declaration of classes) {
      assert.equal(declaration.name?.text, path.basename(file, ".ts")); checked++;
      for (const member of declaration.members) {
        if (ts.isPropertyDeclaration(member)) {
          const modifiers = ts.getModifiers(member) ?? [];
          assert.ok(modifiers.some(modifier => [ts.SyntaxKind.PrivateKeyword, ts.SyntaxKind.ProtectedKeyword].includes(modifier.kind)), `${file} exposes field ${member.name.getText(ast)}`);
        }
      }
    }
  }
  assert.ok(checked >= 35);
});

test("shape behavior uses polymorphism rather than switches or shape-type branches", () => {
  for (const file of sources) {
    const ast = ts.createSourceFile(file, fs.readFileSync(path.join(root, file), "utf8"), ts.ScriptTarget.Latest, true);
    const visit = (node: ts.Node): void => {
      assert.ok(!ts.isSwitchStatement(node), `${file} contains switch dispatch`);
      if ((ts.isIfStatement(node) || ts.isConditionalExpression(node)) && file !== path.join("domain", "ShapeFactory.ts")) {
        const condition = ts.isIfStatement(node) ? node.expression : node.condition;
        assert.ok(!/\b\w+\.type\b/.test(condition.getText(ast)), `${file} branches on shape.type`);
      }
      ts.forEachChild(node, visit);
    };
    visit(ast);
  }
});
