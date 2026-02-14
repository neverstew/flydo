import { $ } from "bun";
import { parseArgs } from "util";
import { resolve, relative } from "path";
import { changeToProjectRoot } from "./changeToProjectRoot";
import { build, login, logout, run } from "./tasks";
import { setupSigIntHandler } from "./interruptions";

setupSigIntHandler();

const originalCwd = process.cwd();
const gitRoot = await changeToProjectRoot();

const { values, positionals } = parseArgs({
    args: Bun.argv,
    options: {
        help: { type: "boolean", short: "h" },
    },
    strict: true,
    allowPositionals: true,
});

function printHelp() {
    console.log(`Usage: bun index.ts [command] [options]

Commands:
  login                    Issue a deploy token
  logout                   Revoke all deploy tokens
  run <file> [args...]     Run a particular file remotely

Options:
  --help, -h      Show this help message`);
}

if (values.help) {
    printHelp();
    process.exit(0);
}

const [, , command, ...rest] = positionals;

try {
    await $`fly config validate`.quiet();
} catch (err) {
    console.error("Could not detect a valid fly config file");
    process.exit(99);
}

switch (command) {
    case "login": {
        await login();
        console.log("Logged in!");
        break;
    } case "logout": {
        await logout();
        console.log("Session stopped");
        break;
    }
    case "run": {
        const [filename, ...args] = rest;
        if (!filename) {
            console.error('Unable to parse input for run command');
            printHelp();
            process.exit(2);
        }
        await build();
        const relFilePath = relative(gitRoot, resolve(originalCwd, filename));
        await run(relFilePath, args);
        break;
    }
    default:
        if (command) {
            console.error(`Unknown command: ${command}`);
            process.exit(1);
        }
        printHelp();
}
