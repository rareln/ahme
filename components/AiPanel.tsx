"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Send, Bot, User, Trash2, ChevronDown, AlertCircle, RefreshCw, Paperclip, X, FileText, Loader2 } from "lucide-react";
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
                        {block.content}
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
    const buttonRef = useRef<HTMLDivElement>(null);

    const handleMouseUp = useCallback(() => {
        setTimeout(() => {
            const sel = window.getSelection();
            const text = sel?.toString()?.trim();
            if (!text || text.length < 2) {
                setVisible(false);
                return;
            }

            const container = containerRef.current;
            if (!container || !sel?.anchorNode) {
                setVisible(false);
                return;
            }
            if (!container.contains(sel.anchorNode)) {
                setVisible(false);
                return;
            }

            const range = sel.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();

            setSelectedText(text);
            setPosition({
                x: Math.min(rect.right - containerRect.left, containerRect.width - 140),
                y: rect.bottom - containerRect.top + 4,
            });
            setVisible(true);
        }, 10);
    }, [containerRef]);

    const handleMouseDown = useCallback((e: MouseEvent) => {
        if (buttonRef.current?.contains(e.target as Node)) return;
        setVisible(false);
    }, []);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        container.addEventListener("mouseup", handleMouseUp);
        document.addEventListener("mousedown", handleMouseDown);
        return () => {
            container.removeEventListener("mouseup", handleMouseUp);
            document.removeEventListener("mousedown", handleMouseDown);
        };
    }, [containerRef, handleMouseUp, handleMouseDown]);

    const handleInsert = () => {
        if (selectedText) {
            insertWithHighlight(selectedText);
            setVisible(false);
            window.getSelection()?.removeAllRanges();
        }
    };

    if (!visible) return null;

    return (
        <div ref={buttonRef} className="absolute z-50" style={{ left: position.x, top: position.y }}>
            <button
                onClick={handleInsert}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold
                           bg-emerald-500/15 text-emerald-400 border border-emerald-500/30
                           hover:bg-emerald-500/25 hover:border-emerald-500/50
                           hover:shadow-[0_0_12px_rgba(16,185,129,0.2)]
                           backdrop-filter backdrop-blur-sm transition-all duration-200"
                style={{ animation: "ai-widget-in 0.15s ease-out" }}
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
    const [fontSize, setFontSize] = useState(14);
    const [availableModels, setAvailableModels] = useState<string[]>([]);
    const [selectedModel, setSelectedModel] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [isLoadingModels, setIsLoadingModels] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // ── 添付ファイル State ──
    const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
    const [isDragOver, setIsDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

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

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    // ── ファイル添付処理 ──
    const handleFiles = useCallback(async (files: FileList | File[]) => {
        const fileArray = Array.from(files);

        for (const file of fileArray) {
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
        console.log(`[AiPanel] handleSend: ${currentAttachments.length} attachments, files:`, currentAttachments.map(f => `${f.name}(${f.text.length}chars)`));

        const newMessages: Message[] = [
            ...messages,
            {
                role: "user",
                content: currentAttachments.length > 0
                    ? `${userText}\n\n📎 添付: ${currentAttachments.map(f => f.name).join(", ")}`
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

            // 添付ファイルのコンテキスト構築
            let attachmentContext = "";
            if (currentAttachments.length > 0) {
                attachmentContext = currentAttachments
                    .map(f => `[添付資料: ${f.name}]\n${f.text}`)
                    .join("\n\n");
                attachmentContext = `\n\n--- 添付資料 ---\n${attachmentContext}\n`;
            }

            const fullContext = `以下のドキュメントの内容に基づいて回答してください。${attachmentContext}\n\n--- Context ---\n${editorContent}\n\n--- User Question ---\n${userText}`;

            console.log(`[AiPanel] fullContext length: ${fullContext.length}`);
            console.log(`[AiPanel] attachmentContext: ${attachmentContext ? attachmentContext.substring(0, 200) + '...' : '(none)'}`);

            const payload = {
                model: selectedModel || "llama3",
                messages: [
                    { role: "system", content: systemPrompt },
                    ...messages.map(m => ({ role: m.role, content: m.content })),
                    { role: "user", content: fullContext }
                ],
                stream: true,
            };

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
    };

    const hasParsing = attachedFiles.some(f => f.isParsing);
    const successFiles = attachedFiles.filter(f => !f.error && !f.isParsing);

    return (
        <div className="flex flex-col h-full bg-[#111827] border-l border-gray-700 text-sm">
            {/* ヘッダー */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700 bg-gray-800/50">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-gray-200">
                        <Bot size={16} className="text-blue-400" />
                        <span className="font-semibold whitespace-nowrap">AI Assistant</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-gray-900/50 px-2 py-0.5 rounded border border-gray-700">
                        <button onClick={() => setFontSize(Math.max(10, fontSize - 1))} className="text-gray-400 hover:text-white transition-colors" title="文字を小さく">-</button>
                        <span className="text-[10px] text-gray-400 w-4 text-center select-none">{fontSize}</span>
                        <button onClick={() => setFontSize(Math.min(30, fontSize + 1))} className="text-gray-400 hover:text-white transition-colors" title="文字を大きく">+</button>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative group flex items-center gap-1">
                        <select
                            value={selectedModel}
                            onChange={(e) => setSelectedModel(e.target.value)}
                            disabled={isLoadingModels}
                            className="appearance-none w-36 bg-gray-700 text-gray-200 text-[10px] px-2 py-1 pr-6 rounded cursor-pointer hover:bg-gray-600 transition-colors border border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 truncate disabled:opacity-50"
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
                            <RefreshCw size={14} />
                        </button>
                    </div>
                    <button onClick={handleClear} className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-red-400 transition-colors" title="履歴をクリア">
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            {/* メッセージエリア + テキスト選択挿入ボタン */}
            <div className="flex-1 overflow-hidden relative">
                <div
                    ref={scrollRef}
                    className="h-full overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent"
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

                <SelectionInsertButton containerRef={scrollRef} />
            </div>

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
                        ファイルをここにドロップ (.txt, .md, .pdf, ...)
                    </div>
                )}

                {/* 添付ファイルチップ */}
                {attachedFiles.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                        {attachedFiles.map(file => (
                            <AttachmentChip
                                key={file.id}
                                file={file}
                                onRemove={removeFile}
                            />
                        ))}
                    </div>
                )}

                <div className="relative flex flex-col gap-2">
                    <textarea
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        placeholder={
                            isGenerating
                                ? "生成中..."
                                : hasParsing
                                    ? "ファイル解析中..."
                                    : "AIに質問する (Shift+Enter送信 / ファイルD&D対応)"
                        }
                        disabled={isGenerating}
                        style={{ fontSize: `${fontSize}px` }}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 pr-20 text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all resize-none min-h-[80px] disabled:opacity-50"
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
                        accept=".txt,.md,.csv,.json,.log,.xml,.yaml,.yml,.toml,.ini,.pdf,.js,.ts,.tsx,.jsx,.py,.rs,.html,.css,.scss,.sh,.bash"
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
                    {successFiles.length > 0 && (
                        <span className="normal-case tracking-normal text-blue-400/70">
                            · {successFiles.length}件の添付
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
