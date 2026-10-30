import { assertEquals, assertStringIncludes } from "@std/assert";
import { DirectWebScraper } from "./direct-web-scraper.ts";

Deno.test("DirectWebScraper extracts readable text without a third-party service", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() => Promise.resolve(new Response(
    (
      "<html><head><title>装修验收清单</title></head><body>" +
      "<script>ignore()</script><main>卫生间防水验收要检查闭水试验，并确认墙面与地面的衔接处理；验收前还应核对门槛石、地漏坡度、阴阳角和管根等细部是否符合设计要求，避免后续渗漏。</main>" +
      "</body></html>"
    ).repeat(2),
  ))) as typeof fetch;

  try {
    const [content] = await new DirectWebScraper().scrape(
      "https://example.cn/article",
    );
    assertEquals(content.title, "装修验收清单");
    assertStringIncludes(content.content, "闭水试验");
    assertEquals(content.metadata.source, "direct");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
