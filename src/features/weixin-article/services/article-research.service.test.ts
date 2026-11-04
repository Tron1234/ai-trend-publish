import { assertEquals } from "@std/assert";
import type { ScrapedContent } from "@src/core/ports/content-scraper.ts";
import type { ArticleSource } from "@src/features/weixin-article/domain/article-source.ts";
import type { EditorialDecision } from "@src/features/weixin-article/domain/editorial-decision.ts";
import type { EditorialTopicReport } from "@src/features/weixin-article/domain/editorial-topic.ts";
import type {
  ArticleContentFetcher,
  ArticleContentFetchResult,
  ArticleContentHydrationResult,
} from "@src/features/weixin-article/services/content-scrape.service.ts";
import { WeixinArticleResearchService } from "./article-research.service.ts";

Deno.test("article research returns skipped pack when disabled", async () => {
  const service = new WeixinArticleResearchService(new EmptyFetcher(), {
    enabled: false,
    maxResearchQueries: 3,
    maxResultsPerQuery: 3,
    searchProviders: ["jina-search"],
  });

  const pack = await service.createEvidencePack({
    topicReport: topicReportFixture(),
    editorialDecision: decisionFixture(),
    contents: contentFixtures(),
  });

  assertEquals(pack.items.length, 0);
  assertEquals(pack.skippedReason, "未配置搜索能力，跳过补充证据");
});

Deno.test("article research filters noisy background evidence", async () => {
  const service = new WeixinArticleResearchService(new FakeFetcher(), {
    enabled: true,
    maxResearchQueries: 2,
    maxResultsPerQuery: 3,
    searchProviders: ["brave-search", "jina-search"],
  });

  const pack = await service.createEvidencePack({
    topicReport: topicReportFixture(),
    editorialDecision: decisionFixture(),
    contents: contentFixtures(),
  });

  assertEquals(pack.queries.length, 2);
  assertEquals(pack.items.length, 2);
  assertEquals(pack.items[0].sourceType, "official");
  assertEquals(pack.items[1].sourceType, "primary");
});

Deno.test("article research skips noisy candidates before hydration", async () => {
  const fetcher = new NoisyCandidateFetcher();
  const service = new WeixinArticleResearchService(fetcher, {
    enabled: true,
    maxResearchQueries: 1,
    maxResultsPerQuery: 4,
    searchProviders: ["jina-search"],
  });

  const pack = await service.createEvidencePack({
    topicReport: topicReportFixture(),
    editorialDecision: decisionFixture(),
    contents: contentFixtures(),
  });

  assertEquals(fetcher.hydratedUrls, ["https://www.mohurd.gov.cn/zhengce/wenjian/"]);
  assertEquals(pack.items.map((item) => item.url), [
    "https://www.mohurd.gov.cn/zhengce/wenjian/",
  ]);
});

Deno.test("article research rejects superficially official but unrelated evidence", async () => {
  const service = new WeixinArticleResearchService(
    new UnrelatedGithubFetcher(),
    {
      enabled: true,
      maxResearchQueries: 1,
      maxResultsPerQuery: 3,
      searchProviders: ["jina-search"],
    },
  );

  const pack = await service.createEvidencePack({
    topicReport: topicReportFixture(),
    editorialDecision: decisionFixture(),
    contents: contentFixtures(),
  });

  assertEquals(pack.items.map((item) => item.url), [
    "https://www.mohurd.gov.cn/zhengce/wenjian/",
  ]);
});

Deno.test("article research caps hydration attempts across queries", async () => {
  const fetcher = new ManyOfficialFetcher();
  const service = new WeixinArticleResearchService(fetcher, {
    enabled: true,
    maxResearchQueries: 3,
    maxResultsPerQuery: 3,
    maxHydrationCandidates: 1,
    searchProviders: ["jina-search"],
  });

  const pack = await service.createEvidencePack({
    topicReport: topicReportFixture(),
    editorialDecision: decisionFixture(),
    contents: contentFixtures(),
  });

  assertEquals(fetcher.hydratedUrls.length, 1);
  assertEquals(pack.items.length, 3);
});

class FakeFetcher implements ArticleContentFetcher {
  scrape(_source: ArticleSource): Promise<ArticleContentFetchResult> {
    return Promise.resolve({
      provider: "jina-search",
      failures: [],
      contents: [
        content("official", "https://www.mohurd.gov.cn/zhengce/wenjian/"),
        content("paper", "https://www.cnki.net/kcms/detail/11.0001.example.html"),
        {
          ...content("noise", "https://example.com/noise"),
          content: "short",
        },
      ],
    });
  }

  hydrate(content: ScrapedContent): Promise<ArticleContentHydrationResult> {
    return Promise.resolve({
      content: {
        ...content,
        content: `${content.content} hydrated detail `.repeat(20),
      },
      hydrated: true,
      provider: "jina",
      failures: [],
      originalContentLength: content.content.length,
      hydratedContentLength: content.content.length + 100,
    });
  }
}

class NoisyCandidateFetcher implements ArticleContentFetcher {
  hydratedUrls: string[] = [];

