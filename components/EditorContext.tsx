"use client";

import React, { createContext, useContext, useRef, useCallback, useState } from "react";

/**
 * EditorContext — Monaco Editor インスタンスをアプリ全体で共有するための Context。
 *
 * 設計:
 * - editorRef/monacoRef は ref で保持（パフォーマンス）
 * - editorReady は state で保持（コンシューマーに通知するため）
 * - insertWithHighlight はカーソル位置に挿入 + ハイライト + 確定/破棄UI
 */

const AI_WIDGET_ID = "ai-completion-confirm-widget";

interface EditorContextType {
    registerEditor: (editor: any, monaco: any) => void;
    unregisterEditor: () => void;
    insertAtCursor: (text: string) => void;
    insertWithHighlight: (text: string) => void;
    cleanupAiUI: () => void;
    getEditor: () => any | null;
    getMonaco: () => any | null;
    editorReady: boolean;
}

const EditorContext = createContext<EditorContextType | null>(null);

function ensureStyles() {
    if (typeof document === "undefined") return;
    if (document.getElementById("ai-completion-styles")) return;

    const style = document.createElement("style");
    style.id = "ai-completion-styles";
    style.textContent = `
        .ai-inserted-highlight {
            background-color: rgba(74, 222, 128, 0.12) !important;
            border-left: 3px solid rgba(74, 222, 128, 0.6);
        }
        .ai-confirm-widget {
            display: flex;
            gap: 6px;
            padding: 6px 8px;
            background: #1e293b;
            border: 1px solid rgba(74, 222, 128, 0.3);
            border-radius: 8px;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(74, 222, 128, 0.1);
            z-index: 9999;
            backdrop-filter: blur(8px);
            animation: ai-widget-in 0.2s ease-out;
        }
        @keyframes ai-widget-in {
            from { opacity: 0; transform: translateY(-4px) scale(0.95); }
            to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .ai-confirm-btn {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 4px 12px;
            border: none;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.15s ease;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .ai-confirm-btn span {
            font-size: 13px;
        }
        .ai-confirm-accept {
            background: rgba(74, 222, 128, 0.15);
            color: #4ade80;
            border: 1px solid rgba(74, 222, 128, 0.3);
        }
        .ai-confirm-accept:hover {
            background: rgba(74, 222, 128, 0.25);
            border-color: rgba(74, 222, 128, 0.5);
            box-shadow: 0 0 8px rgba(74, 222, 128, 0.2);
        }
        .ai-confirm-discard {
            background: rgba(239, 68, 68, 0.1);
            color: #f87171;
            border: 1px solid rgba(239, 68, 68, 0.2);
        }
        .ai-confirm-discard:hover {
            background: rgba(239, 68, 68, 0.2);
            border-color: rgba(239, 68, 68, 0.4);
            box-shadow: 0 0 8px rgba(239, 68, 68, 0.15);
        }
    `;
    document.head.appendChild(style);
}

