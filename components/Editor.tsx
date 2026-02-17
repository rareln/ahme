"use client";

import React, { useRef, useEffect } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import type { AppSettings } from "./SettingsDialog";
import { useEditorContext } from "./EditorContext";

interface EditorProps {
    defaultValue: string;
    language: string;
    settings: AppSettings;
    onChange: (value: string) => void;
    onCursorChange: (line: number, column: number) => void;
    showSearch?: number;
    showReplace?: number;
}

/** AIモデルを取得（gemma3:12b優先） */
async function getDefaultModel(): Promise<string> {
    try {
        const res = await fetch("/api/models", { cache: "no-store" });
        if (!res.ok) return "gemma3:12b";
        const data = await res.json();
        if (data.models && Array.isArray(data.models) && data.models.length > 0) {
            const gemma = data.models.find((m: string) => m.includes("gemma3:12b"));
            return gemma || data.models[0];
        }
    } catch { /* ignore */ }
    return "gemma3:12b";
}

/** AI補完リクエスト（ストリーミングなし） */
async function requestAiCompletion(selectedText: string, model: string): Promise<string> {
    const systemPrompt =
        "あなたはAHMEというエディタのAIアシスタントです。" +
        "以下のテキストの文脈を読み取り、自然な形で続きの文章を執筆してください。" +
        "回答は続きの文章のみを出力してください。余計な説明やマークアップは不要です。" +
        "必ず日本語で回答してください。";

    const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model,
            stream: false,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: selectedText },
            ],
        }),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`AI API Error: ${res.status} - ${errText.substring(0, 100)}`);
    }

    const data = await res.json();
    if (data.message?.content) return data.message.content;
    if (data.choices?.[0]?.message?.content) return data.choices[0].message.content;
    throw new Error("レスポンスから内容を取得できませんでした");
}

/**
 * AHME 高機能エディタ (Electron版)
 */
