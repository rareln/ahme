"use client";

import React from "react";
// ★ EditorContext から useEditorContext をインポート
import { useEditorContext } from "./EditorContext"; 

interface HeaderProps {
  onOpenFile: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onExportPdf?: () => void;
  onSearch: () => void;
  onReplace: () => void;
  onSettings: () => void;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  aiEnabled: boolean;
  onToggleAi: () => void;
}

/** アイコン＋テキスト形式メニューバー */
export default function Header({
  onOpenFile,
  onSave,
  onSaveAs,
  onExportPdf,
  onSearch,
  onReplace,
  onSettings,
  fontSize,
  onFontSizeChange,
  aiEnabled,
  onToggleAi,
}: HeaderProps) {
  
  // ★ コンテキストを取得
  const editorContext = useEditorContext(); 

  // --- Undo / Redo 実行関数 ---
  const handleUndo = () => {
    // ★ getEditor() メソッドを使ってエディタ本体を取得する！
    const editor = editorContext.getEditor();
    if (editor) {
      editor.trigger('source', 'undo', null);
      editor.focus();
    }
  };

  const handleRedo = () => {
    // ★ 同様に getEditor() メソッドを使用
    const editor = editorContext.getEditor();
    if (editor) {
      editor.trigger('source', 'redo', null);
      editor.focus();
    }
  };

  return (
    <header className="flex items-center justify-between px-4 py-2 bg-ahme-header border-b border-ahme-border">
      {/* 左: ファイル操作アイコン＋ラベル */}
      <div className="flex items-center gap-1">
        <MenuButton icon="📂" label="開く" onClick={onOpenFile} />
        <MenuButton icon="💾" label="保存" onClick={onSave} />
        <MenuButton icon="📝" label="別名保存" onClick={onSaveAs} />
        {onExportPdf && (
          <MenuButton icon="📄" label="PDF出力" onClick={onExportPdf} />
        )}
        <div className="w-px h-6 bg-ahme-divider mx-1" />
        
        {/* ★ 追加: 検索の左側に 元に戻す / やり直し ボタンを配置 */}
        <MenuButton icon="↩️" label="元に戻す" onClick={handleUndo} />
        <MenuButton icon="↪️" label="やり直し" onClick={handleRedo} />
        <div className="w-px h-6 bg-ahme-divider mx-1" />

        <MenuButton icon="🔍" label="検索" onClick={onSearch} />
        <MenuButton icon="🔄" label="置換" onClick={onReplace} />
        <div className="w-px h-6 bg-ahme-divider mx-1" />
        <MenuButton icon="⚙️" label="設定" onClick={onSettings} />
        <div className="w-px h-6 bg-ahme-divider mx-1" />
        <div className="flex items-center gap-0.5 text-sm">
          <button
            onClick={() => onFontSizeChange(Math.max(10, fontSize - 1))}
            className="px-1.5 py-1 rounded hover:bg-ahme-primary-muted transition-colors text-ahme-text-secondary hover:text-white font-bold text-base leading-none"
            title="文字を小さく"
          >
            −
          </button>
          <span className="text-sm font-bold text-ahme-text-primary w-8 text-center select-none tabular-nums">{fontSize}</span>
          <button
            onClick={() => onFontSizeChange(Math.min(32, fontSize + 1))}
            className="px-1.5 py-1 rounded hover:bg-ahme-primary-muted transition-colors text-ahme-text-secondary hover:text-white font-bold text-base leading-none"
            title="文字を大きく"
          >
            ＋
          </button>
        </div>
      </div>

      {/* 右: AI連携トグル */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-ahme-text-secondary">AI連携</span>
        <button
          onClick={onToggleAi}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${aiEnabled ? "bg-ahme-toggle-on" : "bg-ahme-toggle-off"
            }`}
          title={aiEnabled ? "AI連携 ON" : "AI連携 OFF"}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${aiEnabled ? "translate-x-5" : "translate-x-0.5"
              }`}
          />
        </button>
        <span className="text-sm w-6 text-center text-ahme-text-secondary">
          {aiEnabled ? "ON" : "OFF"}
        </span>
      </div>
    </header>
  );
}

/** アイコン＋ラベル付きメニューボタン */
function MenuButton({
  icon,
  label,
  onClick,
}: {
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 px-2 py-1 rounded hover:bg-ahme-surface-hover transition-colors text-sm"
      title={label}
    >
      <span className="text-base">{icon}</span>
      <span className="text-sm text-ahme-text-primary">{label}</span>
    </button>
  );
}