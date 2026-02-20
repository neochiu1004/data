# Inline Booking Scanner (Node.js + TypeScript + Playwright)

從 Tampermonkey userscript 移植成可在 macOS Apple Silicon（MacBook Air M1）長時間本機執行的 CLI 工具。

## 專案結構

```text
.
├── config.yaml
├── package.json
├── tsconfig.json
├── screenshots/
└── src/
    ├── cli.ts
    ├── config.ts
    ├── historyStore.ts
    ├── logger.ts
    ├── scanner.ts
    ├── selectors.ts
    ├── telegram.ts
    ├── types.ts
    └── utils.ts
```

## 必要環境

- Node.js 20+
- macOS (Apple Silicon 可直接使用)

## 安裝

```bash
npm install
npx playwright install chromium
```

## 第一次登入（保留登入狀態）

先用 headful 模式開啟並手動登入 Inline，登入狀態會保存在 `--profile` 目錄：

```bash
npm run dev -- --config config.yaml --headful --profile .profile-inline
```

登入完成後可以直接關閉工具，下次會沿用同一個 profile。

## 執行方式

### 常駐掃描（loop）

```bash
npm start -- --config config.yaml --headful --profile .profile-inline
# 等價：node dist/cli.js --loop ...
```

### 只跑一次

```bash
npm run run:once -- --config config.yaml --headful --profile .profile-inline
# 等價：node dist/cli.js run:once ...
```

### Headless

```bash
node dist/cli.js --loop --headless --config config.yaml --profile .profile-inline
```

## CLI 參數

- `--config <path>`: 指定 YAML 設定檔
- `--headful`: 顯示瀏覽器
- `--headless`: 無頭模式
- `--loop`: 常駐掃描
- `run:once`: 單次掃描模式
- `--profile <dir>`: Playwright persistent context 目錄（保存登入）

## 設定檔（config.yaml）

- `targetUrl`: 目標網址，需為 `https://inline.app/booking/*`
- `datePool`: 日期池（單日、逗號、多行、區間 `A~B`）
- `startHour`, `endHour`: 時段過濾
- `refreshIntervalSec`: loop 週期間隔
- `scanTimeoutMs`: 每次日期掃描超時
- `maxSearchMonth`: 跨月掃描上限
- `adultNum`: 大人人數
- `autoSubmit`: `0/1`
- `telegram.botToken`, `telegram.chatId`: 可選通知

## 流程與穩定性

- 狀態機：`INIT/OPEN_PAGE/OPEN_CALENDAR/SCAN/PICK/CONFIRM/DONE/RETRY/NEED_HUMAN`
- 使用 locator + timeout（關鍵步驟含 `expect`）
- 內建 jitter 與 backoff（1/2/5/10 秒）
- 對 `date+timeslot` 做去重（寫入 `profile/.scan-history.json`）
- 錯誤與 captcha 都會截圖到 `screenshots/` 並輸出 log
- 偵測 captcha（`.px-captcha-container`）時進入 `NEED_HUMAN`：
  - 發送 Telegram（若有設定）
  - 保持瀏覽器等待手動處理
  - captcha 消失後自動恢復流程

## 長時間執行建議（macOS）

- 防止睡眠：

```bash
caffeinate -dimsu npm start -- --config config.yaml --headful --profile .profile-inline
```

- 用 PM2 管理：

```bash
npm install -g pm2
pm2 start "npm start -- --config config.yaml --headless --profile .profile-inline" --name inline-scanner
pm2 save
pm2 startup
```

- 用 launchd：將啟動命令寫成 plist，設定開機自啟與崩潰重啟。

## scripts

- `npm run dev`: tsx 直接執行（預設 headful+loop）
- `npm run build`: 編譯 TypeScript 到 `dist/`
- `npm start`: 執行編譯後 CLI（預設 loop）
- `npm run run:once`: 單次掃描

## 沿用的 selectors（集中於 `src/selectors.ts`）

- captcha: `.px-captcha-container`
- open date picker: `#date-picker, [data-cy="date-picker"]`
- calendar day buttons: `div[data-cy="bt-cal-day"]`
- next month: `a.nextMonth`
- time slot buttons: `button[data-cy^="book-now-time-slot-box-"], button[class*="time-slot"]`
- submit: `button[type="submit"][data-cy="submit"]`
- reservation info:
  - `[aria-label="reservation pax"]`
  - `[aria-label="reservation date"]`
  - `[aria-label="reservation time"]`
