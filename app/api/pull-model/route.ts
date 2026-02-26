import { NextRequest, NextResponse } from "next/server";

const OLLAMA_HOST = process.env.NEXT_PUBLIC_OLLAMA_HOST || "http://localhost:11434";

export async function POST(request: NextRequest) {
    try {
        const { name } = await request.json();

        if (!name || typeof name !== "string") {
            return NextResponse.json({ error: "モデル名が必要です" }, { status: 400 });
        }

        const response = await fetch(`${OLLAMA_HOST}/api/pull`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, stream: true }),
        });

        if (!response.ok) {
            const text = await response.text();
            return NextResponse.json(
                { error: `Ollama エラー: ${text.substring(0, 200)}` },
                { status: response.status }
            );
        }

        if (!response.body) {
            return NextResponse.json({ error: "レスポンスボディが空です" }, { status: 500 });
        }

        // ストリーミングレスポンスをそのまま転送
        const stream = new ReadableStream({
            async start(controller) {
                const reader = response.body!.getReader();
                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        controller.enqueue(value);
                    }
                } catch (err) {
                    controller.error(err);
                } finally {
                    controller.close();
                }
            },
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "application/x-ndjson",
                "Transfer-Encoding": "chunked",
            },
        });
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || "モデルのダウンロードに失敗しました" },
            { status: 500 }
        );
    }
}
