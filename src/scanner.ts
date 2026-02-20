import path from "node:path";
import { chromium, BrowserContext, Page } from "playwright";
import { loadConfig, parseDatePool } from "./config";
import { HistoryStore } from "./historyStore";
import { log } from "./logger";
import { SELECTORS } from "./selectors";
import { CliOptions, ScannerConfig, ScannerState } from "./types";
import { backoffSeconds, ensureDir, jitter, nowTag, sleep } from "./utils";
import { sendTelegram } from "./telegram";

export class InlineScanner {
  private state: ScannerState = "INIT";
  private context!: BrowserContext;
  private page!: Page;
  private readonly config: ScannerConfig;
  private readonly targetDates: string[];
  private readonly history: HistoryStore;

  constructor(private readonly options: CliOptions) {
    this.config = loadConfig(options.config);
    this.targetDates = parseDatePool(this.config.datePool);
    this.history = new HistoryStore(path.join(options.profile, ".scan-history.json"));
    ensureDir("screenshots");
    ensureDir(options.profile);
  }

  async run(): Promise<void> {
    await this.launch();
    let attempt = 0;

    while (true) {
      try {
        await this.scanOnce();
        if (!this.options.loop) break;
        log.info(`Loop waiting ${this.config.refreshIntervalSec}s before next round`);
        await sleep(jitter(this.config.refreshIntervalSec * 1000, 0.1));
        attempt = 0;
      } catch (error) {
        const shot = await this.capture(`error-${nowTag()}`);
        log.error("scan cycle failed", { error: String(error), screenshot: shot });
        await sendTelegram(this.config.telegram, `❌ 掃描錯誤：${String(error)}\nScreenshot: ${shot}`);
        const backoff = backoffSeconds(attempt++);
        this.transition("RETRY");
        await sleep(jitter(backoff * 1000));
        if (!this.options.loop) throw error;
      }
    }

    if (!this.options.loop) {
      await this.context.close();
    }
  }

  private async launch(): Promise<void> {
    this.transition("OPEN_PAGE");
    this.context = await chromium.launchPersistentContext(this.options.profile, {
      headless: this.options.headless,
      viewport: { width: 1366, height: 900 }
    });
    this.page = this.context.pages()[0] ?? (await this.context.newPage());
  }

