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
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 画像処理は2分

    try {
        const body = await req.json();
        const { messages, model, stream = true, images } = body;

        log(`[Chat API] Model: ${model}, Stream: ${stream}, Messages: ${messages.length}, Images: ${images?.length || 0}`);

        let targetUrl = `${OLLAMA_URL}/api/chat`;
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };

        if (OPEN_WEBUI_URL && API_KEY) {
            targetUrl = `${OPEN_WEBUI_URL}/chat/completions`;
            headers["Authorization"] = `Bearer ${API_KEY}`;
        }

        // ── メッセージ配列を構築 ──
        // images がある場合、最後の user メッセージに images フィールドを付与
        // Ollama API 仕様: messages[n].images = ["base64string", ...]
        let ollamaMessages = [...messages];

        if (images && Array.isArray(images) && images.length > 0) {
            // Base64 文字列のクリーンアップ（data: プレフィックスを確実に除去）
            const cleanImages = images.map((img: string) => {
                if (typeof img === "string" && img.startsWith("data:")) {
                    return img.split(",").slice(1).join(",");
                }
                return img;
            });

            // 最後の user メッセージを探して images を付与
            for (let i = ollamaMessages.length - 1; i >= 0; i--) {
                if (ollamaMessages[i].role === "user") {
                    ollamaMessages[i] = { ...ollamaMessages[i], images: cleanImages };
                    log(`[Chat API] Attached ${cleanImages.length} image(s) to message[${i}]`);
                    break;
                }
            }

            // デバッグログ: 最後のメッセージの構造を出力
            const lastMsg = ollamaMessages[ollamaMessages.length - 1];
            log(`[Chat API] Last message structure: role=${lastMsg.role}, has_images=${!!lastMsg.images}, images_count=${lastMsg.images?.length || 0}`);
            if (lastMsg.images) {
                lastMsg.images.forEach((img: string, idx: number) => {
                    log(`[Chat API] Image[${idx}]: length=${img.length}, first50="${img.substring(0, 50)}"`);
                });
            }
        }

        // ── Ollama に送信するペイロード ──
        const ollamaPayload = {
            model,
            messages: ollamaMessages,
            stream,
        };

        log(`[Chat API] Sending to ${targetUrl}, payload keys: ${Object.keys(ollamaPayload)}`);

        const response = await fetch(targetUrl, {
            method: "POST",
            headers,
            body: JSON.stringify(ollamaPayload),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);
        log(`[Chat API] Response status: ${response.status}`);

        if (!response.ok) {
            const errorText = await response.text();
            log(`[Chat API] Error body: ${errorText.substring(0, 500)}`);
            return NextResponse.json(
                { error: `API Error: ${response.status} - ${errorText.substring(0, 200)}` },
                { status: response.status }
            );
        }

        if (stream) {
            const encoder = new TextEncoder();
            const decoder = new TextDecoder();

            const readableStream = new ReadableStream({
                async start(streamController) {
                    const reader = response.body?.getReader();
                    if (!reader) {
                        streamController.close();
                        return;
                    }

                    try {
                        let firstChunk = true;
                        let fullResponse = "";
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;

                            const chunk = decoder.decode(value, { stream: true });
                            const lines = chunk.split("\n").filter(line => line.trim());

                            for (const line of lines) {
                                try {
                                    const data = JSON.parse(line);

                                    if (data.error) {
                                        log(`[Chat API] Ollama error in stream: ${data.error}`);
                                        streamController.enqueue(encoder.encode(`\n\n⚠️ Ollama Error: ${data.error}`));
                                        break;
                                    }

                                    let content = "";
                                    if (data.message?.content) {
                                        content = data.message.content;
                                    } else if (data.choices?.[0]?.delta?.content) {
                                        content = data.choices[0].delta.content;
                                    }

                                    if (content) {
                                        if (firstChunk) {
                                            log(`[Chat API] First token received`);
                                            firstChunk = false;
                                        }
                                        fullResponse += content;
                                        streamController.enqueue(encoder.encode(content));
                                    }

                                    if (data.done) {
                                        log(`[Chat API] Response complete (${fullResponse.length} chars): ${fullResponse.substring(0, 300)}`);
                                        break;
                                    }
                                } catch (e) {
                                    // 部分的なJSONは無視
                                }
                            }
                        }
                    } catch (error) {
                        log(`[Chat API] Stream Error: ${error}`);
                        streamController.error(error);
                    } finally {
                        streamController.close();
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
