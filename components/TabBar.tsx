"use client";

import React, { useState, useRef, useEffect } from "react";
import { X, Plus, FileText } from "lucide-react";

export interface TabData {
    id: string;
    title: string;
    content: string;
    language: string;
    filePath?: string;
    isModified?: boolean;
}

interface TabBarProps {
    tabs: TabData[];
    activeTabId: string;
    onSelectTab: (id: string) => void;
    onAddTab: () => void;
    onCloseTab: (id: string) => void;
    onReorderTabs?: (newTabs: TabData[]) => void; // ★追加: 並び替えコールバック
}

export default function TabBar({
    tabs,
    activeTabId,
    onSelectTab,
    onAddTab,
    onCloseTab,
    onReorderTabs,
}: TabBarProps) {
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // ★追加: ドラッグ＆ドロップ用のState
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    // アクティブなタブが変わったら、そのタブが見える位置までスクロールする
    useEffect(() => {
        if (!scrollContainerRef.current) return;
        const activeEl = scrollContainerRef.current.querySelector('[data-active="true"]');
        if (activeEl) {
            activeEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
        }
    }, [activeTabId]);

    // ==========================================
    // ドラッグ＆ドロップのイベントハンドラ
    // ==========================================
    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = "move";
        // Firefox対策として必須のダミーデータ
        e.dataTransfer.setData("text/plain", index.toString());
    };

    const handleDragEnter = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        setDragOverIndex(index);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault(); // ドロップを許可するために必須
        e.dataTransfer.dropEffect = "move";
    };

    const handleDrop = (e: React.DragEvent, dropIndex: number) => {
        e.preventDefault();
        
        if (draggedIndex === null || draggedIndex === dropIndex) {
            setDraggedIndex(null);
            setDragOverIndex(null);
            return;
        }

        // 配列の要素を入れ替える
        const newTabs = [...tabs];
        const [draggedTab] = newTabs.splice(draggedIndex, 1);
        newTabs.splice(dropIndex, 0, draggedTab);

        if (onReorderTabs) {
            onReorderTabs(newTabs);
        }

        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    return (
        <div 
            className="flex items-end bg-ahme-tabbar border-b border-ahme-border overflow-x-auto select-none relative scrollbar-none"
            ref={scrollContainerRef}
        >
            {tabs.map((tab, index) => {
                const isActive = tab.id === activeTabId;
                const isDragged = draggedIndex === index;
                const isDragOver = dragOverIndex === index;

                return (
                    <div
                        key={tab.id}
                        data-active={isActive}
                        draggable // ★追加: ドラッグ可能にする
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragEnter={(e) => handleDragEnter(e, index)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, index)}
                        onDragEnd={handleDragEnd}
                        onClick={() => onSelectTab(tab.id)}
                        onAuxClick={(e) => {
                            if (e.button === 1) { // マウスの中ボタン（ホイール）クリックで閉じる
                                e.preventDefault();
                                onCloseTab(tab.id);
                            }
                        }}
                        className={`
                            group relative flex items-center min-w-[120px] max-w-[200px] h-9 px-3 border-r border-ahme-border cursor-pointer transition-all duration-150 rounded-t-lg overflow-hidden mt-1 ml-1
                            ${isActive 
                                ? "bg-ahme-bg text-blue-400 font-medium" // アクティブ時は背景色と同化
                                : "text-gray-400 hover:bg-ahme-bg/50 hover:text-gray-200"
                            }
                            ${isDragged ? "opacity-30" : "opacity-100"}
                        `}
                    >
                        {/* ドロップ位置を示す青いハイライト線 */}
                        {isDragOver && draggedIndex !== null && (
                            <div className={`absolute top-0 bottom-0 w-1 bg-blue-500 z-10 ${draggedIndex > index ? "left-0" : "right-0"}`} />
                        )}

                        {/* アクティブタブの上部にアクセントラインを表示 */}
                        {isActive && (
                            <div className="absolute top-0 left-0 right-0 h-[2px] bg-blue-500" />
                        )}

                        <FileText size={14} className={`mr-2 shrink-0 ${tab.isModified ? "text-amber-400" : "opacity-70"}`} />
                        
                        <span className={`truncate text-xs flex-1 ${tab.isModified ? "italic font-semibold" : ""}`}>
                            {tab.title}
                        </span>

                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onCloseTab(tab.id);
                            }}
                            className={`
                                ml-2 p-0.5 rounded-md flex items-center justify-center shrink-0 transition-colors
                                ${tab.isModified 
                                    ? "bg-amber-500/20 text-amber-500 hover:bg-amber-500 hover:text-white" 
                                    : "opacity-0 group-hover:opacity-100 hover:bg-gray-700/50"
                                }
                            `}
                            title="閉じる"
                        >
                            {tab.isModified ? <div className="w-2 h-2 rounded-full bg-current m-1" /> : <X size={14} />}
                        </button>
                    </div>
                );
            })}

            {/* 新規タブ追加ボタン */}
            <button
                onClick={onAddTab}
                className="flex items-center justify-center w-10 h-9 text-gray-500 hover:bg-ahme-bg/50 hover:text-gray-200 transition-colors shrink-0"
                title="新しいタブ (Ctrl+N)"
            >
                <Plus size={18} />
            </button>
        </div>
    );
}