  async scanOnce(): Promise<void> {
    this.transition("OPEN_PAGE");
    await this.page.goto(this.config.targetUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await this.handleCaptchaIfNeeded();

    await this.ensureAdultNum();
    await this.openCalendar();
    const picked = await this.scanAcrossMonths();

    if (!picked) {
      this.transition("DONE");
      log.info("No matching slot found in this cycle");
    }
  }

  private async ensureAdultNum(): Promise<void> {
    const picker = this.page.locator("#adult-picker");
    if ((await picker.count()) === 0) return;
    await picker.first().waitFor({ state: "visible", timeout: 5_000 });
    const current = await picker.inputValue();
    if (current !== String(this.config.adultNum)) {
      await picker.selectOption(String(this.config.adultNum));
      await sleep(jitter(1200));
      log.info("Adult number updated", { adultNum: this.config.adultNum });
    }
  }

  private async openCalendar(): Promise<void> {
    this.transition("OPEN_CALENDAR");
    const opener = this.page.locator(SELECTORS.openDatePicker).first();
    await this.expectVisible(opener, 10_000, "date picker opener");
    await opener.click({ timeout: 10_000 });
    await this.page.locator(SELECTORS.calendarDayButtons).first().waitFor({ state: "visible", timeout: 10_000 });
  }

  private async scanAcrossMonths(): Promise<boolean> {
    this.transition("SCAN");
    const today = new Date().toISOString().split("T")[0];

    for (let monthIdx = 0; monthIdx < this.config.maxSearchMonth; monthIdx++) {
      await this.handleCaptchaIfNeeded();
      const availableDays = this.page.locator(SELECTORS.calendarDayButtons);
      const count = await availableDays.count();

      for (let i = 0; i < count; i++) {
        const day = availableDays.nth(i);
        const dateStr = await day.getAttribute("data-date");
        if (!dateStr || !this.targetDates.includes(dateStr)) continue;

        const disabled = (await day.getAttribute("disabled")) !== null;
        if (disabled && dateStr !== today) continue;

        this.transition("PICK");
        await day.click({ timeout: 10_000 });
        await sleep(jitter(500));

        const result = await this.scanSlotsForDate(dateStr);
        if (result) return true;
      }

      const nextMonth = this.page.locator(SELECTORS.nextMonth).first();
      if (monthIdx < this.config.maxSearchMonth - 1 && (await nextMonth.count()) > 0) {
        await nextMonth.click({ timeout: 10_000 });
        await sleep(jitter(800));
      } else {
        break;
      }
    }

    return false;
  }

  private async scanSlotsForDate(dateStr: string): Promise<boolean> {
    const started = Date.now();

    while (Date.now() - started < this.config.scanTimeoutMs) {
      await this.handleCaptchaIfNeeded();

      const slots = this.page.locator(SELECTORS.timeSlotButtons);
      const count = await slots.count();
      for (let i = 0; i < count; i++) {
        const slot = slots.nth(i);
        if (!(await slot.isVisible())) continue;
        if (await slot.isDisabled()) continue;

        const cls = (await slot.getAttribute("class")) ?? "";
        if (cls.includes("bg-grey-100")) continue;

        const rawDataCy = (await slot.getAttribute("data-cy")) ?? "";
        const rawText = (await slot.innerText()).trim();
        const parsed = parseTime(rawDataCy) ?? parseTime(rawText);
        if (!parsed) continue;

        const [hour, minute] = parsed;
        const key = `${dateStr}|${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
        if (this.history.has(key)) continue;

        const total = hour * 60 + minute;
        if (total < this.config.startHour * 60 || total > this.config.endHour * 60) {
          continue;
        }

        this.history.add(key);
        await slot.click({ timeout: 10_000 });
        return this.confirmFlow(dateStr, `${hour}:${minute.toString().padStart(2, "0")}`);
      }

      await sleep(jitter(250, 0.15));
    }

    return false;
  }

  private async confirmFlow(dateStr: string, timeStr: string): Promise<boolean> {
    this.transition("CONFIRM");
    const deadline = Date.now() + 10_000;

    while (Date.now() < deadline) {
      const nextButton = this.page
        .locator("span, button")
        .filter({ hasText: /完成預訂|下一步/ })
        .first();
      if ((await nextButton.count()) > 0) {
        await nextButton.click({ timeout: 3000 }).catch(() => undefined);
      }

      const submit = this.page.locator(SELECTORS.submit).first();
      if ((await submit.count()) > 0 && !(await submit.isDisabled())) {
        if (this.config.autoSubmit === 1) {
          await submit.click({ timeout: 5000 });
        }

        const info = await this.readReservationInfo();
        const text = info ?? `\n📅 ${dateStr}\n⏰ ${timeStr}`;
        await sendTelegram(
          this.config.telegram,
          `🎯 訂位成功！${text}\n狀態：${this.config.autoSubmit === 1 ? "已自動提交" : "等待手動確認"}`
        );
        this.transition("DONE");
        return true;
      }

      await sleep(400);
    }

    return false;
  }

  private async readReservationInfo(): Promise<string | null> {
    const pax = (await this.page.locator(SELECTORS.reservationPax).first().textContent().catch(() => null))?.trim();
    const date = (await this.page.locator(SELECTORS.reservationDate).first().textContent().catch(() => null))?.trim();
    const time = (await this.page.locator(SELECTORS.reservationTime).first().textContent().catch(() => null))?.trim();

    if (pax && date && time) {
      return `\n👥 ${pax}\n📅 ${date}\n⏰ ${time}`;
    }

    return null;
  }

  private async handleCaptchaIfNeeded(): Promise<void> {
    const captcha = this.page.locator(SELECTORS.captcha).first();
    if ((await captcha.count()) === 0) {
      return;
    }

    this.transition("NEED_HUMAN");
    const shot = await this.capture(`captcha-${nowTag()}`);
    await sendTelegram(this.config.telegram, `⚠️ 偵測到 CAPTCHA，請手動處理。\nScreenshot: ${shot}`);
    log.warn("Captcha detected, waiting for manual solve", { screenshot: shot });

    while ((await captcha.count()) > 0) {
      await sleep(1000);
    }

    log.info("Captcha disappeared; resuming workflow");
    this.transition("SCAN");
  }

  private async expectVisible(locator: ReturnType<Page["locator"]>, timeoutMs: number, label: string): Promise<void> {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
      if (await locator.isVisible().catch(() => false)) return;
      await sleep(100);
    }
    throw new Error(`Timeout waiting for ${label} to be visible`);
  }

  private transition(next: ScannerState): void {
    log.state(this.state, next);
    this.state = next;
  }

  private async capture(name: string): Promise<string> {
    const filePath = path.resolve("screenshots", `${name}.png`);
    await this.page?.screenshot({ path: filePath, fullPage: true }).catch(() => undefined);
    return filePath;
  }
}

function parseTime(source: string): [number, number] | null {
  const match = source.match(/-(\d{1,2})-(\d{2})$/) ?? source.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return [hour, minute];
}
