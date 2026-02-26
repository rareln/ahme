"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import Header from "@/components/Header";
import TabBar, { TabData } from "@/components/TabBar";
import MemoEditor from "@/components/Editor";
import StatusBar from "@/components/StatusBar";
import SettingsDialog, { AppSettings, DEFAULT_SETTINGS } from "@/components/SettingsDialog";
import SaveConfirmDialog from "@/components/SaveConfirmDialog";
import { DownloadProgressWidget } from "@/components/AiAssistantDialog";
import {
  Group as PanelGroup,
  Panel,
  Separator as PanelResizeHandle,
  type GroupImperativeHandle,
} from "react-resizable-panels";
import AiPanel from "@/components/AiPanel";
import { EditorProvider } from "@/components/EditorContext";

/** ユニークID生成 */
function generateId(): string {
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** 新規タブ作成（連番付き: 無題(1), 無題(2)...） */
function createNewTab(currentTabs: TabData[]): TabData {
  // 現在の「無題(n)」から使用されている番号を抽出
  const usedNumbers = currentTabs
    .map((t) => {
      const match = t.title.match(/^無題\((\d+)\)$/);
      return match ? parseInt(match[1], 10) : null;
    })
    .filter((n): n is number => n !== null);

  // 重複しない最小の正の整数を探す
  let nextNumber = 1;
  while (usedNumbers.includes(nextNumber)) {
    nextNumber++;
  }

  return {
    id: generateId(),
    title: `無題(${nextNumber})`,
    content: "",
    language: "markdown",
    isModified: false,
  };
}

/** セッションデータの型 */
interface SessionData {
  tabs: TabData[];
  activeTabId: string;
  settings: AppSettings;
  tabCounter: number;
  aiEnabled?: boolean;
  scrollPositions?: Record<string, number>;
}

const SESSION_KEY = "ahme-session";
const PANEL_LAYOUT_KEY = "ahme-panel-layout";

/** セッションをlocalStorageに保存 */
function saveSession(data: SessionData) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("セッション保存に失敗:", e);
  }
}

/** セッションをlocalStorageから復元 */
function loadSession(): SessionData | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionData;
  } catch (e) {
    console.error("セッション復元に失敗:", e);
    return null;
  }
}

/** パネルレイアウトをlocalStorageから復元（SSRセーフ） */
function loadPanelLayout(): any | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(PANEL_LAYOUT_KEY);
    if (!raw) return undefined;
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/** パネルレイアウトをlocalStorageに保存 */
function savePanelLayout(layout: any) {
  try {
    localStorage.setItem(PANEL_LAYOUT_KEY, JSON.stringify(layout));
  } catch { /* ignore */ }
}

/**
 * ElectronのIPC APIを呼び出す。
 */
async function openFileDialog() {
  return (window as any).electronAPI.openFile();
}

async function saveFileDialog(defaultName?: string) {
  return (window as any).electronAPI.getSavePath(defaultName);
}

async function readTextFile(path: string) {
  return (window as any).electronAPI.readFile(path);
}

async function writeTextFile(path: string, content: string) {
  return (window as any).electronAPI.writeFile(path, content);
}

/** ファイルパスからファイル名を取得 */
function getFileName(filePath: string): string {
  return filePath.split("/").pop() ?? filePath;
}

/** ファイル拡張子から言語モードを推定 */
function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    md: "markdown", txt: "plaintext",
    js: "javascript", jsx: "javascript",
    ts: "typescript", tsx: "typescript",
    json: "json", html: "html", css: "css",
    py: "python", rs: "rust", toml: "toml",
    yaml: "yaml", yml: "yaml", xml: "xml",
  };
  return map[ext] ?? "plaintext";
}

