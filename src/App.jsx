import { useState, useEffect, useRef } from "react";

const SUBJECTS = [
  { id: "math", label: "数学", icon: "∑", color: "#FF6B35" },
  { id: "english", label: "英語", icon: "A", color: "#4ECDC4" },
  { id: "history", label: "歴史", icon: "⌛", color: "#FFE66D" },
  { id: "science", label: "理科", icon: "⚗", color: "#A8E6CF" },
  { id: "programming", label: "プログラミング", icon: "</>", color: "#C3B1E1" },
];

const LEVELS = [
  { id: "basic", label: "基礎", desc: "センター・共通テストレベル" },
  { id: "standard", label: "標準", desc: "中堅大学レベル" },
  { id: "advanced", label: "応用", desc: "難関大学レベル" },
];

const SYSTEM_PROMPT = `あなたは日本の大学受験・大学生向けの優秀な学習アシスタントです。
ユーザーが指定した科目・レベル・トピックに基づき、教育的で質の高い問題を生成してください。

必ず以下のJSON形式のみで返答してください（他のテキスト不要）:
{
  "question": "問題文（具体的で明確に）",
  "choices": ["選択肢A", "選択肢B", "選択肢C", "選択肢D"],
  "answer": 0,
  "explanation": "詳しい解説（なぜその答えか、関連知識も含めて200字程度）",
  "hint": "ヒント（考え方の糸口）"
}

answerは正解の選択肢のインデックス（0〜3）です。`;

