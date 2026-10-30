import {
  ArticleImageProvider,
  ArticleNotificationChannel,
  ArticleTemplateType,
  defineConfig,
} from "@src/utils/config/define-config.ts";
import { PromptProfileName } from "./src/prompts/prompt-profile.ts";

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function booleanValue(value: string, fallback: boolean): boolean {
  if (!value) return fallback;
  return value === "true" || value === "1";
}

export default defineConfig((runtime) => {
  const notificationChannels = splitList(
    runtime.value("NOTIFICATION_CHANNELS", ""),
  ) as ArticleNotificationChannel[];
  const coverProvider = runtime.value(
    "COVER_PROVIDER",
    "dashscope",
  ) as ArticleImageProvider;
  const bodyImagesProvider = runtime.value(
    "BODY_IMAGES_PROVIDER",
    "dashscope",
  ) as ArticleImageProvider;
  const weixinRelayUrl = runtime.secret("WEIXIN_RELAY_URL");
  const weixinRelayToken = runtime.secret("WEIXIN_RELAY_TOKEN");
  const configuredPublishProvider = runtime.value(
    "WEIXIN_PUBLISH_PROVIDER",
    "",
  );
  const weixinAccountId = runtime.value("WEIXIN_ACCOUNT_ID", "");
  const articlePublishProvider = weixinRelayUrl && weixinRelayToken
    ? "weixin-relay"
    : (configuredPublishProvider || "weixin") as "weixin" | "weixin-relay";

  return {
    server: {
      apiKey: runtime.required("SERVER_API_KEY"),
      port: 8000,
    },

    providers: {
      ai: {
        baseUrl: runtime.value("AI_BASE_URL", "https://api.deepseek.com/v1"),
        apiKey: runtime.required("AI_API_KEY"),
        model: runtime.value("AI_MODEL", "deepseek-chat"),
        timeoutMs: Number(runtime.value("AI_TIMEOUT_MS", "300000")),
        maxAttempts: Number(runtime.value("AI_MAX_ATTEMPTS", "2")),
      },
      image: {
        dashscope: {
          apiKey: runtime.secret("DASHSCOPE_API_KEY"),
        },
        minimax: {
          apiKey: runtime.secret("MINIMAX_API_KEY"),
          apiHost: runtime.value("MINIMAX_API_HOST", "https://api.minimax.io"),
        },
      },
      publish: {
        weixin: {
          appId: runtime.secret("WEIXIN_APP_ID"),
          appSecret: runtime.secret("WEIXIN_APP_SECRET"),
          author: runtime.value("WEIXIN_AUTHOR", "筑家录"),
          needOpenComment: booleanValue(
            runtime.value("WEIXIN_NEED_OPEN_COMMENT", ""),
            true,
          ),
          onlyFansCanComment: booleanValue(
            runtime.value("WEIXIN_ONLY_FANS_CAN_COMMENT", ""),
            false,
          ),
        },
        weixinRelay: {
          url: weixinRelayUrl,
          token: weixinRelayToken,
        },
      },
      notify: {
        bark: {
          url: runtime.secret("BARK_URL"),
        },
        dingtalk: {
          webhook: runtime.secret("DINGTALK_WEBHOOK"),
        },
        feishu: {
          webhookUrl: runtime.secret("FEISHU_WEBHOOK_URL"),
        },
      },
    },

    fetchGroups: { default: ["direct"], domestic: ["direct"] },

    features: {
      article: {
        sources: splitList(
          runtime.value(
            "ARTICLE_SOURCES",
            "domestic:https://www.0x08.org/posts/interior-decorating-material,domestic:https://www.100.com.tw/article,domestic:https://www.zhihu.com/people/xiao-ling-xia-15/posts,domestic:https://www.zhihu.com/people/shi-letian,domestic:https://www.zhihu.com/search?type=content&q=%E8%A3%85%E4%BF%AE",
          ),
        ),
        publisher: {
          provider: articlePublishProvider,
          accountId: weixinAccountId,
        },
        renderer: {
          template: runtime.value(
            "ARTICLE_RENDERER_TEMPLATE",
            "dynamic",
          ) as ArticleTemplateType,
          promptProfile: runtime.value(
            "ARTICLE_PROMPT_PROFILE",
            "interior",
          ) as PromptProfileName,
        },
        count: Number(runtime.value("ARTICLE_COUNT", "10")),
        dryRun: false,
        notifications: {
          channels: notificationChannels,
        },
        cover: {
          enabled: booleanValue(runtime.value("COVER_ENABLED", ""), true),
          provider: coverProvider,
          model: runtime.value(
            "COVER_MODEL",
            "qwen-image-2.0-pro",
          ),
        },
        bodyImages: {
          mode: runtime.value("BODY_IMAGES_MODE", "off") as
            | "off"
            | "missing"
            | "all",
          provider: bodyImagesProvider,
          model: runtime.value("BODY_IMAGES_MODEL", "qwen-image-2.0"),
          count: Number(runtime.value("BODY_IMAGES_COUNT", "1")),
          size: runtime.value(
            "BODY_IMAGES_SIZE",
            "1024*1024",
          ) as `${number}*${number}`,
        },
        deduplication: {
          enabled: false,
          embeddingProvider: "dashscope",
          vectorStore: "d1",
        },
        qualityGate: {
          forcePublish: true,
        },
      },
    },

    storage: {
      artifacts: {
        provider: "kv",
        bucketBinding: "ARTICLE_RUNS",
      },
      runState: {
        provider: "kv-d1",
        kvBinding: "ARTICLE_RUNS",
        d1Binding: "ARTICLE_DB",
      },
      runtimeConfig: {
        provider: "d1",
        d1Binding: "ARTICLE_DB",
      },
      vector: {
        provider: "d1",
        d1Binding: "ARTICLE_DB",
      },
    },
  };
});
