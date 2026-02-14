import { $ } from "bun";

export async function gitProjectRoot() {
    try {
        return (await $`git rev-parse --show-toplevel`.quiet().text()).trim();
    } catch {
        console.error("Not in a git repository");
        process.exit(1);
    }
}

export async function changeToProjectRoot() {
    const gitRoot = await gitProjectRoot();
    process.chdir(gitRoot);
    return gitRoot;
}

