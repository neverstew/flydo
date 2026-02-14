import { $ } from "bun";
import { parseArgs } from "util";
import { resolve, relative } from "path";

const originalCwd = process.cwd();

let gitRoot: string;
try {
    gitRoot = (await $`git rev-parse --show-toplevel`.quiet().text()).trim();
} catch {
    console.error("Not in a git repository");
    process.exit(1);
}
process.chdir(gitRoot);

const STATE_FILE = ".flydo";

async function readState(): Promise<Record<string, string>> {
    const stateFile = Bun.file(STATE_FILE);
    if (!(await stateFile.exists())) return {};
    return JSON.parse(await stateFile.text());
}

async function writeState(updates: Record<string, string>): Promise<void> {
    const current = await readState();
    await Bun.write(STATE_FILE, JSON.stringify({ ...current, ...updates }, null, 2));
}

async function computeDirHash(): Promise<string> {
    const hasher = new Bun.CryptoHasher("sha256");
    const files: string[] = [];
    for await (const file of new Bun.Glob("**/*").scan({ dot: true, onlyFiles: true })) {
        if (file.startsWith(".git/") || file.startsWith("node_modules/") || file === STATE_FILE) continue;
        files.push(file);
    }
    files.sort();
    for (const file of files) {
        hasher.update(file);
        hasher.update(await Bun.file(file).bytes());
    }
    return hasher.digest("hex");
}

async function hasChanges(): Promise<boolean> {
    const state = await readState();
    if (!state.hash) return true;
    const current = await computeDirHash();
    return current !== state.hash;
}

async function saveDeployHash(): Promise<void> {
    await writeState({ hash: await computeDirHash() });
}

let currentProcess: ReturnType<typeof Bun.spawn> | undefined;
process.on("SIGINT", () => {
    if (currentProcess) {
        currentProcess.kill();
    } else {
        process.exit();
    }
});

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
        try {
            await $`fly tokens create deploy -x 24h | podman login -u x --password-stdin registry.fly.io`.quiet();
        } catch (err) {
            console.error("Could not start session", err);
            process.exit(1);
        }
        console.log("Session started");
        break;
    } case "logout": {
        try {
            await $`fly tokens list | awk 'NR>2{ print $1 }' | xargs fly tokens revoke`.quiet()
        } catch (err) {
            console.error("Could not end session", err);
            process.exit(1);
        }

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
        const relFilePath = relative(gitRoot, resolve(originalCwd, filename));

        if (await hasChanges()) {
            console.log(`Changes detected. Deploying new function...`);
            try {
                await $`podman build -t flydo:latest --platform=linux/amd64 .`.quiet();
                await $`podman push flydo:latest registry.fly.io/flydo:latest`.quiet();
                await saveDeployHash();
            } catch (err) {
                console.error('Unable to deploy to fly');
                process.exit(2);
            }
        } else {
            console.log("No changes detected, skipping deploy.");
        }

        console.log(`Running function... `);
        currentProcess = Bun.spawn(["fly", "logs"], { stdout: "inherit", stderr: "inherit" });
        try {
            await $`fly machine run registry.fly.io/flydo:latest --rm --entrypoint="bun run ${relFilePath} ${args}"`.quiet();
        } catch (err) {
            console.error('Unable to run on fly');
            process.exit(2);
        }
        await currentProcess.exited;
        currentProcess = undefined;
        break;
    }
    default:
        if (command) {
            console.error(`Unknown command: ${command}`);
            process.exit(1);
        }
        printHelp();
}
