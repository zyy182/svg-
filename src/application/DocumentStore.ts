import type { Document } from "../domain/Document";

/** Port owned by the application; file adapters implement it. */
export abstract class DocumentStore {
  abstract read(path: string): { document: Document; warnings: readonly string[] };
  abstract write(path: string, document: Document): void;
}
