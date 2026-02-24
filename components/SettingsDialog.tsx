"use client";

import React, { useState, useEffect } from "react";

/** 設定データの型定義 */
export interface AppSettings {
    fontSize: number;
    wordWrap: "on" | "off" | "wordWrapColumn";
    theme: "vs-dark" | "vs" | "hc-black" | "violet";
    tabSize: number;
}

/** デフォルト設定 */
export const DEFAULT_SETTINGS: AppSettings = {
    fontSize: 14,
    wordWrap: "on",
    theme: "violet",
    tabSize: 4,
};

interface SettingsDialogProps {
    isOpen: boolean;
    settings: AppSettings;
    onClose: () => void;
    onSave: (settings: AppSettings) => void;
}

/** 共通の入力フィールドスタイル */
const inputClassName =
    "w-full rounded px-3 py-1.5 text-sm border focus:outline-none " +
    "bg-ahme-dialog-input text-white border-ahme-dialog-input-border focus:border-ahme-dialog-focus";

/** select要素用スタイル（ドロップダウンの背景色も統一） */
const selectClassName =
    inputClassName +
    " appearance-none [&>option]:bg-ahme-dialog-input [&>option]:text-white";

/** 設定ダイアログ（全ラベル日本語） */
export default function SettingsDialog({
    isOpen,
    settings,
    onClose,
    onSave,
}: SettingsDialogProps) {
    const [localSettings, setLocalSettings] = useState<AppSettings>(settings);

    // 開いた時に設定を同期
    useEffect(() => {
        if (isOpen) setLocalSettings(settings);
    }, [isOpen, settings]);

    if (!isOpen) return null;

    const handleSave = () => {
        onSave(localSettings);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="bg-ahme-dialog border border-ahme-dialog-border rounded-lg shadow-2xl w-[420px] p-6">
                <h2 className="text-lg font-bold text-ahme-dialog-title mb-4">⚙️ 設定</h2>

                {/* フォントサイズ */}
                <div className="mb-4">
                    <label className="block text-sm text-ahme-text-secondary mb-1">フォントサイズ</label>
                    <input
                        type="number"
                        min={10}
                        max={32}
                        value={localSettings.fontSize}
                        onChange={(e) =>
                            setLocalSettings({ ...localSettings, fontSize: Number(e.target.value) })
                        }
                        className={inputClassName}
                    />
                </div>

                {/* テーマ */}
                <div className="mb-4">
                    <label className="block text-sm text-ahme-text-secondary mb-1">テーマ</label>
                    <select
                        value={localSettings.theme}
                        onChange={(e) =>
                            setLocalSettings({
                                ...localSettings,
                                theme: e.target.value as AppSettings["theme"],
                            })
                        }
                        className={selectClassName}
                    >
                        <option value="AHME">AHME</option>
                        <option value="vs-dark">ダーク</option>
                        <option value="vs">ライト</option>
                        <option value="hc-black">ハイコントラスト</option>
                    </select>
                </div>

                {/* 行の折り返し */}
                <div className="mb-4">
                    <label className="block text-sm text-ahme-text-secondary mb-1">行の折り返し</label>
                    <select
                        value={localSettings.wordWrap}
                        onChange={(e) =>
                            setLocalSettings({
                                ...localSettings,
                                wordWrap: e.target.value as AppSettings["wordWrap"],
                            })
                        }
                        className={selectClassName}
                    >
                        <option value="on">する</option>
                        <option value="off">しない</option>
                    </select>
                </div>

                {/* タブサイズ */}
                <div className="mb-6">
                    <label className="block text-sm text-ahme-text-secondary mb-1">タブサイズ</label>
                    <input
                        type="number"
                        min={2}
                        max={8}
                        value={localSettings.tabSize}
                        onChange={(e) =>
                            setLocalSettings({ ...localSettings, tabSize: Number(e.target.value) })
                        }
                        className={inputClassName}
                    />
                </div>

                {/* ボタン */}
                <div className="flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 text-sm text-ahme-text-secondary hover:text-white rounded hover:bg-ahme-dialog-btn-muted transition-colors"
                    >
                        キャンセル
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-4 py-1.5 text-sm bg-ahme-dialog-btn hover:bg-ahme-dialog-btn-hover text-white rounded transition-colors"
                    >
                        保存
                    </button>
                </div>
            </div>
        </div>
    );
}