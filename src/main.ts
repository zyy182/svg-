import { createReadStream } from "node:fs";
import { Cli } from "./cli/Cli";
import { DocumentSession } from "./application/DocumentSession";
import { SvgFileStore } from "./infrastructure/SvgFileStore";

// Composition root: the only place that knows both the CLI and file adapter.
const argv = process.argv.slice(2);
const valid = argv.length === 0 || (argv.length === 2 && argv[0] === "--script");
if (!valid) {
  process.stderr.write("error: usage: npm run cli [-- --script <commands.txt>]\n");
  process.exitCode = 1;
} else {
  const cli = new Cli(new DocumentSession(new SvgFileStore()));
  const input = argv.length ? createReadStream(argv[1]!, { encoding: "utf8" }) : process.stdin;
  cli.run(input, process.stdout, process.stderr, !argv.length && Boolean(process.stdin.isTTY), Boolean(argv.length))
    .then(code => { process.exitCode = code; })
    .catch(error => { process.stderr.write(`error: ${String(error instanceof Error ? error.message : error).replace(/[\r\n]+/g, " ")}\n`); process.exitCode = 1; })
    .finally(() => { if (argv.length) input.destroy(); });
}
