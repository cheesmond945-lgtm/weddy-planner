import { Injectable, Logger } from '@nestjs/common';

/** Model chính (nhanh, hợp văn bản ngắn) và model dự phòng khi model chính quá tải (503). Đổi bằng GEMINI_MODEL / GEMINI_FALLBACK_MODEL. */
const DEFAULT_MODEL = 'gemini-3.1-flash-lite';
const DEFAULT_FALLBACK = 'gemini-3.5-flash';
const TIMEOUT_MS = 20_000;
/** Độ dài tối đa của đoạn văn trả về (giới hạn của ô mô tả là 3000 ký tự). */
const MAX_CHARS = 1500;

/**
 * Viết văn bản bằng Gemini (REST generateContent, khóa trong GEMINI_API_KEY).
 * Thiếu khóa hoặc cả hai model đều lỗi thì trả null để nơi gọi dùng đoạn mẫu, không làm hỏng thao tác của người dùng.
 */
@Injectable()
export class GeminiService {
  private readonly log = new Logger(GeminiService.name);

  get configured() {
    return !!process.env.GEMINI_API_KEY?.trim();
  }

  private async call(model: string, system: string, prompt: string, temperature: number): Promise<string> {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY!.trim() },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature, maxOutputTokens: 2048 },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] };
    // Bỏ phần "suy nghĩ" của model (nếu có), chỉ lấy câu trả lời
    const text = body.candidates?.[0]?.content?.parts?.filter((p) => !p.thought).map((p) => p.text ?? '').join('').trim();
    if (!text) throw new Error('Gemini không trả nội dung');
    // Một số model suy luận lẫn việc đếm từ "(12) (13)..." vào câu trả lời: coi là hỏng để chuyển sang model khác / đoạn mẫu
    if ((text.match(/\(\d{1,3}\)/g) ?? []).length >= 3) throw new Error('Nội dung lẫn phần đếm từ');
    return text;
  }

  /** Bỏ định dạng markdown, dấu ngoặc kép bao quanh, gộp dòng; cắt ở cuối câu nếu quá dài. */
  private clean(text: string) {
    let t = text.replace(/[*_`#>]+/g, '').replace(/\s*\n+\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
    t = t.replace(/^["“”']+|["“”']+$/g, '').trim();
    if (t.length > MAX_CHARS) {
      const cut = t.slice(0, MAX_CHARS);
      const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
      t = end > MAX_CHARS * 0.5 ? cut.slice(0, end + 1) : `${cut.trimEnd()}…`;
    }
    return t;
  }

  /** Trả đoạn văn đã làm sạch, hoặc null khi không dùng được AI. */
  async write(system: string, prompt: string, temperature = 0.8): Promise<string | null> {
    if (!this.configured) return null;
    const models = [process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL, process.env.GEMINI_FALLBACK_MODEL?.trim() || DEFAULT_FALLBACK];
    for (const model of [...new Set(models)]) {
      try {
        const text = this.clean(await this.call(model, system, prompt, temperature));
        if (text) return text;
      } catch (e) {
        this.log.warn(`Gemini (${model}) lỗi: ${(e as Error).message}`);
      }
    }
    return null;
  }
}