export function EditorProvider({ children }: { children: React.ReactNode }) {
    const editorRef = useRef<any>(null);
    const monacoRef = useRef<any>(null);
    const decorationCollectionRef = useRef<any>(null);
    const contentWidgetRef = useRef<any>(null);
    const insertedRangeRef = useRef<any>(null);
    const [editorReady, setEditorReady] = useState(false);

    const registerEditor = useCallback((editor: any, monaco: any) => {

        editorRef.current = editor;
        monacoRef.current = monaco;
        setEditorReady(true);
        ensureStyles();

        // エディタが破棄された場合に自動的に登録解除
        editor.onDidDispose(() => {

            if (editorRef.current === editor) {
                editorRef.current = null;
                monacoRef.current = null;
                setEditorReady(false);
            }
        });
    }, []);

    const unregisterEditor = useCallback(() => {

        editorRef.current = null;
        monacoRef.current = null;
        setEditorReady(false);
    }, []);

    const getEditor = useCallback(() => editorRef.current, []);
    const getMonaco = useCallback(() => monacoRef.current, []);

    const cleanupAiUI = useCallback(() => {
        const editor = editorRef.current;

        if (decorationCollectionRef.current) {
            decorationCollectionRef.current.clear();
            decorationCollectionRef.current = null;
        }

        if (contentWidgetRef.current && editor) {
            try { editor.removeContentWidget(contentWidgetRef.current); } catch { /* ok */ }
            const domNode = contentWidgetRef.current._domNode;
            if (domNode?.parentNode) domNode.parentNode.removeChild(domNode);
            contentWidgetRef.current = null;
        }

        insertedRangeRef.current = null;
    }, []);

    const insertAtCursor = useCallback((text: string) => {
        const editor = editorRef.current;
        const monaco = monacoRef.current;
        if (!editor || !monaco) {
            console.warn("[EditorContext] insertAtCursor: Editor not available", {
                editorRef: !!editorRef.current,
                monacoRef: !!monacoRef.current,
            });
            return;
        }

        const position = editor.getPosition();
        const selection = editor.getSelection();

        const range = (selection && !selection.isEmpty())
            ? selection
            : new monaco.Range(
                position?.lineNumber ?? 1,
                position?.column ?? 1,
                position?.lineNumber ?? 1,
                position?.column ?? 1
            );

        editor.executeEdits("context-insert", [{
            range,
            text,
            forceMoveMarkers: true,
        }]);

        editor.focus();
    }, []);

    const insertWithHighlight = useCallback((text: string) => {
        const editor = editorRef.current;
        const monaco = monacoRef.current;
        if (!editor || !monaco) {
            console.warn("[EditorContext] insertWithHighlight: Editor not available", {
                editorRef: !!editorRef.current,
                monacoRef: !!monacoRef.current,
                editorReady,
            });
            return;
        }

        cleanupAiUI();

        const position = editor.getPosition();
        const selection = editor.getSelection();

        const insertRange = (selection && !selection.isEmpty())
            ? selection
            : new monaco.Range(
                position?.lineNumber ?? 1,
                position?.column ?? 1,
                position?.lineNumber ?? 1,
                position?.column ?? 1
            );

        const startLine = insertRange.startLineNumber;
        const startCol = insertRange.startColumn;

        editor.executeEdits("context-insert-highlight", [{
            range: insertRange,
            text,
            forceMoveMarkers: true,
        }]);

        const lines = text.split("\n");
        let endLine: number;
        let endCol: number;
        if (lines.length === 1) {
            endLine = startLine;
            endCol = startCol + text.length;
        } else {
            endLine = startLine + lines.length - 1;
            endCol = lines[lines.length - 1].length + 1;
        }

        insertedRangeRef.current = { startLine, startCol, endLine, endCol };

        const highlightRange = new monaco.Range(startLine, startCol, endLine, endCol);

        decorationCollectionRef.current = editor.createDecorationsCollection([{
            range: highlightRange,
            options: {
                isWholeLine: false,
                className: "ai-inserted-highlight",
                overviewRuler: {
                    color: "#4ade8066",
                    position: monaco.editor.OverviewRulerLane.Center,
                },
            },
        }]);

        // ── ContentWidget ──
        const domNode = document.createElement("div");
        domNode.className = "ai-confirm-widget";
        domNode.innerHTML = `
            <button class="ai-confirm-btn ai-confirm-accept" title="確定（テキストを定着）">
                <span>✅</span> 確定
            </button>
            <button class="ai-confirm-btn ai-confirm-discard" title="破棄（元に戻す）">
                <span>❌</span> 破棄
            </button>
        `;

        domNode.querySelector(".ai-confirm-accept")!.addEventListener("click", (e) => {
            e.stopPropagation();
            cleanupAiUI();
            editorRef.current?.focus();
        });

        domNode.querySelector(".ai-confirm-discard")!.addEventListener("click", (e) => {
            e.stopPropagation();
            const saved = insertedRangeRef.current;
            const currentEditor = editorRef.current;
            const currentMonaco = monacoRef.current;
            cleanupAiUI();
            if (saved && currentEditor?.getModel() && currentMonaco) {
                currentEditor.executeEdits("discard-insert", [{
                    range: new currentMonaco.Range(
                        saved.startLine, saved.startCol,
                        saved.endLine, saved.endCol
                    ),
                    text: "",
                    forceMoveMarkers: true,
                }]);
            }
            currentEditor?.focus();
        });

        const widget = {
            _domNode: domNode,
            getId: () => AI_WIDGET_ID,
            getDomNode: () => domNode,
            getPosition: () => ({
                position: { lineNumber: endLine, column: endCol },
                preference: [
                    monaco.editor.ContentWidgetPositionPreference.BELOW,
                    monaco.editor.ContentWidgetPositionPreference.ABOVE,
                ],
            }),
        };

        contentWidgetRef.current = widget;
        editor.addContentWidget(widget);
        editor.focus();
        editor.revealLineInCenter(endLine);


    }, [cleanupAiUI, editorReady]);

    return (
        <EditorContext.Provider
            value={{
                registerEditor,
                unregisterEditor,
                insertAtCursor,
                insertWithHighlight,
                cleanupAiUI,
                getEditor,
                getMonaco,
                editorReady,
            }}
        >
            {children}
        </EditorContext.Provider>
    );
}

export function useEditorContext(): EditorContextType {
    const ctx = useContext(EditorContext);
    if (!ctx) {
        throw new Error("useEditorContext must be used within EditorProvider");
    }
    return ctx;
}

export default EditorContext;
