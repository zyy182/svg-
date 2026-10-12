import { EditorError } from "../domain/EditorError";

export class Tokenizer {
  split(line: string): readonly string[] {
    if (!line.trim() || line.trimStart().startsWith("#")) return [];
    const result: string[] = [];
    let token = "", quote = "", started = false;
    for (let index = 0; index < line.length; index++) {
      const character = line[index]!;
      if (quote) {
        if (character === quote) quote = "";
        else if (character === "\\" && (line[index + 1] === quote || line[index + 1] === "\\")) token += line[++index]!;
        else token += character;
      } else if (character === '"' || character === "'") { quote = character; started = true; }
      else if (/\s/.test(character)) {
        if (started) { result.push(token); token = ""; started = false; }
      } else { token += character; started = true; }
    }
    if (quote) throw new EditorError("unterminated quoted argument");
    if (started) result.push(token);
    return result;
  }
}
