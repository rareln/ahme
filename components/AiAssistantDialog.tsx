"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { X, RotateCcw, Download, Loader2, CheckCircle, AlertCircle, Search } from "lucide-react";
import { SYSTEM_PROMPTS } from "./config/constants";

/** システムプロンプトのキーとラベルのマッピング（AHMEはBASEのみ） */
const PROMPT_ENTRIES: { key: keyof typeof SYSTEM_PROMPTS; label: string; description: string }[] = [
    { key: "BASE", label: "ベース（共通）", description: "AIアシスタントの基本的な振る舞いを定義するプロンプト" },
];

/** 人気モデルのサジェストリスト */
const POPULAR_MODELS = [
    { name: "gemma3:4b", description: "Google Gemma 3 4B - 軽量・高性能" },
    { name: "gemma3:12b", description: "Google Gemma 3 12B - バランス型" },
    { name: "gemma3:27b", description: "Google Gemma 3 27B - 高精度" },
    { name: "llama3:8b", description: "Meta Llama 3 8B - 汎用" },
    { name: "llama3.3:70b", description: "Meta Llama 3.3 70B - 大規模" },
    { name: "qwen2.5:7b", description: "Alibaba Qwen 2.5 7B" },
    { name: "qwen2.5:14b", description: "Alibaba Qwen 2.5 14B" },
    { name: "qwen2.5:32b", description: "Alibaba Qwen 2.5 32B" },
    { name: "qwq:32b", description: "Alibaba QwQ 32B - 推論特化" },
    { name: "deepseek-r1:14b", description: "DeepSeek R1 14B - 推論特化" },
    { name: "deepseek-r1:32b", description: "DeepSeek R1 32B - 推論特化" },
    { name: "phi4:14b", description: "Microsoft Phi-4 14B" },
    { name: "mistral:7b", description: "Mistral 7B - 高速" },
    { name: "codellama:13b", description: "Code Llama 13B - コード特化" },
    { name: "llava:13b", description: "LLaVA 13B - 画像理解" },
    { name: "command-r:35b", description: "Cohere - RAG/検索向け" },
];

const STORAGE_KEY = "ahme-custom-system-prompts";

export type CustomPrompts = Record<string, string>;

/** カスタムプロンプトをlocalStorageから取得 */
export function loadCustomPrompts(): CustomPrompts {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        return JSON.parse(raw);
    } catch { return {}; }
}

/** カスタムプロンプトをlocalStorageに保存 */
function saveCustomPrompts(prompts: CustomPrompts) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(prompts));
    } catch (e) {
        console.error("カスタムプロンプト保存エラー:", e);
    }
}

/** カスタムプロンプト → 実際のシステムプロンプトを返す */
export function getEffectivePrompt(key: string): string {
    const custom = loadCustomPrompts();
    if (custom[key] && custom[key].trim().length > 0) {
        return custom[key];
    }
    return (SYSTEM_PROMPTS as Record<string, string>)[key] ?? "";
}

// ========================================
// ダウンロード進捗のグローバル状態（ダイアログを閉じても維持）
// ========================================
interface DownloadState {
    isDownloading: boolean;
    modelName: string;
    progress: string;
    percent: number;
    error: string | null;
    success: boolean;
}

let globalDownloadState: DownloadState = {
    isDownloading: false,
    modelName: "",
    progress: "",
    percent: 0,
    error: null,
    success: false,
};
let globalAbortController: AbortController | null = null;
const downloadListeners = new Set<() => void>();

function notifyDownloadListeners() {
    downloadListeners.forEach(fn => fn());
}

function updateGlobalDownload(patch: Partial<DownloadState>) {
    globalDownloadState = { ...globalDownloadState, ...patch };
    notifyDownloadListeners();
}

function useDownloadState(): DownloadState {
    const [, forceUpdate] = useState(0);
    useEffect(() => {
        const listener = () => forceUpdate(v => v + 1);
        downloadListeners.add(listener);
        return () => { downloadListeners.delete(listener); };
    }, []);
    return globalDownloadState;
}

