import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const OLLAMA_URL = process.env.OLLAMA_API_URL || "http://localhost:11434";
const OPEN_WEBUI_URL = process.env.OPEN_WEBUI_URL;
const API_KEY = process.env.OPEN_WEBUI_API_KEY;

function log(msg: string) {
    console.log(`[${new Date().toISOString()}] ${msg}`);
}

export async function POST(req: NextRequest) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 1分に延長

    try {
        const { messages, model, stream = true } = await req.json();

        log(`[Chat API] Model: ${model}, Stream: ${stream}, Messages: ${messages.length}`);

        let targetUrl = `${OLLAMA_URL}/api/chat`;
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };

        if (OPEN_WEBUI_URL && API_KEY) {
            targetUrl = `${OPEN_WEBUI_URL}/chat/completions`;
            headers["Authorization"] = `Bearer ${API_KEY}`;
        }

        log(`[Chat API] Sending request to ${targetUrl}`);

        const response = await fetch(targetUrl, {
            method: "POST",
            headers,
            body: JSON.stringify({
                model,
                messages,
                stream,
            }),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);
        log(`[Chat API] Response status: ${response.status}`);

        if (!response.ok) {
            const errorText = await response.text();
            log(`[Chat API] Error body: ${errorText.substring(0, 200)}`);
            return NextResponse.json(
                { error: `API Error: ${response.status} - ${errorText.substring(0, 100)}` },
                { status: response.status }
            );
        }

        if (stream) {
            const encoder = new TextEncoder();
            const decoder = new TextDecoder();

            const readableStream = new ReadableStream({
                async start(controller) {
                    const reader = response.body?.getReader();
                    if (!reader) {
                        controller.close();
                        return;
                    }

                    try {
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;

                            const chunk = decoder.decode(value, { stream: true });
                            const lines = chunk.split("\n").filter(line => line.trim());

                            for (const line of lines) {
                                try {
                                    const data = JSON.parse(line);
                                    let content = "";
                                    if (data.message?.content) {
                                        content = data.message.content;
                                    } else if (data.choices?.[0]?.delta?.content) {
                                        content = data.choices[0].delta.content;
                                    }

                                    if (content) {
                                        controller.enqueue(encoder.encode(content));
                                    }

                                    if (data.done) break;
                                } catch (e) {
                                    // 部分的なJSONは無視
                                }
                            }
                        }
                    } catch (error) {
                        log(`[Chat API] Stream Error: ${error}`);
                        controller.error(error);
                    } finally {
                        controller.close();
                        reader.releaseLock();
                    }
                },
            });

            return new Response(readableStream, {
                headers: { "Content-Type": "text/event-stream" },
            });
        } else {
            const data = await response.json();
            return NextResponse.json(data);
        }
    } catch (error: any) {
        clearTimeout(timeoutId);
        log(`[Chat API] Fatal Error: ${error.name} - ${error.message}`);

        if (error.name === "AbortError") {
            return NextResponse.json(
                { error: "AIへのリクエストがタイムアウトしました。" },
                { status: 504 }
            );
        }

        return NextResponse.json(
            { error: `Chat Request Failed: ${error.message}` },
            { status: 500 }
        );
    }
}
