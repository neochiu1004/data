import fs from "node:fs";
import yaml from "js-yaml";
import { ScannerConfig } from "./types";

export function parseDatePool(inputStr: string): string[] {
  const parts = inputStr.split(/[,，\n]/).map((p) => p.trim()).filter(Boolean);
  const finalDates: string[] = [];

  for (const part of parts) {
    if (part.includes("~")) {
      const [startRaw, endRaw] = part.split("~").map((x) => x.trim());
      const curr = new Date(startRaw);
      const last = new Date(endRaw);
      if (Number.isNaN(curr.getTime()) || Number.isNaN(last.getTime())) {
        continue;
      }
      while (curr <= last) {
        finalDates.push(curr.toISOString().split("T")[0]);
        curr.setDate(curr.getDate() + 1);
      }
    } else {
      const d = new Date(part);
      if (!Number.isNaN(d.getTime())) {
        finalDates.push(d.toISOString().split("T")[0]);
      }
    }
  }

  return [...new Set(finalDates)].sort();
}

export function loadConfig(filePath: string): ScannerConfig {
  const raw = fs.readFileSync(filePath, "utf8");
  const data = yaml.load(raw) as Partial<ScannerConfig>;

  const cfg: ScannerConfig = {
    targetUrl: data.targetUrl ?? "https://inline.app/booking/",
    datePool: data.datePool ?? new Date().toISOString().split("T")[0],
    startHour: Number(data.startHour ?? 10),
    endHour: Number(data.endHour ?? 15),
    refreshIntervalSec: Number(data.refreshIntervalSec ?? 60),
    scanTimeoutMs: Number(data.scanTimeoutMs ?? 5000),
    maxSearchMonth: Number(data.maxSearchMonth ?? 4),
    adultNum: Number(data.adultNum ?? 2),
    autoSubmit: Number(data.autoSubmit ?? 0) as 0 | 1,
    telegram: data.telegram ?? {}
  };

  if (!cfg.targetUrl.startsWith("https://inline.app/booking/")) {
    throw new Error("targetUrl must start with https://inline.app/booking/");
  }
  if (cfg.startHour > cfg.endHour) {
    throw new Error("startHour cannot be greater than endHour");
  }

  return cfg;
}
