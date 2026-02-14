import { $ } from "bun";
import { readState, writeState } from "./state";
import { hasChanges, saveDeployHash } from "./changes";
import { getCurrentProcess, setCurrentProcess } from "./interruptions";

export async function login() {
    const state = await readState();
    const token = state['token'] || await $`fly tokens create deploy -x 24h`.text()
    await writeState({ token });
    try {
        await $`podman login -u x -p ${token} registry.fly.io`.quiet();
    } catch (err) {
        console.error("Could not login", err);
        process.exit(1);
    }
}

export async function logout() {
    await writeState({ token: null });
    try {
        await $`fly tokens list | awk 'NR>2{ print $1 }' | xargs fly tokens revoke`.quiet();
    } catch (err) {
        console.error("Could not logout", err);
        process.exit(1);
    }
}

export async function build() {
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
}

export async function run(filepath: string, args?: string[]) {
    console.log(`Running function... `);
    setCurrentProcess(Bun.spawn(["fly", "logs"], { stdout: "inherit", stderr: "inherit" }));
    try {
        await $`fly machine run registry.fly.io/flydo:latest --rm --entrypoint="bun run ${filepath} ${args}"`.quiet();
    } catch (err) {
        console.error('Unable to run on fly');
        process.exit(2);
    }
    await getCurrentProcess()!.exited;
    setCurrentProcess(undefined);
}