export default function Home() {
  // --- セッション復元 ---
  const [tabs, setTabs] = useState<TabData[]>(() => {
    if (typeof window === "undefined") return [createNewTab([])];
    const session = loadSession();
    if (session?.tabs?.length) {
      return session.tabs;
    }
    return [createNewTab([])];
  });

  const [activeTabId, setActiveTabId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    const session = loadSession();
    if (session?.activeTabId && session.tabs.some((t) => t.id === session.activeTabId)) {
      return session.activeTabId;
    }
    return "";
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    if (typeof window === "undefined") return DEFAULT_SETTINGS;
    const session = loadSession();
    return session?.settings ?? DEFAULT_SETTINGS;
  });

  // 初回レンダリング後にactiveTabIdを修正
  useEffect(() => {
    if (!activeTabId || !tabs.some((t) => t.id === activeTabId)) {
      setActiveTabId(tabs[0]?.id ?? "");
    }
  }, []);

  // --- UI状態 ---
  const [cursorLine, setCursorLine] = useState(1);
  const [cursorColumn, setCursorColumn] = useState(1);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    const session = loadSession();
    return session?.aiEnabled ?? true;
  });
  const [searchTrigger, setSearchTrigger] = useState(0);
  const [replaceTrigger, setReplaceTrigger] = useState(0);
  const [closingTabId, setClosingTabId] = useState<string | null>(null);

  // --- スクロール位置の管理 ---
  const [scrollPositions, setScrollPositions] = useState<Record<string, number>>(() => {
    if (typeof window === "undefined") return {};
    const session = loadSession();
    return session?.scrollPositions ?? {};
  });
  const scrollPositionsRef = useRef(scrollPositions);
  scrollPositionsRef.current = scrollPositions;

  // --- アクティブタブ取得 ---
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];

  // --- パネル比率の保存・復元 ---
  // Note: react-resizable-panels uses "groupRef" instead of "ref"
  const panelGroupRef = useRef<any>(null);
  const [layout, setLayout] = useState<any | undefined>(undefined);
  const [mounted, setMounted] = useState(false);

  // 初回マウント時に localStorage からレイアウトを復元 (SSR回避のため useEffect 内で実行)
  useEffect(() => {
    const saved = loadPanelLayout();
    if (saved) {
      setLayout(saved);
    }
    setMounted(true);
  }, []);

  const handlePanelLayoutChanged = useCallback((layout: any) => {
    savePanelLayout(layout);
  }, []);

  // --- セッション自動保存 ---
  const tabsRef = useRef(tabs);
  const activeTabIdRef = useRef(activeTabId);
  const settingsRef = useRef(settings);
  const aiEnabledRef = useRef(aiEnabled);
  tabsRef.current = tabs;
  activeTabIdRef.current = activeTabId;
  settingsRef.current = settings;
  aiEnabledRef.current = aiEnabled;

  useEffect(() => {
    const doSave = () => {
      saveSession({
        tabs: tabsRef.current,
        activeTabId: activeTabIdRef.current,
        settings: settingsRef.current,
        tabCounter: 0,
        aiEnabled: aiEnabledRef.current,
        scrollPositions: scrollPositionsRef.current,
      });
    };

    window.addEventListener("beforeunload", doSave);
    const interval = setInterval(doSave, 5000);

    return () => {
      window.removeEventListener("beforeunload", doSave);
      clearInterval(interval);
    };
  }, []);

  // --- タブ操作 ---
  const handleAddTab = useCallback(() => {
    setTabs((prev) => {
      const newTab = createNewTab(prev);
      return [...prev, newTab];
    });
  }, []);

  const doCloseTab = useCallback(
    (id: string) => {
      setTabs((prev) => {
        if (prev.length <= 1) {
          const newTab = createNewTab([]);
          setActiveTabId(newTab.id);
          return [newTab];
        }
        const idx = prev.findIndex((t) => t.id === id);
        const next = prev.filter((t) => t.id !== id);
        if (id === activeTabIdRef.current) {
          const newIdx = Math.min(idx, next.length - 1);
          setActiveTabId(next[newIdx].id);
        }
        return next;
      });
      setClosingTabId(null);
    },
    []
  );

  const handleCloseTab = useCallback(
    (id: string) => {
      const tab = tabsRef.current.find((t) => t.id === id);
      if (tab?.isModified) {
        setClosingTabId(id);
      } else {
        doCloseTab(id);
      }
    },
    [doCloseTab]
  );

  // --- タブの順番入れ替え ---
  const handleReorderTabs = useCallback((newTabs: TabData[]) => {
    setTabs(newTabs);
  }, []);

  const handleContentChange = useCallback(
    (newContent: string) => {
      setTabs((prev) =>
        prev.map((t) => {
          if (t.id !== activeTabIdRef.current) return t;

          let newTitle = t.title;
          const isUntitled = /^無題\(\d+\)$/.test(t.title) || t.title === "無題";

          if (isUntitled) {
            if (newContent.trim().length > 0) {
              const firstLine = newContent.split("\n")[0].trim();
              if (firstLine.length > 0) {
                newTitle = firstLine.slice(0, 20);
              }
            }
          } else if (newContent.trim().length === 0 && !t.filePath) {
            newTitle = "無題";
          }

          return { ...t, content: newContent, title: newTitle, isModified: true };
        })
      );
    },
    []
  );

  const handleCursorChange = useCallback((line: number, column: number) => {
    setCursorLine(line);
    setCursorColumn(column);
  }, []);

  // --- ファイル操作 ---
  const handleOpenFile = useCallback(async () => {
    try {
      const filePath = await openFileDialog();
      if (!filePath) return;
      const content = await readTextFile(filePath);
      const fileName = getFileName(filePath);
      const lang = getLanguageFromPath(filePath);
      const newTab: TabData = {
        id: generateId(),
        title: fileName,
        content,
        language: lang,
        filePath,
        isModified: false,
      };
      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(newTab.id);
    } catch (e) {
      console.error("ファイルを開く際にエラー:", e);
    }
  }, []);

  const handleSave = useCallback(async (tabId?: string) => {
    const id = tabId || activeTabIdRef.current;
    const tab = tabsRef.current.find((t) => t.id === id);
    if (!tab) return false;

    if (tab.filePath) {
      try {
        const success = await writeTextFile(tab.filePath, tab.content);
        if (success) {
          setTabs((prev) =>
            prev.map((t) =>
              t.id === tab.id ? { ...t, isModified: false } : t
            )
          );
          return true;
        }
        return false;
      } catch (e) {
        console.error("保存エラー:", e);
        return false;
      }
    } else {
      return await handleSaveAs(id);
    }
  }, []);

  const handleSaveAs = useCallback(async (tabId?: string) => {
    const id = tabId || activeTabIdRef.current;
    const tab = tabsRef.current.find((t) => t.id === id);
    if (!tab) return false;

    try {
      const firstLine = tab.content.split("\n")[0].trim();
      const defaultName = (firstLine.length > 0 ? firstLine.slice(0, 20) : "無題") + ".txt";
      // ファイルのディレクトリがあればそれを初期パスに
      const dirPath = tab.filePath ? tab.filePath.split('/').slice(0, -1).join('/') : undefined;
      const defaultPath = dirPath ? `${dirPath}/${defaultName}` : defaultName;
      const filePath = await saveFileDialog(defaultPath);
      if (!filePath) return false;

      await writeTextFile(filePath, tab.content);
      const fileName = getFileName(filePath);
      const lang = getLanguageFromPath(filePath);

      setTabs((prev) =>
        prev.map((t) =>
          t.id === tab.id
            ? { ...t, title: fileName, filePath, language: lang, isModified: false }
            : t
        )
      );
      return true;
    } catch (e) {
      console.error("別名保存エラー:", e);
      return false;
    }
  }, []);

  const handleSearch = useCallback(() => {
    setSearchTrigger((p) => p + 1);
  }, []);

  const handleReplace = useCallback(() => {
    setReplaceTrigger((p) => p + 1);
  }, []);

  // --- メインプロセスからのメニューイベント監視 ---
  useEffect(() => {
    if (typeof window === "undefined") return;
    const { electronAPI } = (window as any);
    if (!electronAPI || !electronAPI.on) return;

    const setupListener = (channel: string, handler: (...args: any[]) => void) => {
      if (electronAPI.on) {
        const unsubscribe = electronAPI.on(channel, handler);
        return unsubscribe;
      }
      return () => { };
    };

    const unsubNew = setupListener('menu:new-file', handleAddTab);
    const unsubOpen = setupListener('menu:open-file', handleOpenFile);
    const unsubSave = setupListener('menu:save-file', () => handleSave());
    const unsubSaveAs = setupListener('menu:save-as-file', () => handleSaveAs());
    const unsubSearch = setupListener('menu:search', handleSearch);
    const unsubReplace = setupListener('menu:replace', handleReplace);

    // --- OSからのファイル直接起動 ---
    const handleOpenExternal = (data: { fileName: string, content: string, filePath: string }) => {
      // tabsRef.current を使用して最新のタブ状態を参照
      const currentTabs = tabsRef.current;
      const existing = currentTabs.find(t => t.filePath === data.filePath);

      if (existing) {
        setActiveTabId(existing.id);
        return;
      }

      const newId = generateId();
      const newTab: TabData = {
        id: newId,
        title: data.fileName,
        content: data.content,
        language: getLanguageFromPath(data.filePath),
        filePath: data.filePath,
        isModified: false,
      };

      // 関数型アップデートで安全に追加
      setTabs(prev => {
        // 念のためここでも再チェック（競合防止）
        if (prev.some(t => t.filePath === data.filePath)) return prev;
        return [...prev, newTab];
      });
      setActiveTabId(newId);
    };

    const unsubExternal = setupListener('open-external-file', handleOpenExternal);

    // リスナー登録完了後に準備完了を通知
    electronAPI.uiReady();

    return () => {
      unsubNew();
      unsubOpen();
      unsubSave();
      unsubSaveAs();
      unsubSearch();
      unsubReplace();
      unsubExternal();
    };

  }, [handleAddTab, handleOpenFile, handleSave, handleSaveAs, handleSearch, handleReplace]);

  // --- ウィンドウタイトルの動的更新 ---
  useEffect(() => {
    const activeTab = tabs.find((t) => t.id === activeTabId);
    if (activeTab) {
      document.title = `${activeTab.title} - AHME`;
    } else {
      document.title = "AHME";
    }
  }, [tabs, activeTabId]);

  // --- テーマを <body> タグに反映させる処理 ---
  useEffect(() => {
    document.body.classList.remove("theme-violet", "theme-dark", "theme-light", "theme-hc", "theme-aurora", "theme-ember", "theme-sakura");

    let themeClass = "theme-violet";
    if (settings.theme === "vs-dark") themeClass = "theme-dark";
    if (settings.theme === "vs") themeClass = "theme-light";
    if (settings.theme === "hc-black") themeClass = "theme-hc";
    if (settings.theme === "aurora") themeClass = "theme-aurora";
    if (settings.theme === "ember") themeClass = "theme-ember";
    if (settings.theme === "sakura") themeClass = "theme-sakura";

    document.body.classList.add(themeClass);
  }, [settings.theme]);

  // --- 保存確認ダイアログのハンドラ ---
  const handleConfirmSave = useCallback(async () => {
    if (!closingTabId) return;
    const success = await handleSave(closingTabId);
    if (success) {
      doCloseTab(closingTabId);
    }
  }, [closingTabId, handleSave, doCloseTab]);

  const handleConfirmDiscard = useCallback(() => {
    if (closingTabId) {
      doCloseTab(closingTabId);
    }
  }, [closingTabId, doCloseTab]);

  const handleConfirmCancel = useCallback(() => {
    setClosingTabId(null);
  }, []);

  return (
    <EditorProvider>
      <div className="flex flex-col h-screen bg-ahme-bg text-white">
        {/* メニューバー */}
        <Header
          onOpenFile={handleOpenFile}
          onSave={() => handleSave()}
          onSaveAs={() => handleSaveAs()}
          onSearch={handleSearch}
          onReplace={handleReplace}
          onSettings={() => setSettingsOpen(true)}
          fontSize={settings.fontSize}
          onFontSizeChange={(size) => setSettings(prev => ({ ...prev, fontSize: size }))}
          aiEnabled={aiEnabled}
          onToggleAi={() => setAiEnabled(!aiEnabled)}
        />

        {/* タブバー */}
        <TabBar
          tabs={tabs}
          activeTabId={activeTabId}
          onSelectTab={setActiveTabId}
          onAddTab={handleAddTab}
          onCloseTab={handleCloseTab}
          onReorderTabs={handleReorderTabs}
        />

        {/* メインコンテンツ: エディタ + AIパネル (2ペイン) */}
        <main className="flex-1 overflow-hidden relative">
          {!mounted ? null : (
            <PanelGroup
              groupRef={panelGroupRef}
              defaultLayout={layout}
              orientation="horizontal"
              id="main-layout"
              onLayoutChanged={handlePanelLayoutChanged}
            >
              <Panel defaultSize="65" minSize="20" id="editor-panel">
                <div className="h-full w-full">
                  {activeTab && (
                    <MemoEditor
                      key={activeTab.id}
                      defaultValue={activeTab.content}
                      language={activeTab.language}
                      settings={settings}
                      onChange={handleContentChange}
                      onCursorChange={handleCursorChange}
                      showSearch={searchTrigger}
                      showReplace={replaceTrigger}
                      initialScrollTop={scrollPositions[activeTab.id] ?? 0}
                      onScrollSave={(scrollTop) => {
                        setScrollPositions(prev => ({ ...prev, [activeTab.id]: scrollTop }));
                      }}
                    />
                  )}
                </div>
              </Panel>

              {aiEnabled && (
                <>
                  <PanelResizeHandle
                    id="main-resizer"
                    className="w-1.5 bg-ahme-resizer hover:bg-ahme-resizer-hover transition-colors cursor-col-resize flex items-center justify-center"
                  >
                    <div className="h-8 w-px bg-ahme-resizer-handle" />
                  </PanelResizeHandle>
                  <Panel defaultSize="35" minSize="15" maxSize="80" id="ai-panel">
                    <AiPanel
                      editorContent={activeTab?.content || ""}
                      currentFilePath={activeTab?.filePath || null}
                    />
                  </Panel>
                </>
              )}
            </PanelGroup>
          )}
        </main>

        {/* ステータスバー */}
        <StatusBar
          line={cursorLine}
          column={cursorColumn}
          language={activeTab?.language ?? "text"}
        />

        {/* 設定ダイアログ */}
        <SettingsDialog
          isOpen={settingsOpen}
          settings={settings}
          onClose={() => setSettingsOpen(false)}
          onSave={setSettings}
        />

        {/* 未保存確認ダイアログ */}
        <SaveConfirmDialog
          isOpen={closingTabId !== null}
          fileName={tabs.find((t) => t.id === closingTabId)?.title ?? ""}
          onSave={handleConfirmSave}
          onDiscard={handleConfirmDiscard}
          onCancel={handleConfirmCancel}
        />

        {/* ダウンロード進捗フローティングウィジェット */}
        <DownloadProgressWidget />
      </div>
    </EditorProvider>
  );
}
