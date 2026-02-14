let currentProcess: ReturnType<typeof Bun.spawn> | undefined;

export function setupSigIntHandler() {
    process.on("SIGINT", () => {
        if (currentProcess) {
            currentProcess.kill();
        } else {
            process.exit();
        }
    });
}

export function setCurrentProcess(proc: Bun.Subprocess | undefined) {
    currentProcess = proc;
}

export function getCurrentProcess() {
    return currentProcess;
}
