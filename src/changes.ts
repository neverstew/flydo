import { STATE_FILE, readState, writeState } from "./state";

async function computeDirHash(): Promise<string> {
    const hasher = new Bun.CryptoHasher("sha256");
    const files: string[] = [];
    const { workdir } = await readState();
    for await (const file of new Bun.Glob(`${workdir}/**/*`).scan({ dot: true, onlyFiles: true })) {
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

export async function hasChanges(): Promise<boolean> {
    const state = await readState();
    if (!state.hash) return true;
    const current = await computeDirHash();
    return current !== state.hash;
}

export async function saveDeployHash(): Promise<void> {
    await writeState({ hash: await computeDirHash() });
}


