/**
 * AHME 統合設定ファイル
 * アプリケーション全体の文言、プロンプト、デフォルトパラメータを管理します。
 */

export const APP_INFO = {
    NAME: "AHME",
    ASSISTANT_NAME: "AI Assistant",
    VERSION: "1.2.0",
};

export const UI_TEXT = {
    PLACEHOLDER_DEFAULT: "AIに質問する (Shift+Enter送信) / ファイル・画像D&D対応",
    PLACEHOLDER_PARSING: "解析中...",
    BTN_INSERT_EDITOR: "📝 エディタに挿入",
};

export const SYSTEM_PROMPTS = {
    BASE: `あなたは${APP_INFO.NAME}のAIアシスタントです。回答は必ず「日本語」で行ってください。絶対に英語を使わないでください。親しみやすく、丁寧な敬語を使ってください。`,
};