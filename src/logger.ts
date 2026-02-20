import { ScannerState } from "./types";

function ts(): string {
  return new Date().toISOString();
}

export const log = {
  info: (msg: string, meta?: Record<string, unknown>) => {
    console.log(`[${ts()}] [INFO] ${msg}`, meta ?? "");
  },
  warn: (msg: string, meta?: Record<string, unknown>) => {
    console.warn(`[${ts()}] [WARN] ${msg}`, meta ?? "");
  },
  error: (msg: string, meta?: Record<string, unknown>) => {
    console.error(`[${ts()}] [ERROR] ${msg}`, meta ?? "");
  },
  state: (from: ScannerState, to: ScannerState) => {
    console.log(`[${ts()}] [STATE] ${from} -> ${to}`);
  }
};