const MemoEditor = React.memo(
    function MemoEditor({
        defaultValue,
        language,
        settings,
        onChange,
        onCursorChange,
        showSearch,
        showReplace,
    }: EditorProps) {
        const editorRef = useRef<any>(null);
        const monacoRef = useRef<any>(null);
        const modelRef = useRef<string>("gemma3:12b");
        const isGeneratingRef = useRef(false);
        const editorContext = useEditorContext();

        useEffect(() => {
            getDefaultModel().then((m) => { modelRef.current = m; });
        }, []);

        useEffect(() => {
            if (editorRef.current && showSearch) {
                editorRef.current.getAction("actions.find").run();
            }
        }, [showSearch]);

        useEffect(() => {
            if (editorRef.current && showReplace) {
                editorRef.current.trigger('keyboard', 'editor.action.startFindReplaceAction', {});
            }
        }, [showReplace]);

        const handleEditorDidMount: OnMount = (editor, monaco) => {
            editorRef.current = editor;
            monacoRef.current = monaco;

            // Context にエディタを登録（CSS注入も含む）
            editorContext.registerEditor(editor, monaco);

            editor.focus();

            editor.onDidChangeCursorPosition((e) => {
                onCursorChange(e.position.lineNumber, e.position.column);
            });

            // --- AI補完アクション ---
            editor.addAction({
                id: "ai-completion-action",
                label: "✨ AI補完 (続きを執筆)",
                keybindings: [
                    monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyM,
                ],
                contextMenuGroupId: "1_modification",
                contextMenuOrder: 0,
                precondition: undefined,

                run: async (ed) => {
                    if (isGeneratingRef.current) return;

                    editorContext.cleanupAiUI();

                    const selection = ed.getSelection();
                    if (!selection) return;

                    let selectedText = ed.getModel()?.getValueInRange(selection) ?? "";

                    if (!selectedText.trim()) {
                        const pos = ed.getPosition();
                        if (!pos) return;
                        const lineContent = ed.getModel()?.getLineContent(pos.lineNumber) ?? "";
                        if (!lineContent.trim()) return;
                        selectedText = lineContent;
                    }

                    isGeneratingRef.current = true;

                    const endPos = selection.isEmpty()
                        ? ed.getPosition()!
                        : selection.getEndPosition();

                    const placeholder = "\n[✨ AI生成中...]";
                    const placeholderRange = new monaco.Range(
                        endPos.lineNumber, endPos.column,
                        endPos.lineNumber, endPos.column
                    );

                    ed.executeEdits("ai-completion", [{
                        range: placeholderRange,
                        text: placeholder,
                        forceMoveMarkers: true,
                    }]);

                    try {
                        const result = await requestAiCompletion(selectedText, modelRef.current);
                        const resultText = result.trim();

                        const model = ed.getModel();
                        if (model) {
                            const fullText = model.getValue();
                            const phIdx = fullText.indexOf("[✨ AI生成中...]");
                            if (phIdx !== -1) {
                                const phPos = model.getPositionAt(phIdx);
                                const phEndPos = model.getPositionAt(phIdx + "[✨ AI生成中...]".length);
                                const phRange = new monaco.Range(
                                    phPos.lineNumber, phPos.column,
                                    phEndPos.lineNumber, phEndPos.column
                                );

                                // プレースホルダーを削除
                                ed.executeEdits("ai-completion-clear", [{
                                    range: phRange,
                                    text: "",
                                    forceMoveMarkers: true,
                                }]);

                                // カーソルをプレースホルダー位置にセット
                                ed.setPosition({
                                    lineNumber: phPos.lineNumber,
                                    column: phPos.column,
                                });

                                // Context の insertWithHighlight で挿入 + ハイライト + 確定/破棄UI
                                editorContext.insertWithHighlight(resultText);
                            }
                        }
                    } catch (err: any) {
                        const model = ed.getModel();
                        if (model) {
                            const fullText = model.getValue();
                            const phIdx = fullText.indexOf("[✨ AI生成中...]");
                            if (phIdx !== -1) {
                                const phPos = model.getPositionAt(phIdx);
                                const phEndPos = model.getPositionAt(phIdx + "[✨ AI生成中...]".length);
                                const phRange = new monaco.Range(
                                    phPos.lineNumber, phPos.column,
                                    phEndPos.lineNumber, phEndPos.column
                                );
                                ed.executeEdits("ai-completion-error", [{
                                    range: phRange,
                                    text: `[AI Error: ${err.message}]`,
                                    forceMoveMarkers: true,
                                }]);
                            }
                        }
                        console.error("[AI Completion] Error:", err);
                    } finally {
                        isGeneratingRef.current = false;
                    }
                },
            });
        };

        const handleEditorChange = (value: string | undefined) => {
            if (value !== undefined) onChange(value);
        };

        return (
            <div className="h-full w-full bg-transparent relative editor-container">
                <Editor
                    height="100%"
                    width="100%"
                    language={language}
                    defaultValue={defaultValue}
                    theme={settings.theme}
                    onChange={handleEditorChange}
                    onMount={handleEditorDidMount}
                    options={{
                        fontSize: settings.fontSize,
                        tabSize: settings.tabSize,
                        wordWrap: settings.wordWrap as any,
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        accessibilitySupport: "on",
                        cursorBlinking: "smooth",
                        fixedOverflowWidgets: true,
                        renderLineHighlight: "line",
                        renderLineHighlightOnlyWhenFocus: false,
                        lineNumbersMinChars: 3,
                        glyphMargin: false,
                        folding: false,
                        scrollbar: {
                            vertical: "visible",
                            horizontal: "visible",
                        },
                    }}
                />
            </div>
        );
    },
    (prevProps, nextProps) => {
        return (
            prevProps.defaultValue === nextProps.defaultValue &&
            prevProps.language === nextProps.language &&
            prevProps.showSearch === nextProps.showSearch &&
            prevProps.showReplace === nextProps.showReplace &&
            prevProps.settings.fontSize === nextProps.settings.fontSize &&
            prevProps.settings.wordWrap === nextProps.settings.wordWrap &&
            prevProps.settings.tabSize === nextProps.settings.tabSize &&
            prevProps.settings.theme === nextProps.settings.theme
        );
    }
);

export default MemoEditor;
