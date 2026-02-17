import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/parse
 * multipart/form-data でファイルを受信し、テキストを抽出して返却する。
 *
 * 対応形式: .txt, .md, .csv, .json, .log, .pdf, コード系各種
 * 拡張子なし: テキストとして読み込みを試みる
 * レスポンス: { filename, text, size, truncated? }
 */

export const maxDuration = 60;

// テキスト系ファイルの拡張子
const TEXT_EXTENSIONS = new Set([
    ".txt", ".md", ".csv", ".json", ".log",
    ".xml", ".yaml", ".yml", ".toml", ".ini",
    ".js", ".ts", ".tsx", ".jsx", ".py", ".rs",
    ".html", ".css", ".scss", ".sh", ".bash",
]);

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_TEXT_LENGTH = 100_000; // ~100K文字

function getExtension(filename: string): string {
    const dot = filename.lastIndexOf(".");
    return dot >= 0 ? filename.slice(dot).toLowerCase() : "";
}

export async function POST(req: NextRequest) {
    try {
        // Content-Length チェック
        const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
        if (contentLength > MAX_FILE_SIZE) {
            return NextResponse.json(
                { error: `ファイルが大きすぎます（上限: ${MAX_FILE_SIZE / 1024 / 1024}MB）` },
                { status: 413 }
            );
        }

        let formData: FormData;
        try {
            formData = await req.formData();
        } catch (e: any) {
            console.error("[Parse API] formData error:", e.message);
            return NextResponse.json(
                { error: `リクエスト解析エラー: ${e.message}` },
                { status: 400 }
            );
        }

        const file = formData.get("file") as File | null;
        if (!file) {
            return NextResponse.json(
                { error: "ファイルが指定されていません" },
                { status: 400 }
            );
        }

        const filename = file.name;
        const ext = getExtension(filename);
        const size = file.size;

        console.log(`[Parse API] File: ${filename}, Size: ${size}, Ext: "${ext}"`);

        if (size > MAX_FILE_SIZE) {
            return NextResponse.json(
                { error: `ファイルが大きすぎます（上限: ${MAX_FILE_SIZE / 1024 / 1024}MB）` },
                { status: 413 }
            );
        }

        let text: string;

        if (ext === ".pdf") {
            // ── PDF: pdf-parse v1.1.1 (worker不要, シンプルな関数呼び出し) ──
            try {
                // pdf-parse v1 の index.js はテストファイルを読むバグがあるため
                // lib/pdf-parse.js を直接 require する
                const pdfParse = require("pdf-parse/lib/pdf-parse.js");
                const buffer = Buffer.from(await file.arrayBuffer());
                const data = await pdfParse(buffer);
                text = data.text || "";
                console.log(`[Parse API] PDF parsed: ${data.numpages} pages, ${text.length} chars`);
            } catch (pdfError: any) {
                console.error("[Parse API] PDF parse error:", pdfError.message, pdfError.stack?.substring(0, 300));
                return NextResponse.json(
                    { error: `PDFの解析に失敗しました: ${pdfError.message}` },
                    { status: 500 }
                );
            }
        } else if (TEXT_EXTENSIONS.has(ext)) {
            // ── テキスト系: そのまま読み取り ──
            try {
                text = await file.text();
            } catch (textError: any) {
                return NextResponse.json(
                    { error: `テキスト読み取りエラー: ${textError.message}` },
                    { status: 500 }
                );
            }
        } else if (ext === "") {
            // ── 拡張子なし: テキストとして読み込みを試みる ──
            try {
                text = await file.text();
                // バイナリかどうか簡易チェック（NULバイトの有無）
                if (text.includes("\0")) {
                    return NextResponse.json(
                        { error: `バイナリファイルのようです。テキストファイルまたはPDFを添付してください。` },
                        { status: 400 }
                    );
                }
                console.log(`[Parse API] No extension, read as text: ${text.length} chars`);
            } catch (e: any) {
                return NextResponse.json(
                    { error: `ファイル読み取りエラー: ${e.message}` },
                    { status: 500 }
                );
            }
        } else {
            return NextResponse.json(
                {
                    error: `未対応のファイル形式です: ${ext}`,
                    supported: [".txt", ".md", ".csv", ".json", ".log", ".pdf", ".xml", ".yaml", ".yml", ".py", ".js", ".ts"],
                },
                { status: 400 }
            );
        }

        // テキスト切り詰め
        let truncated = false;
        if (text.length > MAX_TEXT_LENGTH) {
            text = text.slice(0, MAX_TEXT_LENGTH);
            truncated = true;
            console.log(`[Parse API] Truncated to ${MAX_TEXT_LENGTH} chars`);
        }

        console.log(`[Parse API] ✅ Success: ${filename}, ${text.length} chars`);

        return NextResponse.json({
            filename,
            text,
            size,
            truncated,
        });
    } catch (error: any) {
        console.error("[Parse API] Unexpected error:", error);
        return NextResponse.json(
            { error: `予期せぬエラー: ${error.message}` },
            { status: 500 }
        );
    }
}
