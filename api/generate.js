export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { messages, system } = req.body;
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "GROQ_API_KEY が設定されていません。" });
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        // 利用可能なモデル名に変更
        model: "llama-3.1-8b-instant", 
        messages: system ? [{ role: "system", content: system }, ...messages] : messages,
        // JSON形式での出力を保証
        response_format: { type: "json_object" } 
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: "Groq API Error", 
        details: data.error?.message || "不明なエラー" 
      });
    }

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: "Server Crash", details: error.message });
  }
}
