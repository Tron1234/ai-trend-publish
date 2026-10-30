import {
  ContentScraper,
  ScrapedContent,
} from "@src/core/ports/content-scraper.ts";

/**
 * 不经第三方服务直接读取公开网页的轻量抓取器。
 * 页面有登录、反爬或 JavaScript 渲染要求时会正常失败，由工作流继续处理其他源。
 */
export class DirectWebScraper implements ContentScraper {
  async scrape(sourceUrl: string): Promise<ScrapedContent[]> {
    const response = await fetch(sourceUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; TrendPublish/1.0)",
        "Accept": "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      throw new Error(`直连网页抓取失败: HTTP ${response.status}`);
    }

    const html = await response.text();
    const title = decodeHtml(
      firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i) ||
        new URL(sourceUrl).hostname,
    );
    const body = decodeHtml(
      html
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
        .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    );
    if (body.length < 80) {
      throw new Error("直连网页未提取到足够正文，页面可能需要登录或 JavaScript 渲染");
    }

    return [{
      id: `direct:${sourceUrl}`,
      title,
      content: body.slice(0, 24_000),
      url: sourceUrl,
      publishDate: new Date().toISOString(),
      metadata: { source: "direct" },
    }];
  }
}

function firstMatch(value: string, pattern: RegExp): string | undefined {
  return pattern.exec(value)?.[1]?.trim();
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)));
}
