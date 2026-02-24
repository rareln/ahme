"use client";

import React from "react";

interface StatusBarProps {
    /** カーソル行番号 (1始まり) */
    line: number;
    /** カーソル列番号 (1始まり) */
    column: number;
    /** 現在の言語モード */
    language: string;
}

/** ステータスバー：行/列・言語モードを表示 */
export default function StatusBar({ line, column, language }: StatusBarProps) {
    return (
        <div className="flex items-center justify-between px-4 py-1 bg-ahme-statusbar text-gray-300/60 text-xs border-t border-ahme-border select-none">
            <div className="flex gap-4">
                <span>行 {line}, 列 {column}</span>
            </div>
            <div className="flex gap-4 font-medium">
                <span>{language.toUpperCase()}</span>
            </div>
        </div>
    );
}