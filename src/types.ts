export type ScannerState =
  | "INIT"
  | "OPEN_PAGE"
  | "OPEN_CALENDAR"
  | "SCAN"
  | "PICK"
  | "CONFIRM"
  | "DONE"
  | "RETRY"
  | "NEED_HUMAN";

export interface TelegramConfig {
  botToken?: string;
  chatId?: string;
}

export interface ScannerConfig {
  targetUrl: string;
  datePool: string;
  startHour: number;
  endHour: number;
  refreshIntervalSec: number;
  scanTimeoutMs: number;
  maxSearchMonth: number;
  adultNum: number;
  autoSubmit: 0 | 1;
  telegram?: TelegramConfig;
}

export interface CliOptions {
  config: string;
  headless: boolean;
  loop: boolean;
  profile: string;
}