export default function AIQuizApp() {
  const [screen, setScreen] = useState("home");
  const [subject, setSubject] = useState(null);
  const [level, setLevel] = useState(null);
  const [topic, setTopic] = useState("");
  const [quizCount, setQuizCount] = useState(5);
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [answers, setAnswers] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [timerActive, setTimerActive] = useState(false);
  const timerRef = useRef(null);

  const currentQ = questions[currentIdx];
  const subjectObj = SUBJECTS.find(s => s.id === subject);
  const accentColor = subjectObj?.color || "#FF6B35";

  useEffect(() => {
    if (timerActive && timeLeft > 0) {
      timerRef.current = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    } else if (timerActive && timeLeft === 0) {
      handleSelect(-1);
    }
    return () => clearTimeout(timerRef.current);
  }, [timerActive, timeLeft]);

  const generateQuestion = async (subj, lvl, tpc) => {
    const prompt = `科目: ${subj}\nレベル: ${lvl}\nトピック: ${tpc || "ランダム"}\n\n上記の条件で問題を1問生成してください。`;

    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();
    // GroqはOpenAI互換: choices[0].message.content にテキストが入る
    const text = data.choices[0].message.content;

    // コードブロック除去 & { ... } だけ抽出
    const stripped = text.replace(/```json|```/g, "").trim();
    const jsonMatch = stripped.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("JSON not found in response");
    let jsonStr = jsonMatch[0];

    // LLMが稀に混入させる不正文字を修復
    // 例: "hoge") , → "hoge",  /  "hoge") ] → "hoge" ]
    jsonStr = jsonStr.replace(/"([^"]*)"\s*\)\s*,/g, '"$1",');
    jsonStr = jsonStr.replace(/"([^"]*)"\s*\)\s*(\s*\])/g, '"$1" $2');

    return JSON.parse(jsonStr);
  };

  const startQuiz = async () => {
    setGenerating(true);
    setError("");
    setQuestions([]);
    setAnswers([]);
    setCurrentIdx(0);
    setScreen("quiz");
    const subjectLabel = SUBJECTS.find(s => s.id === subject)?.label;
    const levelLabel = LEVELS.find(l => l.id === level)?.label;
    const qs = [];
    for (let i = 0; i < quizCount; i++) {
      try {
        const q = await generateQuestion(subjectLabel, levelLabel, topic);
        qs.push(q);
        setQuestions([...qs]);
      } catch (e) {
        setError("問題の生成に失敗しました。再試行してください。");
        setGenerating(false);
        return;
      }
    }
    setGenerating(false);
    setSelected(null);
    setShowExplanation(false);
    setShowHint(false);
    setTimeLeft(60);
    setTimerActive(true);
  };

  const handleSelect = (idx) => {
    if (selected !== null) return;
    clearTimeout(timerRef.current);
    setTimerActive(false);
    setSelected(idx);
    setShowExplanation(true);
    const isCorrect = idx === currentQ?.answer;
    setAnswers(prev => [...prev, { questionIdx: currentIdx, selected: idx, correct: isCorrect }]);
  };

  const handleNext = () => {
    if (currentIdx + 1 >= questions.length && !generating) {
      setScreen("result");
    } else {
      setCurrentIdx(i => i + 1);
      setSelected(null);
      setShowExplanation(false);
      setShowHint(false);
      setTimeLeft(60);
      setTimerActive(true);
    }
  };

  const score = answers.filter(a => a.correct).length;
  const pct = questions.length ? Math.round((score / questions.length) * 100) : 0;

  const styles = {
    app: {
      minHeight: "100vh",
      background: "#0A0A0F",
      color: "#E8E8F0",
      fontFamily: "'Noto Sans JP', 'Hiragino Sans', sans-serif",
      overflowX: "hidden",
    },
    card: {
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 16,
      backdropFilter: "blur(10px)",
    },
    btnPrimary: {
      background: accentColor,
      color: "#0A0A0F",
      border: "none",
      borderRadius: 12,
      padding: "14px 28px",
      fontSize: 16,
      fontWeight: 700,
      cursor: "pointer",
      fontFamily: "inherit",
      letterSpacing: "0.02em",
    },
    btnGhost: {
      background: "transparent",
      color: "#E8E8F0",
      border: "1px solid rgba(255,255,255,0.15)",
      borderRadius: 12,
      padding: "14px 28px",
      fontSize: 16,
      cursor: "pointer",
      fontFamily: "inherit",
    },
    tag: {
      display: "inline-block",
      padding: "4px 10px",
      borderRadius: 6,
      fontSize: 12,
      fontWeight: 500,
      background: "rgba(255,255,255,0.08)",
      border: "1px solid rgba(255,255,255,0.1)",
    },
  };

  return (
    <div style={styles.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700;900&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .grain { position: fixed; top: 0; left: 0; width: 100%; height: 100%; opacity: 0.03; pointer-events: none; z-index: 0; }
        .glow-orb { position: fixed; border-radius: 50%; filter: blur(120px); pointer-events: none; z-index: 0; opacity: 0.15; }
        .fade-in { animation: fadeIn 0.4s ease forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
        .choice-btn {
          width: 100%; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px; padding: 16px 20px; text-align: left; color: #E8E8F0;
          font-size: 15px; cursor: pointer; transition: all 0.2s; font-family: inherit; line-height: 1.6;
        }
        .choice-btn:hover:not(:disabled) { background: rgba(255,255,255,0.08); transform: translateX(4px); }
        .choice-btn:disabled { cursor: not-allowed; }
        .choice-btn.correct { background: rgba(78,205,196,0.15); border-color: #4ECDC4; }
        .choice-btn.wrong { background: rgba(255,107,53,0.15); border-color: #FF6B35; }
        .choice-btn.dimmed { opacity: 0.4; }
        .subject-card { cursor: pointer; transition: all 0.2s; }
        .subject-card:hover { transform: translateY(-4px); }
        input { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; color: #E8E8F0; padding: 12px 16px; font-size: 15px; font-family: inherit; width: 100%; outline: none; }
        input::placeholder { color: rgba(255,255,255,0.3); }
        .loading-dots span { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${accentColor}; margin: 0 3px; animation: bounce 1.2s infinite; }
        .loading-dots span:nth-child(2) { animation-delay: 0.2s; }
        .loading-dots span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes bounce { 0%,80%,100% { transform: translateY(0); } 40% { transform: translateY(-10px); } }
        .progress-bar { height: 4px; background: rgba(255,255,255,0.08); border-radius: 2px; overflow: hidden; }
        .progress-fill { height: 100%; border-radius: 2px; background: ${accentColor}; transition: width 0.4s ease; }
      `}</style>

      <div className="grain" />
      <div className="glow-orb" style={{ width: 600, height: 600, top: -200, right: -200, background: accentColor }} />
      <div className="glow-orb" style={{ width: 400, height: 400, bottom: -100, left: -100, background: "#4ECDC4" }} />

      <div style={{ position: "relative", zIndex: 1 }} className="fade-in">

        {screen === "home" && (
          <div style={{ maxWidth: 720, margin: "0 auto", padding: "60px 24px" }}>
            <div style={{ textAlign: "center", marginBottom: 60 }}>
              <div style={{ fontSize: 13, letterSpacing: "0.2em", color: accentColor, textTransform: "uppercase", marginBottom: 16 }}>AI POWERED LEARNING</div>
              <h1 style={{ fontSize: "clamp(36px, 8vw, 64px)", fontWeight: 900, lineHeight: 1.1, marginBottom: 16 }}>
                AIが作る<br /><span style={{ color: accentColor }}>あなただけの</span><br />問題集
              </h1>
              <p style={{ color: "rgba(232,232,240,0.5)", fontSize: 17, lineHeight: 1.7 }}>
                科目・レベル・トピックを選ぶだけで<br />AIが即座にオリジナル問題を生成します
              </p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 48 }}>
              {[{ icon: "🤖", title: "AI生成", desc: "毎回ユニークな問題" }, { icon: "⚡", title: "即座に", desc: "待ち時間ゼロ" }, { icon: "📈", title: "レベル別", desc: "基礎〜難関まで" }].map(f => (
                <div key={f.title} style={{ ...styles.card, padding: 20, textAlign: "center" }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{f.icon}</div>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{f.title}</div>
                  <div style={{ fontSize: 13, color: "rgba(232,232,240,0.5)" }}>{f.desc}</div>
                </div>
              ))}
            </div>
            <div style={{ textAlign: "center" }}>
              <button style={{ ...styles.btnPrimary, fontSize: 18, padding: "18px 48px" }} onClick={() => setScreen("config")}>学習をはじめる →</button>
            </div>
          </div>
        )}

        {screen === "config" && (
          <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
            <button style={{ ...styles.btnGhost, marginBottom: 32, padding: "8px 16px", fontSize: 14 }} onClick={() => setScreen("home")}>← 戻る</button>
            <h2 style={{ fontSize: 28, fontWeight: 900, marginBottom: 8 }}>問題を設定する</h2>
            <p style={{ color: "rgba(232,232,240,0.5)", marginBottom: 40 }}>科目・レベルを選んでスタート</p>
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 13, letterSpacing: "0.1em", color: "rgba(232,232,240,0.5)", textTransform: "uppercase", marginBottom: 16 }}>科目を選ぶ</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 12 }}>
                {SUBJECTS.map(s => (
                  <div key={s.id} className="subject-card"
                    style={{ ...styles.card, padding: "20px 12px", textAlign: "center", border: subject === s.id ? `2px solid ${s.color}` : "1px solid rgba(255,255,255,0.08)" }}
                    onClick={() => setSubject(s.id)}>
                    <div style={{ fontSize: 24, marginBottom: 8, color: s.color }}>{s.icon}</div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 13, letterSpacing: "0.1em", color: "rgba(232,232,240,0.5)", textTransform: "uppercase", marginBottom: 16 }}>難易度</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                {LEVELS.map(l => (
                  <div key={l.id} className="subject-card"
                    style={{ ...styles.card, padding: 16, cursor: "pointer", border: level === l.id ? `2px solid ${accentColor}` : "1px solid rgba(255,255,255,0.08)" }}
                    onClick={() => setLevel(l.id)}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>{l.label}</div>
                    <div style={{ fontSize: 12, color: "rgba(232,232,240,0.5)" }}>{l.desc}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 13, letterSpacing: "0.1em", color: "rgba(232,232,240,0.5)", textTransform: "uppercase", marginBottom: 16 }}>トピック（任意）</div>
              <input placeholder="例：微分積分、不定詞、江戸時代…" value={topic} onChange={e => setTopic(e.target.value)} />
            </div>
            <div style={{ marginBottom: 40 }}>
              <div style={{ fontSize: 13, letterSpacing: "0.1em", color: "rgba(232,232,240,0.5)", textTransform: "uppercase", marginBottom: 16 }}>問題数: {quizCount}問</div>
              <div style={{ display: "flex", gap: 8 }}>
                {[3, 5, 10].map(n => (
                  <button key={n} style={{ ...(quizCount === n ? styles.btnPrimary : styles.btnGhost), flex: 1 }} onClick={() => setQuizCount(n)}>{n}問</button>
                ))}
              </div>
            </div>
            <button
              style={{ ...styles.btnPrimary, width: "100%", fontSize: 18, padding: "18px", opacity: (!subject || !level) ? 0.4 : 1, cursor: (!subject || !level) ? "not-allowed" : "pointer" }}
              disabled={!subject || !level} onClick={startQuiz}>
              AIが問題を生成する ⚡
            </button>
            {(!subject || !level) && <p style={{ textAlign: "center", marginTop: 12, fontSize: 13, color: "rgba(232,232,240,0.4)" }}>科目と難易度を選んでください</p>}
          </div>
        )}

        {screen === "quiz" && (
          <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div>
                <span style={{ ...styles.tag, marginRight: 8, color: accentColor }}>{SUBJECTS.find(s => s.id === subject)?.label}</span>
                <span style={styles.tag}>{LEVELS.find(l => l.id === level)?.label}</span>
              </div>
              <div style={{ fontFamily: "'Space Mono', monospace", color: timeLeft <= 10 ? "#FF6B35" : "rgba(232,232,240,0.6)", fontSize: 14 }}>
                {selected === null ? `⏱ ${timeLeft}s` : ""}
              </div>
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "rgba(232,232,240,0.5)", marginBottom: 6 }}>
                <span>問題 {Math.min(currentIdx + 1, questions.length)} / {questions.length}</span>
                <span>{answers.filter(a => a.correct).length} 正解</span>
              </div>
              <div className="progress-bar"><div className="progress-fill" style={{ width: `${(answers.length / questions.length) * 100}%` }} /></div>
            </div>
            {generating && !currentQ && (
              <div style={{ ...styles.card, padding: 60, textAlign: "center", marginTop: 40 }}>
                <div className="loading-dots" style={{ marginBottom: 20 }}><span /><span /><span /></div>
                <div style={{ color: "rgba(232,232,240,0.6)" }}>AIが問題を生成中…</div>
                <div style={{ fontSize: 13, color: "rgba(232,232,240,0.3)", marginTop: 8 }}>{questions.length} / {quizCount} 問完了</div>
              </div>
            )}
            {currentQ && (
              <div className="fade-in">
                <div style={{ ...styles.card, padding: 28, marginTop: 24, marginBottom: 20 }}>
                  <div style={{ fontSize: 13, color: "rgba(232,232,240,0.4)", marginBottom: 12, fontFamily: "'Space Mono', monospace" }}>Q{currentIdx + 1}</div>
                  <p style={{ fontSize: 17, lineHeight: 1.8, fontWeight: 500 }}>{currentQ.question}</p>
                  {showHint && (
                    <div style={{ marginTop: 16, padding: 12, background: accentColor + "22", borderLeft: `3px solid ${accentColor}`, borderRadius: "0 8px 8px 0", fontSize: 14 }}>
                      💡 {currentQ.hint}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                  {currentQ.choices.map((ch, i) => {
                    let cls = "choice-btn";
                    if (selected !== null) {
                      if (i === currentQ.answer) cls += " correct";
                      else if (i === selected && selected !== currentQ.answer) cls += " wrong";
                      else cls += " dimmed";
                    }
                    return (
                      <button key={i} className={cls} disabled={selected !== null} onClick={() => handleSelect(i)}>
                        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: accentColor, marginRight: 12 }}>{String.fromCharCode(65 + i)}</span>
                        {ch}
                      </button>
                    );
                  })}
                </div>
                {selected === null && !showHint && (
                  <button style={{ ...styles.btnGhost, fontSize: 13, padding: "8px 16px" }} onClick={() => setShowHint(true)}>💡 ヒントを見る</button>
                )}
                {showExplanation && (
                  <div className="fade-in" style={{ ...styles.card, padding: 24, marginTop: 16 }}>
                    <div style={{ fontSize: 20, marginBottom: 8 }}>
                      {selected === currentQ.answer ? "✅ 正解！" : selected === -1 ? "⏰ 時間切れ" : "❌ 不正解"}
                    </div>
                    <div style={{ color: "rgba(232,232,240,0.7)", lineHeight: 1.8, fontSize: 15 }}>{currentQ.explanation}</div>
                  </div>
                )}
                {showExplanation && (
                  <div style={{ marginTop: 20, textAlign: "right" }}>
                    <button
                      style={{ ...styles.btnPrimary, opacity: (generating && currentIdx + 1 >= questions.length) ? 0.4 : 1 }}
                      disabled={generating && currentIdx + 1 >= questions.length}
                      onClick={handleNext}>
                      {currentIdx + 1 >= questions.length ? (generating ? "生成中…" : "結果を見る") : "次の問題 →"}
                    </button>
                  </div>
                )}
              </div>
            )}
            {error && (
              <div style={{ color: "#FF6B35", textAlign: "center", padding: 20 }}>
                {error}<br />
                <button style={{ ...styles.btnGhost, marginTop: 16 }} onClick={() => setScreen("config")}>設定に戻る</button>
              </div>
            )}
          </div>
        )}

        {screen === "result" && (
          <div style={{ maxWidth: 600, margin: "0 auto", padding: "60px 24px", textAlign: "center" }}>
            <div className="fade-in">
              <div style={{ fontSize: 80, fontWeight: 900, color: accentColor, fontFamily: "'Space Mono', monospace", lineHeight: 1, marginBottom: 8 }}>{pct}%</div>
              <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{score} / {questions.length} 問正解</div>
              <div style={{ color: "rgba(232,232,240,0.5)", marginBottom: 40 }}>
                {pct >= 80 ? "素晴らしい！この調子で続けましょう 🎉" : pct >= 60 ? "もう少し！復習して再挑戦しましょう 💪" : "基礎から見直してみましょう 📚"}
              </div>
              <div style={{ ...styles.card, padding: 24, marginBottom: 32, textAlign: "left" }}>
                {questions.map((q, i) => {
                  const ans = answers[i];
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 0", borderBottom: i < questions.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                      <span style={{ fontSize: 20 }}>{ans?.correct ? "✅" : "❌"}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, lineHeight: 1.6, color: "rgba(232,232,240,0.8)" }}>{q.question.slice(0, 60)}…</div>
                        {!ans?.correct && <div style={{ fontSize: 13, color: "#4ECDC4", marginTop: 4 }}>正解: {q.choices[q.answer]}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                <button style={styles.btnPrimary} onClick={startQuiz}>もう一度挑戦 ⚡</button>
                <button style={styles.btnGhost} onClick={() => setScreen("config")}>設定を変更</button>
                <button style={styles.btnGhost} onClick={() => { setScreen("home"); setSubject(null); setLevel(null); }}>ホームへ</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
