import { TelegramConfig } from "./types";
import { log } from "./logger";

export async function sendTelegram(cfg: TelegramConfig | undefined, message: string): Promise<void> {
  if (!cfg?.botToken || !cfg.chatId) {
    return;
  }

  const url = `https://api.telegram.org/bot${cfg.botToken}/sendMessage?chat_id=${cfg.chatId}&text=${encodeURIComponent(message)}`;
  try {
    await fetch(url);
  } catch (error) {
    log.warn("Telegram send failed", { error: String(error) });
  }
}
