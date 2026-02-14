import { resolve } from "path";
import { gitProjectRoot } from "./changeToProjectRoot";

export const STATE_FILE = resolve(await gitProjectRoot(), process.env.FLYDO_STATE_FILE || ".flydo");

export async function readState(): Promise<Record<string, string>> {
    const stateFile = Bun.file(STATE_FILE);
    if (!(await stateFile.exists())) return {};
    return await stateFile.json();
}

export async function writeState(updates: Record<string, string | null | undefined>): Promise<void> {
    const current = await readState();
    const withoutNullsAndUndefined = Object.fromEntries(Object.entries({ ...current, ...updates }).filter(([_, v]) => typeof v !== 'undefined' && v !== null))
    await Bun.write(STATE_FILE, JSON.stringify(withoutNullsAndUndefined, null, 2));
}


export const flyConfigFile = async () => (await readState()).flyConfigFile || 'fly.toml';
export const flyConfig = async () => {
    const configPath = await flyConfigFile();
    const data = Bun.TOML.parse(await Bun.file(configPath).text());
    return data as { app: string };
}