  scrape(_source: ArticleSource): Promise<ArticleContentFetchResult> {
    return Promise.resolve({
      provider: "jina-search",
      failures: [],
      contents: [
        content("official", "https://www.mohurd.gov.cn/zhengce/wenjian/"),
        content("zhihu", "https://zhuanlan.zhihu.com/p/2040317759591027222"),
        content("sina", "https://finance.sina.com.cn/stock/t/example.shtml"),
        content("youtube", "https://www.youtube.com/watch?v=abc"),
      ],
    });
  }

  hydrate(content: ScrapedContent): Promise<ArticleContentHydrationResult> {
    this.hydratedUrls.push(content.url);
    return Promise.resolve({
      content: {
        ...content,
        content: `${content.content} hydrated detail `.repeat(20),
      },
      hydrated: true,
      provider: "jina",
      failures: [],
      originalContentLength: content.content.length,
      hydratedContentLength: content.content.length + 100,
    });
  }
}

class ManyOfficialFetcher implements ArticleContentFetcher {
  hydratedUrls: string[] = [];

  scrape(_source: ArticleSource): Promise<ArticleContentFetchResult> {
    return Promise.resolve({
      provider: "jina-search",
      failures: [],
      contents: [
        content("official-a", "https://www.samr.gov.cn/zw/zfxxgk/a"),
        content("official-b", "https://www.samr.gov.cn/zw/zfxxgk/b"),
        content("official-c", "https://www.samr.gov.cn/zw/zfxxgk/c"),
      ],
    });
  }

  hydrate(content: ScrapedContent): Promise<ArticleContentHydrationResult> {
    this.hydratedUrls.push(content.url);
    return Promise.resolve({
      content: {
        ...content,
        content: `${content.content} hydrated detail `.repeat(20),
      },
      hydrated: true,
      provider: "jina",
      failures: [],
      originalContentLength: content.content.length,
      hydratedContentLength: content.content.length + 100,
    });
  }
}

class UnrelatedGithubFetcher implements ArticleContentFetcher {
  scrape(_source: ArticleSource): Promise<ArticleContentFetchResult> {
    return Promise.resolve({
      provider: "jina-search",
      failures: [],
      contents: [
        {
          ...content(
            "装修材料批发清单",
            "https://www.example-decor-supply.com/p/123",
          ),
          content:
            "装饰材料批发目录，只列出规格和报价，与本篇讨论的防水验收无关。",
        },
        content(
          "卫生间防水验收标准与闭水试验做法",
          "https://www.mohurd.gov.cn/zhengce/wenjian/",
        ),
      ],
    });
  }
}

class EmptyFetcher implements ArticleContentFetcher {
  scrape(): Promise<ArticleContentFetchResult> {
    return Promise.resolve({
      failures: [],
      contents: [],
    });
  }
}

function content(id: string, url: string): ScrapedContent {
  return {
    id,
    title: id,
    content:
      "卫生间防水验收需要在闭水试验完成后进行，并且要核对墙面与地面的衔接处理、地漏坡度和门口拦水条高度。闭水试验一般蓄水深度不少于二十毫米，持续二十四小时后到楼下对应位置观察有无渗漏痕迹。淋浴区墙面防水高度通常做到一点八米，其余墙面不低于三百毫米，管根和阴阳角要做附加层。地面防水层完成后应及时做保护层，避免后续工序破坏，验收时逐项记录并留存照片，发现问题要在贴砖前返修。",
    url,
    publishDate: "2026-05-24T00:00:00.000Z",
    metadata: { provider: "jina-search" },
  };
}

function topicReportFixture(): EditorialTopicReport {
  return {
    generatedAt: "2026-05-24T00:00:00.000Z",
    fallback: false,
    clusters: [{
      id: "topic-1",
      title: "卫生间防水验收",
      summary: "闭水试验与防水验收要点。",
      keywords: ["卫生间", "防水", "验收", "闭水试验"],
      articleIds: ["a1"],
      primaryArticleId: "a1",
      sourceCount: 1,
      freshness: 90,
      confidence: 80,
    }],
    scores: [{
      topicId: "topic-1",
      novelty: 80,
      relevance: 80,
      impact: 80,
      evidence: 70,
      actionability: 60,
      saturation: 20,
      risk: 20,
      finalScore: 80,
      reason: "值得关注",
      recommendedUse: "lead",
    }],
  };
}

function decisionFixture(): EditorialDecision {
  return {
    generatedAt: "2026-05-24T00:00:00.000Z",
    fallback: false,
    leadTopicId: "topic-1",
    leadTopicTitle: "卫生间防水验收",
    decisionSummary: "围绕卫生间防水验收成文。",
    whyThisNow: ["业主集中进入验收阶段"],
    selectedTopics: [{
      topicId: "topic-1",
      role: "lead",
      reason: "信息密度高",
    }],
    skippedTopics: [],
    duplicationRisk: {
      level: "low",
      reason: "暂无重复",
      avoidAngles: [],
    },
    sourceJudgements: [],
    recommendedFormat: "product-review",
    writingDirectives: [],
    titleWarnings: [],
  };
}

function contentFixtures(): ScrapedContent[] {
  return [{
    id: "a1",
    title: "卫生间防水验收",
    content: "闭水试验与防水验收要点。",
    url: "https://www.mohurd.gov.cn/zhengce/wenjian/",
    publishDate: "2026-05-24T00:00:00.000Z",
    metadata: {},
  }];
}
