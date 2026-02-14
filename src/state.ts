export const STATE_FILE = process.env.FLYDO_STATE_FILE || ".flydo";

export async function readState(): Promise<Record<string, string>> {
    const stateFile = Bun.file(STATE_FILE);
    if (!(await stateFile.exists())) return {};
    return JSON.parse(await stateFile.text());
}

export async function writeState(updates: Record<string, string | null | undefined>): Promise<void> {
    const current = await readState();
    const withoutNullsAndUndefined = Object.fromEntries(Object.entries({ ...current, ...updates }).filter(([_, v]) => typeof v !== 'undefined' && v !== null))
    await Bun.write(STATE_FILE, JSON.stringify(withoutNullsAndUndefined, null, 2));
}


