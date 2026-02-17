"use client";

import React, { useEffect } from "react";

interface SaveConfirmDialogProps {
    isOpen: boolean;
    fileName: string;
    onSave: () => void;
    onDiscard: () => void;
    onCancel: () => void;
}

/**
 * 未保存の変更がある場合の確認ダイアログ
 * 「キャンセル(C)」「破棄(D)」「保存(S)」の3つの選択肢を提供
 */
export default function SaveConfirmDialog({
    isOpen,
    fileName,
    onSave,
    onDiscard,
    onCancel,
}: SaveConfirmDialogProps) {
    // キーボードショートカット (S, D, C) のサポート
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
            if (key === "s") {
                e.preventDefault();
                onSave();
            } else if (key === "d") {
                e.preventDefault();
                onDiscard();
            } else if (key === "c" || key === "escape") {
                e.preventDefault();
                onCancel();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onSave, onDiscard, onCancel]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-gray-800 border border-gray-700 shadow-2xl rounded-lg w-full max-w-md overflow-hidden">
                <div className="p-6">
                    <h2 className="text-xl font-bold mb-2 text-white">変更を保存しますか？</h2>
                    <p className="text-gray-300 mb-6">
                        「<span className="font-semibold text-blue-400">{fileName}</span>」への変更を保存しますか？
                        <br />
                        保存しない場合、変更は失われます。
                    </p>

                    <div className="flex flex-col sm:flex-row-reverse gap-2">
                        <button
                            onClick={onSave}
                            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 px-4 rounded transition-colors"
                            title="保存 (S)"
                        >
                            保存(<span className="underline">S</span>)
                        </button>
                        <button
                            onClick={onDiscard}
                            className="flex-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-900/50 font-medium py-2 px-4 rounded transition-colors"
                            title="破棄 (D)"
                        >
                            破棄(<span className="underline">D</span>)
                        </button>
                        <button
                            onClick={onCancel}
                            className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-200 font-medium py-2 px-4 rounded transition-colors"
                            title="キャンセル (C)"
                        >
                            キャンセル(<span className="underline">C</span>)
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
