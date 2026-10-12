import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { DocumentStore } from "../application/DocumentStore";
import type { Document } from "../domain/Document";
import { EditorError } from "../domain/EditorError";
import { SvgCodec } from "./SvgCodec";

export class SvgFileStore extends DocumentStore {
  constructor(private readonly codec = new SvgCodec()) { super(); }
  override read(file: string): { document: Document; warnings: readonly string[] } {
    let bytes: Buffer;
    try {
      if (fs.statSync(file).size > 5 * 1024 * 1024) throw new EditorError("SVG exceeds 5 MiB");
      bytes = fs.readFileSync(file);
    } catch (error) {
      if (error instanceof EditorError) throw error;
      throw new EditorError(`cannot read file: ${file}`);
    }
    let source: string;
    try { source = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
    catch { throw new EditorError("SVG must use UTF-8 encoding"); }
    return this.codec.parse(source);
  }
  override write(file: string, document: Document): void {
    const source = this.codec.serialize(document);
    if (Buffer.byteLength(source, "utf8") > 5 * 1024 * 1024) throw new EditorError("SVG exceeds 5 MiB");
    let temporary: string | undefined, descriptor: number | undefined;
    try {
      const destination = path.resolve(file);
      temporary = path.join(path.dirname(destination), `.svg-editor-${randomUUID()}.tmp`);
      descriptor = fs.openSync(temporary, "wx", 0o600);
      fs.writeFileSync(descriptor, source, "utf8"); fs.fsyncSync(descriptor); fs.closeSync(descriptor); descriptor = undefined;
      fs.renameSync(temporary, destination); temporary = undefined;
    } catch { throw new EditorError(`cannot write file: ${file}`); }
    finally {
      if (descriptor !== undefined) { try { fs.closeSync(descriptor); } catch { /* Preserve the original error. */ } }
      if (temporary !== undefined) { try { fs.unlinkSync(temporary); } catch { /* Preserve the original error. */ } }
    }
  }
}
