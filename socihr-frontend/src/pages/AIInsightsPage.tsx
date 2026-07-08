import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Layout from "../components/Layout";
import { getDashboardInsights, askAIQuestion, getAIAnomalies, getAIRecommendations } from "../services/api";

export default function AIInsightsPage() {
  const [activeTab, setActiveTab] = useState<"insights" | "ask" | "anomalies" | "recommendations">("insights");
  
  // Insights tab
  const [insights, setInsights] = useState("");
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsGeneratedAt, setInsightsGeneratedAt] = useState<string | null>(null);

  // Ask tab
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [askLoading, setAskLoading] = useState(false);

  // Anomalies tab
  const [anomalies, setAnomalies] = useState<string[]>([]);
  const [anomaliesLoading, setAnomaliesLoading] = useState(false);
  const [anomaliesCheckedAt, setAnomaliesCheckedAt] = useState<string | null>(null);

  // Recommendations tab
  const [recommendations, setRecommendations] = useState("");
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);

  useEffect(() => {
    if (activeTab === "insights" && !insights) {
      loadInsights();
    } else if (activeTab === "anomalies" && anomalies.length === 0) {
      loadAnomalies();
    } else if (activeTab === "recommendations" && !recommendations) {
      loadRecommendations();
    }
  }, [activeTab]);

  async function loadInsights() {
    setInsightsLoading(true);
    try {
      const data = await getDashboardInsights();
      setInsights(data.insights);
      setInsightsGeneratedAt(data.generatedAt);
    } catch (error: any) {
      console.error("Failed to load insights:", error);
      if (error.message.includes("OpenAI")) {
        setInsights("⚠️ AI Insights is not configured. Please set up your OpenAI API key in appsettings.json.\n\nSee AI_INSIGHTS_SETUP_GUIDE.md for instructions.");
      } else {
        setInsights("Failed to generate insights. Please try again later.");
      }
    } finally {
      setInsightsLoading(false);
    }
  }

  async function loadAnomalies() {
    setAnomaliesLoading(true);
    try {
      const data = await getAIAnomalies();
      setAnomalies(data.anomalies);
      setAnomaliesCheckedAt(data.checkedAt);
    } catch (error) {
      console.error("Failed to load anomalies:", error);
      setAnomalies(["Failed to detect anomalies. Please try again later."]);
    } finally {
      setAnomaliesLoading(false);
    }
  }

  async function loadRecommendations() {
    setRecommendationsLoading(true);
    try {
      const data = await getAIRecommendations();
      setRecommendations(data.recommendations);
    } catch (error) {
      console.error("Failed to load recommendations:", error);
      setRecommendations("Failed to generate recommendations. Please try again later.");
    } finally {
      setRecommendationsLoading(false);
    }
  }

  async function handleAskQuestion() {
    if (!question.trim()) {
      alert("Please enter a question");
      return;
    }

    setAskLoading(true);
    setAnswer("");
    try {
      const data = await askAIQuestion(question);
      setAnswer(data.answer);
    } catch (error) {
      console.error("Failed to ask question:", error);
      setAnswer("Failed to get answer. Please try again later.");
    } finally {
      setAskLoading(false);
    }
  }

  return (
    <Layout>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        <div className="page-hd">
          <div>
            <h1 className="page-title">🤖 AI Insights</h1>
            <p className="page-sub">AI-powered analytics, recommendations, and intelligent Q&A</p>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, borderBottom: "1px solid var(--line)", paddingBottom: 0, overflowX: "auto" }}>
        <button
          onClick={() => setActiveTab("insights")}
          style={{
            padding: "10px 20px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "insights" ? "2px solid var(--accent)" : "2px solid transparent",
            color: activeTab === "insights" ? "var(--accent)" : "var(--text-3)",
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
            transition: "all 0.2s",
            whiteSpace: "nowrap",
          }}
        >
          💡 Dashboard Insights
        </button>
        <button
          onClick={() => setActiveTab("ask")}
          style={{
            padding: "10px 20px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "ask" ? "2px solid var(--accent)" : "2px solid transparent",
            color: activeTab === "ask" ? "var(--accent)" : "var(--text-3)",
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
            transition: "all 0.2s",
            whiteSpace: "nowrap",
          }}
        >
          💬 Ask AI
        </button>
        <button
          onClick={() => setActiveTab("anomalies")}
          style={{
            padding: "10px 20px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "anomalies" ? "2px solid var(--accent)" : "2px solid transparent",
            color: activeTab === "anomalies" ? "var(--accent)" : "var(--text-3)",
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
            transition: "all 0.2s",
            whiteSpace: "nowrap",
          }}
        >
          🚨 Anomaly Detection
        </button>
        <button
          onClick={() => setActiveTab("recommendations")}
          style={{
            padding: "10px 20px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "recommendations" ? "2px solid var(--accent)" : "2px solid transparent",
            color: activeTab === "recommendations" ? "var(--accent)" : "var(--text-3)",
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
            transition: "all 0.2s",
            whiteSpace: "nowrap",
          }}
        >
          ✨ Recommendations
        </button>
      </div>

      <AnimatePresence mode="wait">
        {/* Insights Tab */}
        {activeTab === "insights" && (
          <motion.div
            key="insights"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>💡 AI Generated Insights</h3>
                <button
                  onClick={loadInsights}
                  className="btn btn-secondary btn-sm"
                  disabled={insightsLoading}
                >
                  {insightsLoading ? (
                    <>
                      <span className="spin" style={{ width: 12, height: 12, marginRight: 6 }} />
                      Generating...
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}>
                        <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                        <path d="M21 3v5h-5" />
                      </svg>
                      Refresh
                    </>
                  )}
                </button>
              </div>

              {insightsLoading ? (
                <div className="loader" style={{ padding: 40 }}>
                  <div className="spin" />
                  Analyzing your data with AI...
                </div>
              ) : (
                <>
                  <div style={{
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.8,
                    color: 'var(--text-2)',
                    fontSize: 14,
                    padding: 16,
                    background: 'var(--surface-2)',
                    borderRadius: 8,
                    border: '1px solid var(--line)',
                  }}>
                    {insights || 'No insights available. Click Refresh to generate.'}
                  </div>
                  {insightsGeneratedAt && (
                    <p style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 12 }}>
                      Generated at {new Date(insightsGeneratedAt).toLocaleString()}
                    </p>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}

        {/* Ask AI Tab */}
        {activeTab === "ask" && (
          <motion.div
            key="ask"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <div className="card">
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>💬 Ask AI a Question</h3>

              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                <input
                  className="input"
                  type="text"
                  placeholder="e.g., Which department needs the most attention?"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAskQuestion()}
                  style={{ flex: 1 }}
                />
                <button
                  onClick={handleAskQuestion}
                  className="btn btn-primary"
                  disabled={askLoading || !question.trim()}
                >
                  {askLoading ? (
                    <>
                      <span className="spin" style={{ width: 12, height: 12, marginRight: 6 }} />
                      Thinking...
                    </>
                  ) : (
                    'Ask'
                  )}
                </button>
              </div>

              {/* Quick Questions */}
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 8 }}>Quick Questions:</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[
                    "Which staff member has the lowest engagement rate?",
                    "What's the trend for this month compared to last month?",
                    "Which platform has the best completion rate?",
                    "What can we do to improve engagement?",
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => setQuestion(q)}
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: 11 }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              {answer && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    padding: 16,
                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(214, 41, 118, 0.08) 100%)',
                    borderRadius: 8,
                    borderLeft: '4px solid var(--accent)',
                  }}
                >
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-text)', marginBottom: 8 }}>
                    AI Answer:
                  </p>
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, color: 'var(--text-2)', fontSize: 14 }}>
                    {answer}
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}

        {/* Anomalies Tab */}
        {activeTab === "anomalies" && (
          <motion.div
            key="anomalies"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <div className="card" style={{ borderLeft: '4px solid var(--red)' }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--red)' }}>🚨 Detected Anomalies</h3>
                <button
                  onClick={loadAnomalies}
                  className="btn btn-secondary btn-sm"
                  disabled={anomaliesLoading}
                >
                  {anomaliesLoading ? (
                    <>
                      <span className="spin" style={{ width: 12, height: 12, marginRight: 6 }} />
                      Checking...
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}>
                        <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                        <path d="M21 3v5h-5" />
                      </svg>
                      Re-check
                    </>
                  )}
                </button>
              </div>

              <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 16 }}>
                Comparing current month vs. last month (&gt;20% deviation)
              </p>

              {anomaliesLoading ? (
                <div className="loader" style={{ padding: 40 }}>
                  <div className="spin" />
                  Detecting anomalies...
                </div>
              ) : anomalies.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-4)' }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 12px' }}>
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <path d="M22 4 12 14.01l-3-3" />
                  </svg>
                  <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>No Anomalies Detected</p>
                  <p style={{ fontSize: 12 }}>Your performance is stable compared to last month</p>
                </div>
              ) : (
                <>
                  <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {anomalies.map((anomaly, idx) => (
                      <motion.li
                        key={idx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        style={{
                          padding: 12,
                          background: 'var(--red-soft)',
                          borderRadius: 8,
                          display: 'flex',
                          gap: 10,
                          alignItems: 'flex-start',
                        }}
                      >
                        <span style={{ color: 'var(--red)', fontSize: 18 }}>⚠️</span>
                        <span style={{ flex: 1, fontSize: 13, color: 'var(--text-2)' }}>{anomaly}</span>
                      </motion.li>
                    ))}
                  </ul>
                  {anomaliesCheckedAt && (
                    <p style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 12 }}>
                      Checked at {new Date(anomaliesCheckedAt).toLocaleString()}
                    </p>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}

        {/* Recommendations Tab */}
        {activeTab === "recommendations" && (
          <motion.div
            key="recommendations"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <div className="card" style={{ borderLeft: '4px solid var(--green)' }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--green)' }}>✨ AI Recommendations</h3>
                <button
                  onClick={loadRecommendations}
                  className="btn btn-secondary btn-sm"
                  disabled={recommendationsLoading}
                >
                  {recommendationsLoading ? (
                    <>
                      <span className="spin" style={{ width: 12, height: 12, marginRight: 6 }} />
                      Generating...
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}>
                        <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                        <path d="M21 3v5h-5" />
                      </svg>
                      Refresh
                    </>
                  )}
                </button>
              </div>

              {recommendationsLoading ? (
                <div className="loader" style={{ padding: 40 }}>
                  <div className="spin" />
                  Generating recommendations...
                </div>
              ) : (
                <div style={{
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.8,
                  color: 'var(--text-2)',
                  fontSize: 14,
                  padding: 16,
                  background: 'var(--green-soft)',
                  borderRadius: 8,
                }}>
                  {recommendations || 'No recommendations available. Click Refresh to generate.'}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
