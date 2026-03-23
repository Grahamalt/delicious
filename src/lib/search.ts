export async function searchWeb(query: string): Promise<string> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return "Search unavailable: no API key configured.";

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "basic",
        max_results: 3,
        include_answer: true,
      }),
    });

    const data = await res.json();

    let result = "";
    if (data.answer) {
      result += `Summary: ${data.answer}\n\n`;
    }
    if (data.results) {
      for (const r of data.results.slice(0, 3)) {
        result += `Source: ${r.title}\n${r.content}\n\n`;
      }
    }

    return result.trim() || "No results found.";
  } catch {
    return "Search failed.";
  }
}