// ========================================
// フローティングダウンロード進捗ウィジェット
// ========================================
export function DownloadProgressWidget() {
    const state = useDownloadState();

    if (!state.isDownloading && !state.success && !state.error) return null;

    const handleDismiss = () => {
        updateGlobalDownload({ isDownloading: false, progress: "", percent: 0, error: null, success: false, modelName: "" });
    };

    const handleCancel = () => {
        if (globalAbortController) {
            globalAbortController.abort();
            globalAbortController = null;
        }
        updateGlobalDownload({ isDownloading: false, progress: "キャンセルしました", percent: 0, error: null, success: false });
    };

    return (
        <div className="fixed bottom-4 left-4 z-[99998] w-80 bg-ahme-surface-secondary/95 backdrop-blur-md border border-ahme-surface-border rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300">
            {/* ヘッダー */}
            <div className="flex items-center justify-between px-3 py-2 bg-ahme-bg border-b border-ahme-surface-border">
                <div className="flex items-center gap-2 text-xs font-bold text-ahme-text-primary">
                    {state.isDownloading ? <Loader2 size={12} className="animate-spin text-ahme-primary-text" /> : state.success ? <CheckCircle size={12} className="text-green-400" /> : <AlertCircle size={12} className="text-red-400" />}
                    <span className="truncate max-w-[180px]">📦 {state.modelName || "モデル"}</span>
                </div>
                <div className="flex items-center gap-1">
                    {state.isDownloading && (
                        <button onClick={handleCancel} className="text-[10px] px-1.5 py-0.5 rounded text-red-400 hover:bg-red-500/20 transition-colors">
                            中止
                        </button>
                    )}
                    {!state.isDownloading && (
                        <button onClick={handleDismiss} className="p-0.5 rounded hover:bg-ahme-surface-hover transition-colors text-ahme-text-muted">
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* プログレスバー + ステータス */}
            <div className="px-3 py-2 space-y-1.5">
                {state.isDownloading && (
                    <div className="w-full bg-ahme-bg rounded-full h-1.5 overflow-hidden">
                        <div className="h-full bg-ahme-primary-text transition-all duration-300 rounded-full" style={{ width: `${state.percent}%` }} />
                    </div>
                )}
                <div className="flex items-center justify-between text-[10px]">
                    <span className="text-ahme-text-muted truncate max-w-[200px]">{state.progress}</span>
                    {state.isDownloading && state.percent > 0 && <span className="text-ahme-primary-text font-bold">{state.percent}%</span>}
                </div>
                {state.error && <p className="text-[10px] text-red-400">{state.error}</p>}
            </div>
        </div>
    );
}

// ========================================
// メインダイアログ
// ========================================
interface AiAssistantDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onPromptsChanged?: () => void;
}

