import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/search
 * Tavily Search API を使ってWeb検索を実行し、上位3件の要約を返す。
 * 3秒タイムアウト: 時間内に結果が返らなければ skipped: true を返す。
 */

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

export async function POST(req: NextRequest) {
    if (!TAVILY_API_KEY) {
        return NextResponse.json(
            { results: [], skipped: true, reason: "TAVILY_API_KEY が未設定です" },
            { status: 200 }
        );
    }

    try {
        const { query } = await req.json();

        if (!query || typeof query !== "string" || !query.trim()) {
            return NextResponse.json(
                { results: [], skipped: true, reason: "検索クエリが空です" },
                { status: 200 }
            );
        }

        console.log(`[Search API] Query: "${query.substring(0, 80)}"`);

        // 3秒タイムアウト
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        try {
            const response = await fetch("https://api.tavily.com/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    api_key: TAVILY_API_KEY,
                    query: query.trim(),
                    search_depth: "basic",
                    max_results: 3,
                    include_answer: true,
                }),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errText = await response.text().catch(() => "unknown");
                console.error(`[Search API] Tavily error: ${response.status} ${errText.substring(0, 100)}`);
                return NextResponse.json(
                    { results: [], skipped: true, reason: `Tavily API error: ${response.status}` },
                    { status: 200 }
                );
            }

            const data = await response.json();

            const results = (data.results || []).slice(0, 3).map((r: any) => ({
                title: r.title || "",
                url: r.url || "",
                content: (r.content || "").substring(0, 200),
            }));

            console.log(`[Search API] ✅ ${results.length} results, answer: ${data.answer ? "yes" : "no"}`);

            return NextResponse.json({
                results,
                answer: data.answer || null,
                skipped: false,
            });
        } catch (fetchError: any) {
            clearTimeout(timeoutId);

            if (fetchError.name === "AbortError") {
                console.log("[Search API] ⏰ Timeout (3s) — skipping");
                return NextResponse.json(
                    { results: [], skipped: true, reason: "タイムアウト（3秒）" },
                    { status: 200 }
                );
            }

            throw fetchError;
        }
    } catch (error: any) {
        console.error("[Search API] Unexpected error:", error.message);
        return NextResponse.json(
            { results: [], skipped: true, reason: error.message },
            { status: 200 }
        );
    }
}
