import fs from "node:fs";

export class HistoryStore {
  private readonly seen = new Set<string>();

  constructor(private readonly filePath?: string) {
    if (!filePath) return;
    try {
      if (fs.existsSync(filePath)) {
        const arr = JSON.parse(fs.readFileSync(filePath, "utf8")) as string[];
        arr.forEach((v) => this.seen.add(v));
      }
    } catch {
      // no-op, continue with empty memory state
    }
  }

  has(key: string): boolean {
    return this.seen.has(key);
  }

  add(key: string): void {
    this.seen.add(key);
    this.flush();
  }

  private flush(): void {
    if (!this.filePath) return;
    fs.writeFileSync(this.filePath, JSON.stringify([...this.seen], null, 2));
  }
}
