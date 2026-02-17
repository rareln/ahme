"use client";

import React from "react";

interface HeaderProps {
  onOpenFile: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onSearch: () => void;
  onReplace: () => void;
  onSettings: () => void;
  aiEnabled: boolean;
  onToggleAi: () => void;
}

/** アイコン＋テキスト形式メニューバー */
export default function Header({
  onOpenFile,
  onSave,
  onSaveAs,
  onSearch,
  onReplace,
  onSettings,
  aiEnabled,
  onToggleAi,
}: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-2 py-1.5 bg-gray-800 text-white border-b border-gray-700 select-none">
      {/* 左: ファイル操作アイコン＋ラベル */}
      <div className="flex items-center gap-1">
        <MenuButton icon="📂" label="開く" onClick={onOpenFile} />
        <MenuButton icon="💾" label="保存" onClick={onSave} />
        <MenuButton icon="📝" label="別名保存" onClick={onSaveAs} />
        <div className="w-px h-6 bg-gray-600 mx-1" />
        <MenuButton icon="🔍" label="検索" onClick={onSearch} />
        <MenuButton icon="🔄" label="置換" onClick={onReplace} />
        <div className="w-px h-6 bg-gray-600 mx-1" />
        <MenuButton icon="⚙️" label="設定" onClick={onSettings} />
      </div>

      {/* 右: AI連携トグル */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-300">AI連携</span>
        <button
          onClick={onToggleAi}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${aiEnabled ? "bg-green-500" : "bg-gray-600"
            }`}
          title={aiEnabled ? "AI連携 ON" : "AI連携 OFF"}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${aiEnabled ? "translate-x-5" : "translate-x-0.5"
              }`}
          />
        </button>
        <span className="text-sm w-6 text-center text-gray-300">
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
      className="flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-700 transition-colors text-sm"
      title={label}
    >
      <span className="text-base">{icon}</span>
      <span className="text-sm text-gray-200">{label}</span>
    </button>
  );
}
