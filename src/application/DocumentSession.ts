import { Document } from "../domain/Document";
import { EditorError } from "../domain/EditorError";
import type { Command } from "./Command";
import { CommandHistory } from "./CommandHistory";
import type { DocumentStore } from "./DocumentStore";

export class DocumentSession {
  private document: Document | undefined;
  private path: string | undefined;
  private readonly history = new CommandHistory();
  private active = true;
  constructor(private readonly store: DocumentStore) {}
  get running(): boolean { return this.active; }
  get filePath(): string | undefined { return this.path; }
  get historyCounts(): readonly [number, number] { return this.history.counts; }
  requireDocument(): Document {
    if (!this.document) throw new EditorError("no document. use 'init' or 'read' first");
    return this.document;
  }
  init(width = 800, height = 600): string {
    const document = new Document(width, height);
    this.document = document; this.path = undefined;
    return `canvas ${width}x${height} created`;
  }
  read(path: string): string {
    const loaded = this.store.read(path); loaded.document.validate();
    this.document = loaded.document; this.path = path;
    return [...loaded.warnings, `read ${path} (${loaded.document.all().length} elements)`].join("\n");
  }
  save(path?: string): string {
    const document = this.requireDocument(), target = path ?? this.path;
    if (!target) throw new EditorError("cannot write file: no path. use 'save <file.svg>'");
    this.store.write(target, document); this.path = target;
    return `saved to ${target} (${document.all().length} elements)`;
  }
  resize(width: number, height: number): string {
    const current = this.requireDocument(), candidate = current.clone(); candidate.resize(width, height);
    this.document = candidate; return `canvas resized to ${width}x${height}`;
  }
  replaceForEdit(document: Document): void { this.document = document; }
  execute(command: Command): string { return this.history.execute(command); }
  undo(): string { this.requireDocument(); return this.history.undo(); }
  redo(): string { this.requireDocument(); return this.history.redo(); }
  quit(): string { this.active = false; return "bye"; }
}
