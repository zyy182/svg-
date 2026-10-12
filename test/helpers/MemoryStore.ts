import { DocumentStore } from "../../src/application/DocumentStore";
import type { Document } from "../../src/domain/Document";
import { EditorError } from "../../src/domain/EditorError";

export class MemoryStore extends DocumentStore {
  private readonly files = new Map<string, Document>();
  private failWrites = false;
  put(path: string, doc: Document): void { this.files.set(path, doc.clone()); }
  setWriteFailure(fail: boolean): void { this.failWrites = fail; }
  override read(path: string): { document: Document; warnings: readonly string[] } {
    const doc = this.files.get(path); if (!doc) throw new EditorError(`cannot read file: ${path}`);
    return { document: doc.clone(), warnings: [] };
  }
  override write(path: string, doc: Document): void {
    if (this.failWrites) throw new EditorError(`cannot write file: ${path}`);
    this.files.set(path, doc.clone());
  }
}
