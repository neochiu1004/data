import fs from "node:fs";
import path from "node:path";

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function jitter(baseMs: number, ratio = 0.2): number {
  const delta = Math.floor(baseMs * ratio);
  return baseMs + Math.floor((Math.random() * 2 - 1) * delta);
}

export function backoffSeconds(attempt: number): number {
  const steps = [1, 2, 5, 10];
  return steps[Math.min(attempt, steps.length - 1)];
}

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function nowTag(): string {
  const d = new Date();
  return d.toISOString().replace(/[.:]/g, "-");
}

export function resolvePath(...parts: string[]): string {
  return path.resolve(process.cwd(), ...parts);
}
