import { $ } from "bun";
import { flyConfig, flyConfigFile, readState, writeState } from "./state";
import { hasChanges, saveDeployHash } from "./changes";
import { getCurrentProcess, setCurrentProcess } from "./interruptions";
import Dockerfile from '../Dockerfile' with { type: 'file' }
import dockerignore from '../.dockerignore' with { type: 'file' }
import tsconfig from '../tsconfig.json'
import { existsSync } from "fs";
import { mkdir } from "fs/promises";
import { resolve } from "path";
import { isQuiet } from "./quiet";

export async function validateFlyConfiguration() {
    try {
        let configLocationLine: string;
        for await (const line of $`fly config validate`.quiet(isQuiet).lines()) {
            configLocationLine = line;
            break;
        }
        const [, configLocation] = configLocationLine!.split(' ')
        return resolve(process.cwd(), configLocation || 'fly.toml');
    } catch (err) {
        console.error("Could not detect a valid fly config file");
        process.exit(99);
    }
}

export async function init(workdir: string, flyConfigFile: string) {
    if (!existsSync(workdir)) await mkdir(workdir);
    process.chdir(workdir);
    await writeState({ workdir, flyConfigFile });
    // copy docker files
    Bun.write('Dockerfile', Bun.file(Dockerfile));
    Bun.write('.dockerignore', Bun.file(dockerignore));
    // copy bun files
    Bun.write('tsconfig.json', JSON.stringify(tsconfig, null, 2));
    Bun.write('package.json', JSON.stringify({
        "name": "tasks",
        "module": "index.ts",
        "type": "module",
        "private": true,
        "devDependencies": {
            "@types/bun": "latest"
        },
        "peerDependencies": {
            "typescript": "^5"
        },
        "dependencies": {}
    }, null, 2));
    // create example file
    Bun.write('example.ts', 'console.log("Hello from a machine!")');

    await $`bun install`.quiet(isQuiet);
}

export async function login() {
    const state = await readState();
    const token = state['token'] || await $`fly tokens create deploy -x 24h -c ${await flyConfigFile()}`.text()
    await writeState({ token });
    try {
        await $`podman login -u x -p ${token} registry.fly.io`.quiet(isQuiet);
    } catch (err) {
        console.error("Could not login", err);
        process.exit(1);
    }
}

export async function logout() {
    await writeState({ token: null });
    try {
        await $`fly tokens list -c ${await flyConfigFile()}| awk 'NR>2{ print $1 }' | xargs fly tokens revoke`.quiet(isQuiet);
    } catch (err) {
        console.error("Could not logout", err);
        process.exit(1);
    }
}

const appImage = async () => {
    const { app } = await flyConfig();
    return {
        app,
        localImage: `${app}-tasks:latest`,
        remoteImage: `registry.fly.io/${app}:tasks`
    }
}

const missingMachineId = async () => {
    const { machineId } = await readState();
    return typeof machineId === 'undefined' || machineId === null;
}

export async function build() {
    const { localImage, remoteImage } = await appImage();

    const changed = await hasChanges();
    if (changed) {
        console.log(`Changes detected. Deploying new function...`);
        try {
            const { workdir } = await readState();
            process.chdir(workdir!);
            await $`podman build -t ${localImage} --platform=linux/amd64 .`.quiet(isQuiet);
            await $`podman push ${localImage} ${remoteImage}`.quiet(isQuiet);
            await saveDeployHash();
        } catch (err) {
            console.error('Unable to deploy to fly');
            process.exit(2);
        }
    } else {
        console.log("No changes detected, skipping deploy.");
    }

    const needsMachine = await missingMachineId();
    if (needsMachine) {
        const configFile = await flyConfigFile()
        try {
            const machineCreateResponse = await $`fly machine create ${remoteImage} -c ${configFile}`.quiet(isQuiet).text();
            const machineId = machineCreateResponse.match(/Machine ID: (?<id>.+)/)?.groups?.id!
            await writeState({ machineId });
        } catch (err) {
            console.error('Unable to deploy to fly');
            process.exit(2);
        }
    }
}

export async function run(filepath: string, args?: string[]) {
    console.log(`Running function... `);
    const { machineId } = await readState();
    if (await missingMachineId()) {
        console.error('Missing a machine on fly. Please build first.');
        process.exit(2);
    }

    const configFile = await flyConfigFile()
    const { remoteImage } = await appImage();
    setCurrentProcess(Bun.spawn(["fly", "logs", "-c", configFile, "--machine", machineId!], { stdout: "inherit", stderr: "inherit" }));
    try {
        await $`fly machine update ${machineId} -y --image ${remoteImage} --entrypoint="bun run ${filepath} ${args}" --restart no`.quiet(isQuiet);
    } catch (err) {
        console.error('Unable to run on fly');
        process.exit(2);
    }
    await getCurrentProcess()!.exited;
    setCurrentProcess(undefined);
}
