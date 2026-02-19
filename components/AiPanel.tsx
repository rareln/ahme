"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Send, Bot, User, Trash2, ChevronDown, AlertCircle, RefreshCw, Paperclip, X, FileText, Loader2, Globe, Image as ImageIcon } from "lucide-react";
import { useEditorContext } from "./EditorContext";

interface Message {
    role: "user" | "assistant" | "system";
    content: string;
}

interface AiPanelProps {
    editorContent: string;
}

/** 添付ファイル */
interface AttachedFile {
    id: string;
    name: string;
    text: string;
    size: number;
    isParsing: boolean;
    error?: string;
    truncated?: boolean;
}

/** 添付画像 */
interface AttachedImage {
    id: string;
    name: string;
    base64: string;   // Ollama に送る純粋な Base64（data: prefix なし）
    preview: string;  // プレビュー用 data URL
    size: number;
}

/** 画像を Canvas でリサイズし Base64 を返す（長辺1024px） */
function resizeImageToBase64(file: File, maxEdge = 1024): Promise<{ base64: string; preview: string }> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const img = new window.Image();
            img.onload = () => {
                let { width, height } = img;
                if (width > maxEdge || height > maxEdge) {
                    const ratio = Math.min(maxEdge / width, maxEdge / height);
                    width = Math.round(width * ratio);
                    height = Math.round(height * ratio);
                }
                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d")!;
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
                // data:image/jpeg;base64,XXXX → split で確実にプレフィックス除去
                const parts = dataUrl.split(",");
                const base64 = parts.length > 1 ? parts.slice(1).join(",") : parts[0];
                console.log(`[AiPanel] Image resized: ${width}x${height}, base64 length: ${base64.length}, starts with: ${base64.substring(0, 20)}`);
                resolve({ base64, preview: dataUrl });
            };
            img.onerror = reject;
            img.src = reader.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"]);

function isImageFile(file: File): boolean {
    if (file.type.startsWith("image/")) return true;
    const ext = file.name.lastIndexOf(".") >= 0 ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase() : "";
    return IMAGE_EXTENSIONS.has(ext);
}

/** Markdown コードブロックとテキストをパースする */
interface ContentBlock {
    type: "text" | "code";
    content: string;
    language?: string;
}

function parseMessageContent(content: string): ContentBlock[] {
    const blocks: ContentBlock[] = [];
    const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
        if (match.index > lastIndex) {
            const textBefore = content.slice(lastIndex, match.index);
            if (textBefore.trim()) {
                blocks.push({ type: "text", content: textBefore });
            }
        }
        blocks.push({
            type: "code",
            content: match[2].trim(),
            language: match[1] || undefined,
        });
        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
        const remaining = content.slice(lastIndex);
        if (remaining.trim()) {
            blocks.push({ type: "text", content: remaining });
        }
    }

    if (blocks.length === 0 && content.trim()) {
        blocks.push({ type: "text", content });
    }

    return blocks;
}

