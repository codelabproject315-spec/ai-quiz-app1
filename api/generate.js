export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { messages, system } = req.body;

  // systemプロンプトをmessagesの先頭に追加（Groqはsystemロールをサポート）
  const fullMessages = system
    ? [{ role: "system", content: system }, ...messages]
    : messages;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: fullMessages,
    }),
  });

  const data = await response.json();

  // Groqからのエラーがある場合に備えてチェック
  if (!response.ok) {
    return res.status(response.status).json({ error: data.error || "Groq API Error" });
  }

  // フロントエンドにデータを返す
  res.status(200).json(data);
