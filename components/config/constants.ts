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
//    PLACEHOLDER_GENERATING: "生成中...",
    PLACEHOLDER_PARSING: "解析中...",
//    BTN_GENERATE_IMAGE: "🎨 画像を生成",
//    BTN_GENERATE_VIDEO: "🎬 動画を生成",
//    BTN_SAVE_IMAGE: "💾 画像を保存",
    BTN_INSERT_EDITOR: "📝 エディタに挿入",
};

export const SYSTEM_PROMPTS = {
    BASE: `あなたは${APP_INFO.NAME}のAIアシスタントです。回答は必ず「日本語」で行ってください。絶対に英語を使わないでください。親しみやすく、丁寧な敬語を使ってください。`,
//    BASE: `あなたは${APP_INFO.NAME}のAIアシスタントです。回答は必ず日本語で行ってください。`,
//    EDITOR: `現在は【エディタモード】です。執筆中の文脈を理解し、内容の要約や推敲を支援してください。`,
//    IMAGE: `現在は【画像生成プロンプトモード】です。Stable Diffusion向けに、強調記号()を活用した英単語のタグ形式（Danbooruスタイル）でプロンプトを提案してください。プロンプトは必ずコードブロック内に記述してください。`,
//    VIDEO: `現在は【動画生成プロンプトモード】です。ComfyUI (Wan2.2) 向けに、シーンの動き、照明、カメラワークを詳細に描写した物語風の英文プロンプトを提案してください。プロンプトは必ずコードブロック内に記述してください。`,
};

// フェーズ2.5に向けたSD生成のデフォルトパラメータ
//export const DEFAULT_SD_PARAMS = {
//    steps: 20,
//    sampler_name: "Euler a",
//    cfg_scale: 7.0,
//    width: 512,
//    height: 512,
//    batch_size: 1,
//    batch_count: 1,   // ★追加: 直列生成（安全）
//    negative_prompt: "(worst quality, low quality:1.4)",
//    model: "",
//    vae: "Automatic", // ★追加: VAE指定
//    clip_skip: 1,     // ★追加: Clip Skip指定
//    lora: "",
//    lora_weight: 1.0,
//};

// フェーズ4に向けたComfyUI(動画)生成のデフォルトパラメータ
// ※OOM（メモリ不足）を防ぐため、初期値は少し軽めに設定しています
//export const DEFAULT_VIDEO_PARAMS = {
//    width: 480,
//    height: 480,
//    length: 33, // フレーム数 (33で約2秒)
//    batch_size: 1,
//    unet_high: "wan2.2_t2v_high_noise_14B_fp8_scaled.safetensors",
//    unet_low: "wan2.2_t2v_low_noise_14B_fp8_scaled.safetensors",
//    vae: "wan_2.1_vae.safetensors",
//    lora_high: "wan2.2_t2v_lightx2v_4steps_lora_v1.1_high_noise.safetensors",
//    lora_low: "wan2.2_t2v_lightx2v_4steps_lora_v1.1_low_noise.safetensors",
//    lora_weight: 1.0,
//};