/** URL を検出してリンク化するヘルパー */
const URL_REGEX = /(https?:\/\/[^\s<>()"']+)/g;

function renderTextWithLinks(text: string, fontSize: number): React.ReactNode[] {
    const parts = text.split(URL_REGEX);
    return parts.map((part, i) => {
        if (URL_REGEX.test(part)) {
            URL_REGEX.lastIndex = 0; // reset regex state
            const handleClick = (e: React.MouseEvent) => {
                e.preventDefault();
                const api = (window as any).electronAPI;
                if (api?.openExternal) {
                    api.openExternal(part);
                } else {
                    window.open(part, '_blank');
                }
            };
            return (
                <a
                    key={i}
                    href={part}
                    onClick={handleClick}
                    className="text-blue-400 underline hover:text-blue-300 cursor-pointer break-all"
                    title={part}
                >
                    {part}
                </a>
            );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
    });
}

/** コードブロック表示コンポーネント */
function CodeBlockWithInsert({
    code,
    language,
    fontSize,
}: {
    code: string;
    language?: string;
    fontSize: number;
}) {
    const { insertWithHighlight } = useEditorContext();
    const [inserted, setInserted] = useState(false);

    const handleInsert = () => {
        insertWithHighlight(code);
        setInserted(true);
        setTimeout(() => setInserted(false), 2000);
    };

    return (
        <div className="relative group my-2 rounded-lg overflow-hidden border border-gray-700/50">
            <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800/80 border-b border-gray-700/50">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-mono">
                    {language || "code"}
                </span>
                <button
                    onClick={handleInsert}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all duration-200 ${inserted
                        ? "bg-green-500/20 text-green-400 border border-green-500/30"
                        : "bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 hover:border-blue-500/40 hover:shadow-[0_0_8px_rgba(59,130,246,0.15)]"
                        }`}
                    title="エディタのカーソル位置に挿入（ハイライト付き）"
                >
                    {inserted ? (
                        <><span>✅</span> 挿入完了</>
                    ) : (
                        <><span>📝</span> エディタに挿入</>
                    )}
                </button>
            </div>
            <pre
                className="p-3 bg-[#0d1117] overflow-x-auto scrollbar-thin scrollbar-thumb-gray-700"
                style={{ fontSize: `${Math.max(fontSize - 1, 10)}px` }}
            >
                <code className="text-gray-300 font-mono leading-relaxed whitespace-pre">
                    {code}
                </code>
            </pre>
        </div>
    );
}

/** メッセージ内容をレンダリング */
function MessageContent({
    content,
    fontSize,
    isStreaming,
}: {
    content: string;
    fontSize: number;
    isStreaming: boolean;
}) {
    const blocks = useMemo(() => parseMessageContent(content), [content]);

    return (
        <div className={isStreaming ? "border-r-2 border-blue-500 animate-pulse" : ""}>
            {blocks.map((block, i) =>
                block.type === "code" ? (
                    <CodeBlockWithInsert
                        key={i}
                        code={block.content}
                        language={block.language}
                        fontSize={fontSize}
                    />
                ) : (
                    <div
                        key={i}
                        className="text-gray-200 leading-relaxed whitespace-pre-wrap"
                        style={{ fontSize: `${fontSize}px` }}
                    >
                        {renderTextWithLinks(block.content, fontSize)}
                    </div>
                )
            )}
        </div>
    );
}

/** テキスト選択時のフローティング挿入ボタン */
function SelectionInsertButton({ containerRef }: { containerRef: React.RefObject<HTMLDivElement | null> }) {
    const { insertWithHighlight } = useEditorContext();
    const [visible, setVisible] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [selectedText, setSelectedText] = useState("");

    // 選択範囲の変更を監視して表示・非表示を切り替え
    const updateVisibility = useCallback(() => {
        const sel = window.getSelection();
        const text = sel?.toString()?.trim();

        // 選択テキストがない、または短すぎる場合は非表示
        if (!text || text.length < 1) {
            setVisible(false);
            return;
        }

        // 選択範囲の座標を取得 (Viewport基準)
        const range = sel!.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        // コンテナ内かどうかを判定（エディタ等での誤表示防止）
        if (!containerRef.current || !sel || !sel.anchorNode || !containerRef.current.contains(sel.anchorNode)) {
            return;
        }

        if (rect.width === 0 || rect.height === 0) return;

        setSelectedText(text);
        // Fixed配置なので Viewport 座標をそのまま使用
        // 少し上に表示 (Y - 40px), 左端合わせ (X)
        setPosition({
            x: rect.left + (rect.width / 2) - 60, // 中央寄せ試行 (ボタン幅120px想定)
            y: rect.top - 40,
        });
        setVisible(true);
    }, []);

    useEffect(() => {
        const handleDocumentMouseUp = (e: MouseEvent) => {
            // 左クリックのみ反応
            if (e.button !== 0) return;
            // 少し遅延させて選択状態を確定させる
            setTimeout(updateVisibility, 10);
        };

        const handleDocumentMouseDown = (e: MouseEvent) => {
            // ここでは即座に隠さず、次のMouseUpやSelectionChangeで判定する
            // ただし、選択解除（クリック）を検知するためにチェックは必要
            // ボタン自体のクリックは stopPropagation されるのでここには来ない
            setTimeout(() => {
                const sel = window.getSelection();
                if (!sel || sel.isCollapsed) {
                    setVisible(false);
                }
            }, 10);
        };

        // スクロール時も位置再計算あるいは非表示にする
        const handleScroll = () => {
            // スクロール中は非表示にするのが安全（追従は重い）
            setVisible(false);
        };

        document.addEventListener("mouseup", handleDocumentMouseUp);
        document.addEventListener("mousedown", handleDocumentMouseDown);
        document.addEventListener("scroll", handleScroll, true);

        return () => {
            document.removeEventListener("mouseup", handleDocumentMouseUp);
            document.removeEventListener("mousedown", handleDocumentMouseDown);
            document.removeEventListener("scroll", handleScroll, true);
        };
    }, [updateVisibility]);

    const handleInsert = () => {
        if (selectedText) {
            insertWithHighlight(selectedText);
            setVisible(false);
            window.getSelection()?.removeAllRanges();
        }
    };

    if (!visible) return null;

    return (
        <div
            className="fixed z-[99999]"
            style={{ left: position.x, top: position.y }}
            onMouseDown={(e) => {
                // ボタンクリックで選択範囲が解除されないようにする (超重要)
                e.preventDefault();
                e.stopPropagation();
            }}
        >
            <button
                onClick={handleInsert}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold
                           bg-emerald-600 text-white shadow-lg border border-emerald-400
                           hover:bg-emerald-500 transition-all cursor-pointer animate-in fade-in zoom-in duration-150"
                title="選択テキストをエディタのカーソル位置に挿入"
            >
                <span>📝</span> エディタに挿入
            </button>
        </div>
    );
}

/** ファイルサイズのフォーマット */
function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** 添付ファイルチップ */
function AttachmentChip({
    file,
    onRemove,
}: {
    file: AttachedFile;
    onRemove: (id: string) => void;
}) {
    return (
        <div
            className={`flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-md text-[11px] border transition-all duration-200 ${file.error
                ? "bg-red-900/20 border-red-700/40 text-red-400"
                : file.isParsing
                    ? "bg-blue-900/20 border-blue-700/40 text-blue-400"
                    : file.truncated
                        ? "bg-amber-900/20 border-amber-700/40 text-amber-400"
                        : "bg-gray-800/80 border-gray-600/40 text-gray-300"
                }`}
        >
            {file.isParsing ? (
                <Loader2 size={12} className="animate-spin shrink-0" />
            ) : (
                <FileText size={12} className="shrink-0" />
            )}
            <span className="truncate max-w-[120px] font-medium" title={file.name}>
                {file.name}
            </span>
            <span className="text-[9px] opacity-60 whitespace-nowrap">
                {formatFileSize(file.size)}
            </span>
            {file.truncated && (
                <span className="text-[9px] text-amber-500" title="テキストが切り詰められました">⚠</span>
            )}
            {file.error && (
                <span className="text-[9px] text-red-400" title={file.error}>⚠</span>
            )}
            <button
                onClick={() => onRemove(file.id)}
                className="p-0.5 rounded hover:bg-gray-600/50 transition-colors shrink-0"
                title="添付を取り消し"
            >
                <X size={12} />
            </button>
        </div>
    );
}

export default function AiPanel({ editorContent }: AiPanelProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState("");
    const [fontSize, setFontSize] = useState(() => {
        if (typeof window === 'undefined') return 14;
        const saved = localStorage.getItem('ahme-chat-font-size');
        return saved ? Math.max(10, Math.min(30, parseInt(saved, 10) || 14)) : 14;
    });
    const [availableModels, setAvailableModels] = useState<string[]>([]);
    const [selectedModel, setSelectedModel] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [isLoadingModels, setIsLoadingModels] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // ── 添付ファイル State ──
    const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
    const [isDragOver, setIsDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── 画像添付 State ──
    const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);

    // ── Web検索 State ──
    const [webSearchEnabled, setWebSearchEnabled] = useState(false);
    const [isSearching, setIsSearching] = useState(false);

    const fetchModels = async () => {
        setIsLoadingModels(true);
        setError(null);
        try {
            console.log("[AiPanel] Fetching models...");
            const response = await fetch("/api/models", { cache: "no-store" });

            if (!response.ok) {
                const text = await response.text();
                let errMsg = `HTTP ${response.status}`;
                try {
                    const json = JSON.parse(text);
                    errMsg = json.error || errMsg;
                } catch { errMsg = text.substring(0, 50) || errMsg; }
                throw new Error(errMsg);
            }

            const data = await response.json();

            if (data.models && Array.isArray(data.models) && data.models.length > 0) {
                setAvailableModels(data.models);
                const gemma = data.models.find((m: string) => m.includes("gemma3:12b"));
                if (gemma) {
                    setSelectedModel(gemma);
                } else if (!selectedModel || !data.models.includes(selectedModel)) {
                    setSelectedModel(data.models[0]);
                }
            } else {
                throw new Error("インストール済みのモデルが見つかりませんでした");
            }
        } catch (err: any) {
            console.error("[AiPanel] Failed to fetch models:", err);
            setError(`モデル取得エラー: ${err.message}`);
        } finally {
            setIsLoadingModels(false);
        }
    };

    useEffect(() => { fetchModels(); }, []);

    // テキストサイズの変更を localStorage に保存
    useEffect(() => {
        localStorage.setItem('ahme-chat-font-size', String(fontSize));
    }, [fontSize]);

    // 入力欄の高さを自動調整するエフェクト
    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = "auto";
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    }, [inputValue]);

    // ── 右クリックコンテキストメニュー State ──
    const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; text: string } | null>(null);

    const handleContextMenu = useCallback((e: React.MouseEvent) => {
        const sel = window.getSelection();
        const text = sel?.toString()?.trim();
        if (!text || text.length < 1) return; // テキスト未選択時はデフォルトメニュー
        e.preventDefault();
        e.stopPropagation(); // 親要素への伝播を阻止
        setCtxMenu({ x: e.clientX, y: e.clientY, text });
    }, []);

    // クリックでコンテキストメニューを閉じる
    useEffect(() => {
        if (!ctxMenu) return;
        const close = () => setCtxMenu(null);
        window.addEventListener('click', close);
        window.addEventListener('contextmenu', close);
        return () => {
            window.removeEventListener('click', close);
            window.removeEventListener('contextmenu', close);
        };
    }, [ctxMenu]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    // ── ファイル添付処理（画像 / テキスト分岐）──
    const handleFiles = useCallback(async (files: FileList | File[]) => {
        const fileArray = Array.from(files);

        for (const file of fileArray) {
            // ── 画像ファイル: クライアントサイドで Base64 変換 ──
            if (isImageFile(file)) {
                const id = `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                try {
                    const { base64, preview } = await resizeImageToBase64(file);
                    setAttachedImages(prev => [...prev, {
                        id,
                        name: file.name,
                        base64,
                        preview,
                        size: file.size,
                    }]);
                    console.log(`[AiPanel] Image attached: ${file.name} (resized for Ollama)`);
                } catch (err: any) {
                    console.error(`[AiPanel] Image resize failed: ${err.message}`);
                }
                continue;
            }

            // ── テキスト / PDF ファイル: サーバーサイドパース ──
            const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const newFile: AttachedFile = {
                id,
                name: file.name,
                text: "",
                size: file.size,
                isParsing: true,
            };

            setAttachedFiles(prev => [...prev, newFile]);

            try {
                const formData = new FormData();
                formData.append("file", file);

                const res = await fetch("/api/parse", {
                    method: "POST",
                    body: formData,
                });

                const data = await res.json();

                if (!res.ok) {
                    setAttachedFiles(prev =>
                        prev.map(f =>
                            f.id === id
                                ? { ...f, isParsing: false, error: data.error || "解析失敗" }
                                : f
                        )
                    );
                    continue;
                }

                setAttachedFiles(prev =>
                    prev.map(f =>
                        f.id === id
                            ? {
                                ...f,
                                isParsing: false,
                                text: data.text,
                                truncated: data.truncated,
                            }
                            : f
                    )
                );
            } catch (err: any) {
                setAttachedFiles(prev =>
                    prev.map(f =>
                        f.id === id
                            ? { ...f, isParsing: false, error: err.message }
                            : f
                    )
                );
            }
        }
    }, []);

    const removeFile = useCallback((id: string) => {
        setAttachedFiles(prev => prev.filter(f => f.id !== id));
    }, []);

    const removeImage = useCallback((id: string) => {
        setAttachedImages(prev => prev.filter(img => img.id !== id));
    }, []);

    // ── Drag & Drop ハンドラ ──
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // 子要素からのleaveイベントを無視
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const { clientX, clientY } = e;
        if (
            clientX >= rect.left &&
            clientX <= rect.right &&
            clientY >= rect.top &&
            clientY <= rect.bottom
        ) {
            return;
        }
        setIsDragOver(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFiles(files);
        }
    }, [handleFiles]);

    // ── メッセージ送信 ──
    const handleSend = async () => {
        if (!inputValue.trim() || isGenerating) return;
        // パース中のファイルがある場合は待機
        if (attachedFiles.some(f => f.isParsing)) return;

        const userText = inputValue;
        const currentAttachments = attachedFiles.filter(f => !f.error && f.text);
        const currentImages = [...attachedImages];
        console.log(`[AiPanel] handleSend: ${currentAttachments.length} files, ${currentImages.length} images`);

        // ユーザーメッセージに添付情報を表示
        const attachInfo: string[] = [];
        if (currentAttachments.length > 0) attachInfo.push(`📎 ${currentAttachments.map(f => f.name).join(", ")}`);
        if (currentImages.length > 0) attachInfo.push(`🖼️ ${currentImages.map(img => img.name).join(", ")}`);

        const newMessages: Message[] = [
            ...messages,
            {
                role: "user",
                content: attachInfo.length > 0
                    ? `${userText}\n\n${attachInfo.join(" | ")}`
                    : userText,
            },
        ];

        setMessages(newMessages);
        setInputValue("");
        setIsGenerating(true);
        setError(null);

        abortControllerRef.current = new AbortController();

        try {
            const systemPrompt = "あなたはAHMEというエディタのAIアシスタントです。回答は必ず「日本語」で行ってください。絶対に英語を使わないでください。親しみやすく、丁寧な敬語を使ってください。";

            // ── Web検索（有効時のみ、3秒タイムアウト） ──
            let searchContext = "";
            if (webSearchEnabled) {
                setIsSearching(true);
                try {
                    const searchRes = await fetch("/api/search", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ query: userText }),
                    });
                    const searchData = await searchRes.json();

                    if (!searchData.skipped && searchData.results?.length > 0) {
                        const resultsText = searchData.results
                            .map((r: any, i: number) => `${i + 1}. [${r.title}](${r.url})\n${r.content}`)
                            .join("\n\n");
                        searchContext = `\n\n--- Web検索結果 ---\n${searchData.answer ? `要約: ${searchData.answer}\n\n` : ""}${resultsText}\n`;
                        console.log(`[AiPanel] Web search: ${searchData.results.length} results`);
                    } else {
                        console.log(`[AiPanel] Web search skipped: ${searchData.reason || "no results"}`);
                    }
                } catch (searchErr: any) {
                    console.log(`[AiPanel] Web search error (skipping): ${searchErr.message}`);
                } finally {
                    setIsSearching(false);
                }
            }

            // ── 添付ファイルのコンテキスト構築 ──
            let attachmentContext = "";
            if (currentAttachments.length > 0) {
                attachmentContext = currentAttachments
                    .map(f => `[添付資料: ${f.name}]\n${f.text}`)
                    .join("\n\n");
                attachmentContext = `\n\n--- 添付資料 ---\n${attachmentContext}\n`;
            }

            // ── プロンプト構築（画像の有無でストラテジーを変更） ──
            let fullContext: string;

            if (currentImages.length > 0) {
                // 🖼️ 画像あり: 画像分析を最優先、エディタコンテキストは要約程度に抑える
                // 長文ドキュメントがコンテキストウィンドウを圧迫すると画像が無視されるため
                const MAX_EDITOR_WITH_IMAGE = 1000;
                const trimmedEditor = editorContent.length > MAX_EDITOR_WITH_IMAGE
                    ? editorContent.substring(0, MAX_EDITOR_WITH_IMAGE) + "\n...(以下省略)..."
                    : editorContent;

                fullContext = [
                    "【重要】画像が添付されています。まず画像の内容を詳しく分析し、ユーザーの質問に回答してください。",
                    `\n--- User Question ---\n${userText}`,
                    searchContext,
                    attachmentContext,
                    trimmedEditor ? `\n--- エディタ参考情報（要約） ---\n${trimmedEditor}` : "",
                ].filter(Boolean).join("\n");
            } else {
                // 📝 テキストのみ: 従来どおりフルコンテキスト
                fullContext = `以下のドキュメントの内容に基づいて回答してください。${searchContext}${attachmentContext}\n\n--- Context ---\n${editorContent}\n\n--- User Question ---\n${userText}`;
            }

            console.log(`[AiPanel] fullContext length: ${fullContext.length}, hasImages: ${currentImages.length > 0}`);

            const payload: any = {
                model: selectedModel || "llama3",
                messages: [
                    { role: "system", content: systemPrompt },
                    ...messages.map(m => ({ role: m.role, content: m.content })),
                    { role: "user", content: fullContext }
                ],
                stream: true,
            };

            // 画像がある場合、Base64 配列を payload に追加
            if (currentImages.length > 0) {
                // 純粋な Base64 文字列のみを抽出（data: プレフィックスを再度確認・除去）
                const cleanBase64 = currentImages.map(img => {
                    let b64 = img.base64;
                    if (b64.startsWith("data:")) {
                        b64 = b64.split(",").slice(1).join(",");
                    }
                    return b64;
                });
                payload.images = cleanBase64;
                console.log(`[AiPanel] Sending ${cleanBase64.length} image(s), base64 lengths: ${cleanBase64.map(b => b.length)}, first50: ${cleanBase64.map(b => b.substring(0, 50))}`);
            }

            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                signal: abortControllerRef.current.signal,
            });

            if (!response.ok) {
                const text = await response.text();
                let errMsg = `HTTP ${response.status}`;
                try {
                    const json = JSON.parse(text);
                    errMsg = json.error || errMsg;
                } catch { errMsg = text.substring(0, 50) || errMsg; }
                throw new Error(errMsg);
            }

            if (!response.body) throw new Error("レスポンスボディが空です");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            setMessages(prev => [...prev, { role: "assistant", content: "" }]);

            let assistantContent = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                assistantContent += chunk;
                setMessages(prev => {
                    const next = [...prev];
                    next[next.length - 1] = { ...next[next.length - 1], content: assistantContent };
                    return next;
                });
            }

            // 送信成功後に添付をクリア
            setAttachedFiles([]);
            setAttachedImages([]);
        } catch (err: any) {
            if (err.name === "AbortError") {
                console.log("Stream aborted");
            } else {
                console.error("Chat Error:", err);
                setError(err.message || "予期せぬエラーが発生しました。");
            }
        } finally {
            setIsGenerating(false);
            abortControllerRef.current = null;
        }
    };

    const handleClear = () => {
        if (isGenerating && abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        setMessages([]);
        setError(null);
        setAttachedFiles([]);
        setAttachedImages([]);
    };

    const hasParsing = attachedFiles.some(f => f.isParsing);
    const successFiles = attachedFiles.filter(f => !f.error && !f.isParsing);
    const totalAttachments = successFiles.length + attachedImages.length;

    return (
        <div className="flex flex-col h-full bg-[#111827] border-l border-gray-700 text-sm">
            {/* ヘッダー */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700 bg-gray-800/50">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-gray-200">
                        <Bot size={20} className="text-blue-400" />
                        <span className="font-bold text-base whitespace-nowrap">AI Assistant</span>
                    </div>
                    <div className="flex items-center gap-2 bg-gray-900/50 px-3 py-1.5 rounded border border-gray-700">
                        <button onClick={() => setFontSize(Math.max(10, fontSize - 1))} className="text-gray-400 hover:text-white transition-colors text-base font-bold leading-none px-1" title="文字を小さく">-</button>
                        <span className="text-sm font-bold text-gray-300 w-6 text-center select-none">{fontSize}</span>
                        <button onClick={() => setFontSize(Math.min(30, fontSize + 1))} className="text-gray-400 hover:text-white transition-colors text-base font-bold leading-none px-1" title="文字を大きく">+</button>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative group flex items-center gap-1">
                        <select
                            value={selectedModel}
                            onChange={(e) => setSelectedModel(e.target.value)}
                            disabled={isLoadingModels}
                            className="appearance-none w-48 bg-gray-700 text-gray-200 text-sm font-medium px-3 py-2 pr-8 rounded cursor-pointer hover:bg-gray-600 transition-colors border border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 truncate disabled:opacity-50"
                        >
                            {availableModels.map(model => (
                                <option key={model} value={model}>{model}</option>
                            ))}
                        </select>
                        <ChevronDown size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <button
                            onClick={fetchModels}
                            disabled={isLoadingModels}
                            className={`p-1 text-gray-400 hover:text-white transition-colors ${isLoadingModels ? "animate-spin" : ""}`}
                            title="モデルリストを更新"
                        >
                            <RefreshCw size={16} />
                        </button>
                    </div>
                    {/* 🌐 Web検索トグル */}
                    <button
                        onClick={() => setWebSearchEnabled(v => !v)}
                        className={`p-1.5 rounded transition-all duration-200 ${webSearchEnabled
                            ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_6px_rgba(16,185,129,0.15)]"
                            : "text-gray-500 hover:text-gray-300 hover:bg-gray-700"
                            }`}
                        title={webSearchEnabled ? "Web検索: ON" : "Web検索: OFF"}
                    >
                        <Globe size={18} />
                    </button>
                    <button onClick={handleClear} className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-red-400 transition-colors" title="履歴をクリア">
                        <Trash2 size={18} />
                    </button>
                </div>
            </div>

            {/* メッセージエリア + テキスト選択挿入ボタン */}
            <div className="flex-1 overflow-hidden relative">
                <div
                    ref={scrollRef}
                    className="h-full overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent select-text"
                    onContextMenu={handleContextMenu}
                >
                    {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-3 opacity-50">
                            <Bot size={48} strokeWidth={1} />
                            <p>エディタの内容について質問してみましょう</p>
                            <p className="text-[11px] text-gray-600">💡 回答のテキストを選択すると「エディタに挿入」ボタンが表示されます</p>
                            <p className="text-[11px] text-gray-600">📎 ファイルをドラッグ＆ドロップで添付できます</p>
                        </div>
                    ) : (
                        messages.filter(m => m.role !== "system").map((msg, i) => (
                            <div
                                key={i}
                                className={`flex gap-3 ${msg.role === "assistant" ? "bg-gray-800/30 -mx-4 px-4 py-3" : ""}`}
                            >
                                <div className="mt-1 shrink-0">
                                    {msg.role === "assistant" ? (
                                        <div className="bg-blue-600 p-1 rounded text-white shadow-sm"><Bot size={14} /></div>
                                    ) : (
                                        <div className="bg-gray-600 p-1 rounded text-white shadow-sm"><User size={14} /></div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0 space-y-1">
                                    <div className="font-semibold text-[10px] text-gray-500 uppercase tracking-tighter">
                                        {msg.role === "assistant" ? "Assistant" : "You"}
                                    </div>
                                    {msg.role === "assistant" ? (
                                        <MessageContent
                                            content={msg.content}
                                            fontSize={fontSize}
                                            isStreaming={i === messages.length - 1 && isGenerating}
                                        />
                                    ) : (
                                        <div className="text-gray-200 leading-relaxed whitespace-pre-wrap" style={{ fontSize: `${fontSize}px` }}>
                                            {msg.content}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}

                    {error && (
                        <div className="bg-red-900/20 border border-red-800 rounded-md p-3 text-red-400 text-xs flex items-start gap-2">
                            <AlertCircle size={14} className="mt-0.5 shrink-0" />
                            <div>
                                <p className="font-semibold">Error</p>
                                <p className="opacity-80 break-all">{error}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* 選択時インサートボタン（z-index調整） */}
                <div className="relative z-10">
                    <SelectionInsertButton containerRef={scrollRef} />
                </div>
            </div>

            {/* 右クリックコンテキストメニュー (最前面・Fixed配置・ポータル的扱い) */}
            {ctxMenu && (
                <div
                    className="fixed z-[99999] bg-gray-800 border border-gray-500 rounded-lg shadow-2xl py-2 min-w-[200px] backdrop-blur-md"
                    style={{ left: ctxMenu.x, top: ctxMenu.y }}
                    onClick={(e) => e.stopPropagation()}
                    onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    }}
                >
                    <button
                        className="w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-700 transition-colors flex items-center gap-2.5"
                        onClick={() => {
                            navigator.clipboard.writeText(ctxMenu.text);
                            setCtxMenu(null);
                        }}
                    >
                        <span className="text-base">📋</span> コピー
                    </button>
                    <div className="border-t border-gray-700 my-1" />
                    <button
                        className="w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-700 transition-colors flex items-center gap-2.5"
                        onClick={() => {
                            const url = `https://www.google.com/search?q=${encodeURIComponent(ctxMenu.text)}`;
                            const api = (window as any).electronAPI;
                            if (api?.openExternal) {
                                api.openExternal(url);
                            } else {
                                window.open(url, '_blank');
                            }
                            setCtxMenu(null);
                        }}
                    >
                        <span className="text-base">🔍</span> Google検索
                    </button>
                </div>
            )}

            {/* ── 入力エリア（Dropzone 対応）── */}
            <div
                className={`p-4 border-t transition-all duration-200 ${isDragOver
                    ? "border-blue-500 bg-blue-900/20 shadow-[inset_0_0_20px_rgba(59,130,246,0.1)]"
                    : "border-gray-700 bg-gray-900/50"
                    }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {/* ドラッグオーバーレイ */}
                {isDragOver && (
                    <div className="mb-3 flex items-center justify-center gap-2 py-4 rounded-lg border-2 border-dashed border-blue-500/50 bg-blue-500/5 text-blue-400 text-xs font-medium">
                        <Paperclip size={16} />
                        ファイルをここにドロップ (.txt, .md, .pdf, 画像 ...)
                    </div>
                )}

                {/* 検索中インジケーター */}
                {isSearching && (
                    <div className="mb-2 flex items-center gap-2 px-3 py-1.5 rounded-md bg-emerald-900/20 border border-emerald-700/30 text-emerald-400 text-[11px]">
                        <Loader2 size={12} className="animate-spin" />
                        Web検索中...
                    </div>
                )}

                {/* 添付ファイルチップ + 画像プレビュー */}
                {(attachedFiles.length > 0 || attachedImages.length > 0) && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                        {attachedFiles.map(file => (
                            <AttachmentChip
                                key={file.id}
                                file={file}
                                onRemove={removeFile}
                            />
                        ))}
                        {attachedImages.map(img => (
                            <div
                                key={img.id}
                                className="relative group flex items-center gap-1.5 pl-1 pr-1 py-1 rounded-md text-[11px] border bg-violet-900/20 border-violet-700/40 text-violet-300"
                            >
                                <img
                                    src={img.preview}
                                    alt={img.name}
                                    className="w-8 h-8 rounded object-cover border border-violet-600/30"
                                />
                                <span className="truncate max-w-[100px] font-medium" title={img.name}>
                                    {img.name}
                                </span>
                                <span className="text-[9px] opacity-60 whitespace-nowrap">
                                    {formatFileSize(img.size)}
                                </span>
                                <button
                                    onClick={() => removeImage(img.id)}
                                    className="p-0.5 rounded hover:bg-gray-600/50 transition-colors shrink-0"
                                    title="画像を取り消し"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="relative flex flex-col gap-2">
                    <textarea
                        ref={textareaRef}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        onContextMenu={(e) => {
                            e.preventDefault();
                            const api = (window as any).electronAPI;
                            if (api && api.showContextMenu) {
                                api.showContextMenu();
                            }
                        }}
                        placeholder={
                            isGenerating
                                ? "生成中..."
                                : hasParsing
                                    ? "ファイル解析中..."
                                    : "AIに質問する (Shift+Enter送信 / ファイル・画像D&D対応)"
                        }
                        disabled={isGenerating}
                        style={{ fontSize: `${fontSize}px` }}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 pr-20 text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all resize-none min-h-[80px] max-h-[300px] overflow-y-auto disabled:opacity-50"
                    />
                    <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
                        {/* 📎 ファイル添付ボタン */}
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isGenerating}
                            className="p-2 rounded-md text-gray-400 hover:text-blue-400 hover:bg-gray-700/50 transition-all"
                            title="ファイルを添付 (.txt, .md, .pdf, ...)"
                        >
                            <Paperclip size={16} />
                        </button>
                        {/* 送信ボタン */}
                        <button
                            onClick={handleSend}
                            disabled={!inputValue.trim() || isGenerating || hasParsing}
                            className={`p-2 rounded-md transition-all ${inputValue.trim() && !isGenerating && !hasParsing
                                ? "bg-blue-600 hover:bg-blue-500 text-white"
                                : "bg-gray-700 text-gray-500 cursor-not-allowed"
                                }`}
                        >
                            {isGenerating ? (
                                <div className="w-4.5 h-4.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Send size={18} />
                            )}
                        </button>
                    </div>
                    {/* 隠しファイル入力 */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept=".txt,.md,.csv,.json,.log,.xml,.yaml,.yml,.toml,.ini,.pdf,.js,.ts,.tsx,.jsx,.py,.rs,.html,.css,.scss,.sh,.bash,.jpg,.jpeg,.png,.webp,.gif,.bmp,image/*"
                        className="hidden"
                        onChange={(e) => {
                            if (e.target.files) {
                                handleFiles(e.target.files);
                                e.target.value = ""; // リセット
                            }
                        }}
                    />
                </div>

                <div className="mt-2 text-[10px] text-gray-500 text-center uppercase tracking-widest flex items-center justify-center gap-1.5">
                    <span className={`w-1 h-1 rounded-full animate-pulse ${error ? "bg-red-500" : "bg-green-500"}`} />
                    AHME Context-Aware AI
                    {webSearchEnabled && (
                        <span className="normal-case tracking-normal text-emerald-400/70">
                            · 🌐 Web
                        </span>
                    )}
                    {totalAttachments > 0 && (
                        <span className="normal-case tracking-normal text-blue-400/70">
                            · {totalAttachments}件の添付
                        </span>
                    )}
                </div>
            </div>
        </div >
    );
}