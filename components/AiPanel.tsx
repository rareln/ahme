"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Trash2, ChevronDown, AlertCircle, RefreshCw } from "lucide-react";

interface Message {
    role: "user" | "assistant" | "system";
    content: string;
}

interface AiPanelProps {
    editorContent: string;
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

    const fetchModels = async () => {
        setIsLoadingModels(true);
        setError(null);
        try {
            console.log("[AiPanel] Fetching models...");
            const response = await fetch("/api/models", { cache: "no-store" });

            if (!response.ok) {
                // JSONでないエラーレスポンス（HTML等）の可能性を考慮
                const text = await response.text();
                let errMsg = `HTTP ${response.status}`;
                try {
                    const json = JSON.parse(text);
                    errMsg = json.error || errMsg;
                } catch (e) {
                    errMsg = text.substring(0, 50) || errMsg;
                }
                throw new Error(errMsg);
            }

            const data = await response.json();
            console.log("[AiPanel] Models data:", data);

            if (data.models && Array.isArray(data.models) && data.models.length > 0) {
                setAvailableModels(data.models);

                // gemma3:12b が存在すればデフォルト選択
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

    useEffect(() => {
        fetchModels();
    }, []);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async () => {
        if (!inputValue.trim() || isGenerating) return;

        const userText = inputValue;
        const newMessages: Message[] = [
            ...messages,
            { role: "user", content: userText },
        ];

        setMessages(newMessages);
        setInputValue("");
        setIsGenerating(true);
        setError(null);

        abortControllerRef.current = new AbortController();

        try {
            // 日本語回答をより強力に要請するプロンプト
            const systemPrompt = "あなたはAHMEというエディタのAIアシスタントです。回答は必ず「日本語」で行ってください。絶対に英語を使わないでください。親しみやすく、丁寧な敬語を使ってください。";
            const fullContext = `以下のドキュメントの内容に基づいて回答してください。\n\n--- Context ---\n${editorContent}\n\n--- User Question ---\n${userText}`;

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
                } catch (e) {
                    errMsg = text.substring(0, 50) || errMsg;
                }
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
                    next[next.length - 1] = {
                        ...next[next.length - 1],
                        content: assistantContent
                    };
                    return next;
                });
            }
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
    };

    return (
        <div className="flex flex-col h-full bg-[#111827] border-l border-gray-700 text-sm">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700 bg-gray-800/50">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-gray-200">
                        <Bot size={16} className="text-blue-400" />
                        <span className="font-semibold whitespace-nowrap">AI Assistant</span>
                    </div>

                    <div className="flex items-center gap-1.5 bg-gray-900/50 px-2 py-0.5 rounded border border-gray-700">
                        <button
                            onClick={() => setFontSize(Math.max(10, fontSize - 1))}
                            className="text-gray-400 hover:text-white transition-colors"
                            title="文字を小さく"
                        >
                            -
                        </button>
                        <span className="text-[10px] text-gray-400 w-4 text-center select-none">{fontSize}</span>
                        <button
                            onClick={() => setFontSize(Math.min(30, fontSize + 1))}
                            className="text-gray-400 hover:text-white transition-colors"
                            title="文字を大きく"
                        >
                            +
                        </button>
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

                    <button
                        onClick={handleClear}
                        className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-red-400 transition-colors"
                        title="履歴をクリア"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent"
            >
                {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-2 opacity-50">
                        <Bot size={48} strokeWidth={1} />
                        <p>エディタの内容について質問してみましょう</p>
                    </div>
                ) : (
                    messages.filter(m => m.role !== "system").map((msg, i) => (
                        <div
                            key={i}
                            className={`flex gap-3 ${msg.role === "assistant" ? "bg-gray-800/30 -mx-4 px-4 py-3" : ""
                                }`}
                        >
                            <div className="mt-1 shrink-0">
                                {msg.role === "assistant" ? (
                                    <div className="bg-blue-600 p-1 rounded text-white shadow-sm">
                                        <Bot size={14} />
                                    </div>
                                ) : (
                                    <div className="bg-gray-600 p-1 rounded text-white shadow-sm">
                                        <User size={14} />
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0 space-y-1">
                                <div className="font-semibold text-[10px] text-gray-500 uppercase tracking-tighter">
                                    {msg.role === "assistant" ? "Assistant" : "You"}
                                </div>
                                <div
                                    className={`text-gray-200 leading-relaxed whitespace-pre-wrap ${msg.role === "assistant" && i === messages.length - 1 && isGenerating ? "border-r-2 border-blue-500 animate-pulse" : ""
                                        }`}
                                    style={{ fontSize: `${fontSize}px` }}
                                >
                                    {msg.content}
                                </div>
                            </div>
                        </div>
                    ))
                )}

                {error && (
                    <div className="bg-red-900/20 border border-red-800 rounded-md p-3 text-red-400 text-xs flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
                        <AlertCircle size={14} className="mt-0.5 shrink-0" />
                        <div>
                            <p className="font-semibold">Error</p>
                            <p className="opacity-80 break-all">{error}</p>
                        </div>
                    </div>
                )}
            </div>

            <div className="p-4 border-t border-gray-700 bg-gray-900/50">
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
                        placeholder={isGenerating ? "生成中..." : "AIに質問する (Shift+Enterで送信)"}
                        disabled={isGenerating}
                        style={{ fontSize: `${fontSize}px` }}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 pr-12 text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all resize-none min-h-[80px] disabled:opacity-50"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!inputValue.trim() || isGenerating}
                        className={`absolute bottom-3 right-3 p-2 rounded-md transition-all ${inputValue.trim() && !isGenerating
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
                <div className="mt-2 text-[10px] text-gray-500 text-center uppercase tracking-widest flex items-center justify-center gap-1.5">
                    <span className={`w-1 h-1 rounded-full animate-pulse ${error ? "bg-red-500" : "bg-green-500"}`} />
                    AHME Context-Aware AI
                </div>
            </div>
        </div>
    );
}
