import type { Shape } from "./Shape";

export interface ShapeContainer {
  readonly children: readonly Shape[];
  readonly parent: ShapeContainer | undefined;
  readonly label: string;
  asShape(): Shape | undefined;
  insert(shape: Shape, index?: number): void;
  remove(shape: Shape): void;
}
