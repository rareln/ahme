import { NextResponse } from "next/server";

export const runtime = "nodejs";

const OLLAMA_URL = process.env.OLLAMA_API_URL || "http://localhost:11434";

export async function GET() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
        console.log(`[Models API] Fetching from: ${OLLAMA_URL}/api/tags`);
        const response = await fetch(`${OLLAMA_URL}/api/tags`, {
            method: "GET",
            headers: { "Accept": "application/json" },
            signal: controller.signal,
        });

        clearTimeout(timeoutId);
        console.log(`[Models API] Status: ${response.status}`);

        if (!response.ok) {
            const text = await response.text();
            console.error(`[Models API] Error Response: ${text}`);
            return NextResponse.json(
                { error: `Ollama API エラー (${response.status})` },
                { status: response.status }
            );
        }

        const data = await response.json();

        let models: string[] = [];
        if (data.models && Array.isArray(data.models)) {
            models = data.models.map((m: any) => m.name);
        }
        console.log(`[Models API] Found ${models.length} models: ${models.join(", ")}`);

        return NextResponse.json({ models });
    } catch (error: any) {
        clearTimeout(timeoutId);
        console.error(`[Models API] Fatal Error: ${error.name} - ${error.message}`);

        const message = error.name === "AbortError"
            ? "Ollama への接続がタイムアウトしました。Ollama が起動しているか確認してください。"
            : `Ollama への接続に失敗しました: ${error.message}`;

        return NextResponse.json({ error: message }, { status: 500 });
    }
}
