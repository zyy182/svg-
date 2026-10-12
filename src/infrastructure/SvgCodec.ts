import { SaxesParser } from "saxes";
import { Document } from "../domain/Document";
import { EditorError } from "../domain/EditorError";
import { ShapeFactory } from "../domain/ShapeFactory";
import { ValueRules } from "../domain/ValueRules";
import { SvgElement } from "./SvgElement";

export class SvgCodec {
  constructor(private readonly factory = new ShapeFactory()) {}
  parse(source: string): { document: Document; warnings: readonly string[] } {
    if (Buffer.byteLength(source, "utf8") > 5 * 1024 * 1024) throw new EditorError("SVG exceeds 5 MiB");
    const parser = new SaxesParser({ xmlns: true });
    const stack: SvgElement[] = [];
    let root: SvgElement | undefined, namespace: string | undefined, count = 0;
    parser.on("error", error => { throw new EditorError(`invalid SVG XML: ${error.message}`); });
    // Reject declarations at the XML parser boundary, not text that happens to
    // mention their spelling inside a legal comment or CDATA section.
    parser.on("doctype", () => { throw new EditorError("DOCTYPE is not supported"); });
    parser.on("processinginstruction", () => { throw new EditorError("XML processing instructions are not supported"); });
    parser.on("opentag", tag => {
      if (namespace === undefined) namespace = tag.uri;
      if ((tag.uri !== "" && tag.uri !== "http://www.w3.org/2000/svg") || tag.uri !== namespace) {
        throw new EditorError("unsupported or mixed SVG namespace");
      }
      if (++count > 10001 || stack.length > 128) throw new EditorError("document limit exceeded (10000 elements, depth 128)");
      const attributes: Record<string, string> = Object.create(null) as Record<string, string>;
      for (const attribute of Object.values(tag.attributes)) {
        if (attribute.uri === "http://www.w3.org/2000/xmlns/") continue;
        if (attribute.uri) throw new EditorError(`unsupported attribute namespace: ${attribute.name}`);
        attributes[attribute.name] = attribute.value;
      }
      const element = new SvgElement(tag.local, Object.freeze(attributes));
      if (stack.length) stack.at(-1)!.addChild(element);
      else if (root) throw new EditorError("multiple SVG roots");
      else root = element;
      stack.push(element);
    });
    parser.on("text", text => {
      if (stack.length) stack.at(-1)!.appendText(text);
      else if (text.trim()) throw new EditorError("text outside SVG root");
    });
    parser.on("cdata", text => { stack.at(-1)?.appendText(text); });
    parser.on("closetag", () => { stack.pop(); });
    parser.write(source).close();
    if (!root || root.name !== "svg") throw new EditorError("root element must be svg");
    if (root.text.trim()) throw new EditorError("svg cannot contain text");
    const allowed = new Set(["width", "height", "viewBox", "version"]);
    for (const key of Object.keys(root.attributes)) if (!allowed.has(key)) throw new EditorError(`unsupported root attribute: ${key}`);
    const numeric = (source: string | undefined, fallback: number): number =>
      source === undefined ? fallback : ValueRules.number(source.endsWith("px") ? source.slice(0, -2) : source);
    const document = new Document(numeric(root.attributes.width, 800), numeric(root.attributes.height, 600));
    if (root.attributes.viewBox !== undefined) document.setViewBox(root.attributes.viewBox);
    const reserved = new Set<string>();
    for (const element of root.all().slice(1)) {
      const id = element.attributes.id;
      if (id !== undefined) {
        ValueRules.id(id);
        if (reserved.has(id)) throw new EditorError(`id already exists: ${id}`);
        reserved.add(id);
      }
    }
    const counters = new Map<string, number>(), warnings: string[] = [];
    const convert = (element: SvgElement): ReturnType<ShapeFactory["fromSvg"]> => {
      let id = element.attributes.id;
      if (id === undefined) {
        let index = counters.get(element.name) ?? 1;
        while (reserved.has(`${element.name}${index}`)) index++;
        id = `${element.name}${index}`; counters.set(element.name, index + 1); reserved.add(id);
        warnings.push(`warning: assigned id ${id} to unnamed <${element.name}>`);
      }
      const shape = this.factory.fromSvg(element.name, id, element.attributes, element.text);
      shape.acceptSvgText(element.text);
      const container = shape.asContainer();
      if (!container && element.children.length) throw new EditorError(`${shape.type} cannot contain child elements`);
      for (const child of element.children) container!.insert(convert(child));
      return shape;
    };
    for (const child of root.children) document.add(convert(child));
    document.validate(); return { document, warnings };
  }
  serialize(document: Document): string { return document.toSvg(); }
}
