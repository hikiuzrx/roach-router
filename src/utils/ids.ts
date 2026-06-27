export const newChatId = (): string =>
  `chatcmpl-${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