export default function AiAssistantDialog({ isOpen, onClose, onPromptsChanged }: AiAssistantDialogProps) {
    const [activeTab, setActiveTab] = useState<"prompts" | "models">("prompts");
    const [editedPrompts, setEditedPrompts] = useState<CustomPrompts>({});
    const [savedMessage, setSavedMessage] = useState<string | null>(null);

    // モデルダウンロード
    const [modelName, setModelName] = useState("");
    const [showSuggestions, setShowSuggestions] = useState(false);
    const suggestionsRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const downloadState = useDownloadState();

    // フィルタされたサジェスト
    const filteredModels = modelName.trim()
        ? POPULAR_MODELS.filter(m =>
            m.name.toLowerCase().includes(modelName.toLowerCase()) ||
            m.description.toLowerCase().includes(modelName.toLowerCase())
        )
        : POPULAR_MODELS;

    // ダイアログが開いた時にカスタムプロンプトを読み込む
    useEffect(() => {
        if (isOpen) {
            const custom = loadCustomPrompts();
            const merged: CustomPrompts = {};
            PROMPT_ENTRIES.forEach(({ key }) => {
                merged[key] = custom[key] ?? (SYSTEM_PROMPTS as Record<string, string>)[key] ?? "";
            });
            setEditedPrompts(merged);
            setSavedMessage(null);
        }
    }, [isOpen]);

    // サジェスト外クリックで閉じる
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
                inputRef.current && !inputRef.current.contains(e.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    if (!isOpen) return null;

    const handleSavePrompts = () => {
        const customOnly: CustomPrompts = {};
        PROMPT_ENTRIES.forEach(({ key }) => {
            const defaultVal = (SYSTEM_PROMPTS as Record<string, string>)[key] ?? "";
            if (editedPrompts[key] && editedPrompts[key].trim() !== defaultVal.trim()) {
                customOnly[key] = editedPrompts[key];
            }
        });
        saveCustomPrompts(customOnly);
        setSavedMessage("✅ システムプロンプトを保存しました");
        setTimeout(() => setSavedMessage(null), 3000);
        onPromptsChanged?.();
    };

    const handleResetPrompt = (key: string) => {
        const defaultVal = (SYSTEM_PROMPTS as Record<string, string>)[key] ?? "";
        setEditedPrompts(prev => ({ ...prev, [key]: defaultVal }));
    };

    const handleResetAll = () => {
        const defaults: CustomPrompts = {};
        PROMPT_ENTRIES.forEach(({ key }) => {
            defaults[key] = (SYSTEM_PROMPTS as Record<string, string>)[key] ?? "";
        });
        setEditedPrompts(defaults);
    };

    // モデルダウンロード処理（バックグラウンドで実行）
    const handleDownloadModel = async (name?: string) => {
        const targetName = name || modelName.trim();
        if (!targetName || downloadState.isDownloading) return;

        updateGlobalDownload({
            isDownloading: true,
            modelName: targetName,
            progress: "ダウンロード開始中...",
            percent: 0,
            error: null,
            success: false,
        });

        globalAbortController = new AbortController();

        try {
            const response = await fetch("/api/pull-model", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: targetName }),
                signal: globalAbortController.signal,
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || `HTTP ${response.status}`);
            }

            if (!response.body) throw new Error("レスポンスボディが空です");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const text = decoder.decode(value);

                const lines = text.split("\n").filter(l => l.trim());
                for (const line of lines) {
                    try {
                        const data = JSON.parse(line);
                        if (data.status) {
                            updateGlobalDownload({ progress: data.status });
                        }
                        if (data.completed && data.total && data.total > 0) {
                            updateGlobalDownload({ percent: Math.round((data.completed / data.total) * 100) });
                        }
                        if (data.status === "success") {
                            updateGlobalDownload({ success: true });
                        }
                    } catch { /* non-JSON line */ }
                }
            }

            updateGlobalDownload({
                isDownloading: false,
                success: true,
                progress: "✅ ダウンロード完了！モデル一覧を更新してください。",
                percent: 100,
            });
        } catch (err: any) {
            if (err.name !== "AbortError") {
                updateGlobalDownload({
                    isDownloading: false,
                    error: err.message || "ダウンロードに失敗しました",
                    progress: "",
                });
            } else {
                updateGlobalDownload({
                    isDownloading: false,
                    progress: "キャンセルしました",
                });
            }
        } finally {
            globalAbortController = null;
        }
    };

    const handleSelectModel = (name: string) => {
        setModelName(name);
        setShowSuggestions(false);
    };

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60" onClick={onClose}>
            <div className="bg-ahme-surface-secondary border border-ahme-surface-border rounded-xl shadow-2xl w-[600px] max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                {/* ヘッダー */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-ahme-surface-border">
                    <h2 className="text-lg font-bold text-ahme-text-primary flex items-center gap-2">
                        🤖 AI Assistant 設定
                    </h2>
                    <button onClick={onClose} className="p-1 rounded hover:bg-ahme-surface-hover transition-colors text-ahme-text-muted hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                {/* タブ切替 */}
                <div className="flex border-b border-ahme-surface-border px-5">
                    <button
                        onClick={() => setActiveTab("prompts")}
                        className={`px-4 py-2.5 text-sm font-bold transition-colors border-b-2 ${activeTab === "prompts" ? "text-ahme-text-primary border-ahme-primary-text" : "text-ahme-text-muted border-transparent hover:text-ahme-text-secondary"}`}
                    >
                        📝 システムプロンプト
                    </button>
                    <button
                        onClick={() => setActiveTab("models")}
                        className={`px-4 py-2.5 text-sm font-bold transition-colors border-b-2 flex items-center gap-1.5 ${activeTab === "models" ? "text-ahme-text-primary border-ahme-primary-text" : "text-ahme-text-muted border-transparent hover:text-ahme-text-secondary"}`}
                    >
                        📦 モデルダウンロード
                        {downloadState.isDownloading && <Loader2 size={12} className="animate-spin" />}
                    </button>
                </div>

                {/* コンテンツ */}
                <div className="flex-1 overflow-y-auto px-5 py-4">
                    {activeTab === "prompts" && (
                        <div className="space-y-5">
                            <p className="text-xs text-ahme-text-muted">
                                システムプロンプトをカスタマイズできます。AIの応答スタイルや専門性を調整してください。
                            </p>

                            {PROMPT_ENTRIES.map(({ key, label, description }) => (
                                <div key={key} className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <label className="text-sm font-bold text-ahme-text-primary">{label}</label>
                                            <p className="text-[10px] text-ahme-text-faint">{description}</p>
                                        </div>
                                        <button
                                            onClick={() => handleResetPrompt(key)}
                                            className="flex items-center gap-1 px-2 py-1 text-[10px] text-ahme-text-muted hover:text-white hover:bg-ahme-surface-hover rounded transition-colors"
                                            title="デフォルトに戻す"
                                        >
                                            <RotateCcw size={10} /> デフォルトに戻す
                                        </button>
                                    </div>
                                    <textarea
                                        value={editedPrompts[key] ?? ""}
                                        onChange={e => setEditedPrompts(prev => ({ ...prev, [key]: e.target.value }))}
                                        className="w-full bg-ahme-bg border border-ahme-surface-border rounded-lg p-3 text-sm text-ahme-text-primary focus:outline-none focus:ring-1 focus:ring-ahme-primary-ring resize-y min-h-[120px] scrollbar-thin scrollbar-thumb-ahme-surface-hover"
                                        placeholder="プロンプトを入力..."
                                    />
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === "models" && (
                        <div className="space-y-5">
                            <p className="text-xs text-ahme-text-muted">
                                Ollama からモデルをダウンロードできます。モデル名を入力するか、一覧から選択してください。
                            </p>

                            {/* 検索入力 + サジェスト */}
                            <div className="relative">
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ahme-text-faint pointer-events-none" />
                                        <input
                                            ref={inputRef}
                                            type="text"
                                            value={modelName}
                                            onChange={e => { setModelName(e.target.value); setShowSuggestions(true); }}
                                            onFocus={() => setShowSuggestions(true)}
                                            onKeyDown={e => { if (e.key === "Enter") { handleDownloadModel(); setShowSuggestions(false); } }}
                                            placeholder="モデル名を検索... (例: gemma3, llama3)"
                                            disabled={downloadState.isDownloading}
                                            className="w-full bg-ahme-bg border border-ahme-surface-border rounded-lg pl-8 pr-3 py-2.5 text-sm text-ahme-text-primary focus:outline-none focus:ring-1 focus:ring-ahme-primary-ring disabled:opacity-50"
                                        />
                                    </div>
                                    <button
                                        onClick={() => handleDownloadModel()}
                                        disabled={!modelName.trim() || downloadState.isDownloading}
                                        className="flex items-center gap-1.5 px-4 py-2 text-sm bg-ahme-primary-text hover:opacity-90 text-white rounded-lg transition-colors font-bold disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                                    >
                                        <Download size={14} /> ダウンロード
                                    </button>
                                </div>

                                {/* サジェストドロップダウン */}
                                {showSuggestions && filteredModels.length > 0 && (
                                    <div ref={suggestionsRef} className="absolute top-full left-0 right-0 mt-1 bg-ahme-surface-secondary border border-ahme-surface-border rounded-lg shadow-2xl z-10 max-h-[240px] overflow-y-auto scrollbar-thin scrollbar-thumb-ahme-surface-hover">
                                        {filteredModels.map(model => (
                                            <button
                                                key={model.name}
                                                onClick={() => handleSelectModel(model.name)}
                                                onDoubleClick={() => { handleSelectModel(model.name); handleDownloadModel(model.name); }}
                                                className="w-full text-left px-3 py-2 text-sm hover:bg-ahme-surface-hover transition-colors flex items-center justify-between group border-b border-ahme-surface-border/30 last:border-0"
                                            >
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-ahme-text-primary">{model.name}</span>
                                                    <span className="text-[10px] text-ahme-text-faint">{model.description}</span>
                                                </div>
                                                <Download size={12} className="text-ahme-text-faint opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* ダウンロード中のステータス表示 */}
                            {downloadState.isDownloading && (
                                <div className="p-3 rounded-lg bg-ahme-bg border border-ahme-surface-border space-y-2">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-ahme-text-secondary font-bold flex items-center gap-1.5">
                                            <Loader2 size={12} className="animate-spin" /> {downloadState.modelName}
                                        </span>
                                        {downloadState.percent > 0 && <span className="text-ahme-text-primary font-bold">{downloadState.percent}%</span>}
                                    </div>
                                    <div className="w-full bg-ahme-bg rounded-full h-2 overflow-hidden">
                                        <div className="h-full bg-ahme-primary-text transition-all duration-300 rounded-full" style={{ width: `${downloadState.percent}%` }} />
                                    </div>
                                    <p className="text-[10px] text-ahme-text-muted">{downloadState.progress}</p>
                                    <p className="text-[10px] text-ahme-text-faint">💡 ダイアログを閉じてもダウンロードは継続されます（画面左下に進捗表示）</p>
                                </div>
                            )}

                            {/* 成功 */}
                            {!downloadState.isDownloading && downloadState.success && (
                                <div className="flex items-start gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-xs">
                                    <CheckCircle size={14} className="mt-0.5 shrink-0" />
                                    <div>
                                        <p className="font-bold">ダウンロード完了</p>
                                        <p className="opacity-80">モデル選択のリフレッシュボタン（⟳）を押して一覧を更新してください。</p>
                                    </div>
                                </div>
                            )}

                            {/* エラー */}
                            {downloadState.error && (
                                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                                    <div>
                                        <p className="font-bold">ダウンロードエラー</p>
                                        <p className="opacity-80">{downloadState.error}</p>
                                    </div>
                                </div>
                            )}

                            <div className="p-3 rounded-lg bg-ahme-bg border border-ahme-surface-border text-xs text-ahme-text-muted space-y-1">
                                <p className="font-bold text-ahme-text-secondary">💡 ヒント</p>
                                <p>• 上のリストにないモデルは <a href="https://ollama.com/library" className="text-ahme-primary-text underline cursor-pointer" onClick={e => { e.preventDefault(); (window as any).electronAPI?.openExternal("https://ollama.com/library"); }}>ollama.com/library</a> で確認できます</p>
                                <p>• モデル名を直接入力してダウンロードすることも可能です</p>
                                <p>• ダブルクリックで即座にダウンロードを開始します</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* フッター */}
                <div className="flex items-center justify-between px-5 py-3 border-t border-ahme-surface-border">
                    <div className="flex items-center gap-2">
                        {savedMessage && (
                            <span className="text-xs text-green-400 font-medium animate-in fade-in duration-200">{savedMessage}</span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        {activeTab === "prompts" && (
                            <>
                                <button
                                    onClick={handleResetAll}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-ahme-text-secondary hover:text-white rounded hover:bg-ahme-surface-hover transition-colors"
                                >
                                    <RotateCcw size={12} /> すべてデフォルトに戻す
                                </button>
                                <button
                                    onClick={handleSavePrompts}
                                    className="px-4 py-1.5 text-sm bg-ahme-primary-text hover:opacity-90 text-white rounded transition-colors font-bold"
                                >
                                    保存
                                </button>
                            </>
                        )}
                        <button
                            onClick={onClose}
                            className="px-4 py-1.5 text-sm text-ahme-text-secondary hover:text-white rounded hover:bg-ahme-surface-hover transition-colors"
                        >
                            閉じる
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
