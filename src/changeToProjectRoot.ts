import { $ } from "bun";

export async function changeToProjectRoot() {
    try {
        const gitRoot = (await $`git rev-parse --show-toplevel`.quiet().text()).trim();
        process.chdir(gitRoot);
        return gitRoot;
    } catch {
        console.error("Not in a git repository");
        process.exit(1);
    }
}

