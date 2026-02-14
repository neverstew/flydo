import { parseArgs } from "util";
import { resolve, relative } from "path";
import { changeToProjectRoot } from "./changeToProjectRoot";
import { build, init, login, logout, run, validateFlyConfiguration } from "./tasks";
import { setupSigIntHandler } from "./interruptions";
import { setQuiet } from "./quiet";
import { readState } from "./state";

setupSigIntHandler();

const originalCwd = process.cwd();
const { values, positionals } = parseArgs({
    args: Bun.argv,
    options: {
        debug: { type: "boolean", default: false },
        help: { type: "boolean", short: "h" },
    },
    strict: true,
    allowPositionals: true,
});

function printHelp() {
    console.log(`Usage: flydo [command] [options]

Commands:
  init [dir]               Scaffold a new flydo directory
  login                    Issue a deploy token
  logout                   Revoke all deploy tokens
  run <file> [args...]     Run a particular file remotely

Options:
  --help, -h               Show this help message
  --debug                  Show messages from each command

Environment variables:
  FLYDO_STATE_FILE         The file where the CLI state is stored
`);
}

if (values.help) {
    printHelp();
    process.exit(0);
}

setQuiet(!values.debug);

const [, , command, ...rest] = positionals;

const gitRoot = await changeToProjectRoot();
const flyConfigFile = await validateFlyConfiguration();
process.chdir(originalCwd);

switch (command) {
    case "init": {
        const [path] = rest;
        const dirPath = resolve(originalCwd, path || '.')

        console.log(`Initialising flydo directory in ${path}...`);
        await init(dirPath, flyConfigFile);
        await login();
        break;
    }
    case "login": {
        await login();
        console.log("Logged in");
        break;
    } case "logout": {
        await logout();
        console.log("Logged out");
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
        const { workdir } = await readState();
        const relFilePath = relative(workdir!, resolve(originalCwd, filename));
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
