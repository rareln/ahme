"use client";

import React, { useRef, useEffect } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import type { AppSettings } from "./SettingsDialog";

interface EditorProps {
    defaultValue: string;
    language: string;
    settings: AppSettings;
    onChange: (value: string) => void;
    onCursorChange: (line: number, column: number) => void;
    showSearch?: number;
    showReplace?: number;
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

        // 検索・置換のトリガー監視
        useEffect(() => {
            if (editorRef.current && showSearch) {
                editorRef.current.getAction("actions.find").run();
            }
        }, [showSearch]);

        useEffect(() => {
            if (editorRef.current && showReplace) {
                // Monacoで置換窓を直接開くアクション
                editorRef.current.trigger('keyboard', 'editor.action.startFindReplaceAction', {});
            }
        }, [showReplace]);

        const handleEditorDidMount: OnMount = (editor) => {
            editorRef.current = editor;

            // フォーカスを設定
            editor.focus();

            // カーソル位置変更の監視
            editor.onDidChangeCursorPosition((e) => {
                onCursorChange(e.position.lineNumber, e.position.column);
            });
        };

        const handleEditorChange = (value: string | undefined) => {
            if (value !== undefined) {
                onChange(value);
            }
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
                        renderLineHighlightOnlyWhenFocus: false, // フォーカスが外れてもハイライト
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
