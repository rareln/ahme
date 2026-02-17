"use client";
import React, { useState, useEffect, useCallback } from "react";

/** タブデータの型定義 */
export interface TabData {
    id: string;
    title: string;
    content: string;
    language: string;
    filePath?: string;
    isModified: boolean;
}

interface TabBarProps {
    tabs: TabData[];
    activeTabId: string;
    onSelectTab: (id: string) => void;
    onAddTab: () => void;
    onCloseTab: (id: string) => void;
}

interface ContextMenuState {
    show: boolean;
    x: number;
    y: number;
    tabId: string | null;
}

/** Chrome風タブバー */
export default function TabBar({
    tabs,
    activeTabId,
    onSelectTab,
    onAddTab,
    onCloseTab,
}: TabBarProps) {
    const [contextMenu, setContextMenu] = useState<ContextMenuState>({
        show: false,
        x: 0,
        y: 0,
        tabId: null,
    });

    // メニュー外クリックで閉じる
    useEffect(() => {
        const handleClick = () => setContextMenu((prev) => ({ ...prev, show: false }));
        window.addEventListener("click", handleClick);
        return () => window.removeEventListener("click", handleClick);
    }, []);

    const handleContextMenu = useCallback((e: React.MouseEvent, id: string) => {
        e.preventDefault();
        setContextMenu({
            show: true,
            x: e.clientX,
            y: e.clientY,
            tabId: id,
        });
    }, []);

    const handleMouseDown = useCallback((e: React.MouseEvent, id: string) => {
        // ホイールクリック（中央ボタン）は button === 1
        if (e.button === 1) {
            e.preventDefault();
            onCloseTab(id);
        }
    }, [onCloseTab]);

    return (
        <div className="flex items-end bg-gray-900 border-b border-gray-700 overflow-x-auto select-none relative">
            {tabs.map((tab) => {
                const isActive = tab.id === activeTabId;
                return (
                    <div
                        key={tab.id}
                        onClick={() => onSelectTab(tab.id)}
                        onContextMenu={(e) => handleContextMenu(e, tab.id)}
                        onMouseDown={(e) => handleMouseDown(e, tab.id)}
                        className={`
                            group flex items-center gap-1 px-3 py-1.5 cursor-pointer
                            text-sm min-w-[100px] max-w-[200px] shrink-0
                            border-r border-gray-700 transition-colors
                            ${isActive
                                ? "bg-gray-800 text-white border-t-2 border-t-blue-500"
                                : "bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-gray-200 border-t-2 border-t-transparent"
                            }
                        `}
                    >
                        {/* タブタイトル */}
                        <span className="truncate flex-1">
                            {tab.isModified ? "● " : ""}
                            {tab.title}
                        </span>
                        {/* 閉じるボタン */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onCloseTab(tab.id);
                            }}
                            className="
                                w-5 h-5 flex items-center justify-center rounded
                                text-gray-500 hover:text-white hover:bg-gray-600
                                opacity-0 group-hover:opacity-100 transition-opacity
                            "
                            title="タブを閉じる"
                        >
                            ✕
                        </button>
                    </div>
                );
            })}
            {/* 新規タブ追加ボタン */}
            <button
                onClick={onAddTab}
                className="
                    flex items-center justify-center w-8 h-8 shrink-0
                    text-gray-400 hover:text-white hover:bg-gray-700
                    rounded transition-colors mx-1
                "
                title="新しいタブを追加"
            >
                +
            </button>

            {/* コンテキストメニュー */}
            {contextMenu.show && (
                <div
                    className="fixed z-50 bg-gray-800 border border-gray-600 shadow-xl rounded py-1 min-w-[150px] text-sm"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                    <button
                        className="w-full text-left px-4 py-1.5 hover:bg-blue-600 transition-colors"
                        onClick={() => {
                            if (contextMenu.tabId) onCloseTab(contextMenu.tabId);
                            setContextMenu((prev) => ({ ...prev, show: false }));
                        }}
                    >
                        このタブを閉じる
                    </button>
                    <button
                        className="w-full text-left px-4 py-1.5 hover:bg-blue-600 transition-colors border-t border-gray-700"
                        onClick={() => {
                            onAddTab();
                            setContextMenu((prev) => ({ ...prev, show: false }));
                        }}
                    >
                        新しいタブを追加
                    </button>
                </div>
            )}
        </div>
    );
}
