export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { messages, system } = req.body;
    const apiKey = process.env.GROQ_API_KEY;

    // APIキーの存在チェック
    if (!apiKey) {
      return res.status(500).json({ error: "Vercelの環境変数 GROQ_API_KEY が設定されていません。" });
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-specdec", // より安定したモデルに変更
        messages: system ? [{ role: "system", content: system }, ...messages] : messages,
        response_format: { type: "json_object" } // JSON出力を強制
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      // Groqからのエラーメッセージをそのままフロントに返す
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
