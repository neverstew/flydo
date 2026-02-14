import { $ } from "bun";
import { parseArgs } from "util";

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
  session start    Begin a session
  session stop     End a session
  run <file>       Run a particular file remotely

Options:
  --help, -h      Show this help message`);
}

if (values.help) {
    printHelp();
    process.exit(0);
}

const [, , command, ...rest] = positionals;

switch (command) {
    case "session": {
        const [subcommand] = rest;
        switch (subcommand) {
            case "start":
                try {
                    await $`fly tokens create deploy -x 24h | podman login -u x --password-stdin registry.fly.io`.quiet();
                } catch (err) {
                    console.error("Could not start session", err);
                    process.exit(1);
                }
                console.log("Session started");
                break;
            case "stop":
                try {
                    await $`fly tokens list | awk 'NR>2{ print $1 }' | xargs fly tokens revoke`.quiet()
                } catch (err) {
                    console.error("Could not end session", err);
                    process.exit(1);
                }

                console.log("Session stopped");
                break;
            default:
                if (subcommand) {
                    console.error(`Unknown subcommand: session ${subcommand}`);
                    process.exit(1);
                }
                console.log("Usage: bun index.ts session <start|stop>");
        }
        break;
    }
    case 'run': {
        const [filename] = rest;
        if (!filename) {
            console.error('Unable to parse input for run command');
            printHelp();
            process.exit(2);
        }

        console.log(`Deploying function...`);
        try {
            await $`podman build -t flydo:latest --platform=linux/amd64 .`.quiet();
            await $`podman push flydo:latest registry.fly.io/flydo:latest`.quiet();
        } catch (err) {
            console.error('Unable to deploy to fly');
            process.exit(2);
        }

        console.log(`Running function... `);
        currentProcess = Bun.spawn(["fly", "logs"], { stdout: "inherit", stderr: "inherit" });
        try {
            await $`fly machine run registry.fly.io/flydo:latest --rm --entrypoint="bun run ${filename}"`.quiet();
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
