import { useState } from "react";
import Layout from "../components/Layout";

type ManualTab = "video" | "pdf";

const PDF_URL = "/manual/socihr-user-manual.pdf";
const VIDEO_URL = "/manual/socihr-user-manual.mp4";

export default function UserManualPage() {
  const [tab, setTab] = useState<ManualTab>("video");

  return (
    <Layout>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: "1.35rem", fontWeight: 700, color: "var(--text-1)", letterSpacing: "-0.02em" }}>
            User Manual
          </h1>
          <p style={{ fontSize: "0.85rem", color: "var(--text-3)", marginTop: 4 }}>
            Panduan penggunaan sistem SociHR — pilih format video atau PDF.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a
            href={PDF_URL}
            download="SociHR-User-Manual.pdf"
            className="btn btn-ghost"
            style={{ textDecoration: "none", fontSize: "0.8rem", padding: "7px 12px", border: "1px solid var(--line)", borderRadius: 8, color: "var(--text-2)", background: "var(--white)" }}
          >
            Muat Turun PDF
          </a>
          <a
            href={VIDEO_URL}
            download="SociHR-User-Manual.mp4"
            className="btn btn-ghost"
            style={{ textDecoration: "none", fontSize: "0.8rem", padding: "7px 12px", border: "1px solid var(--line)", borderRadius: 8, color: "var(--text-2)", background: "var(--white)" }}
          >
            Muat Turun Video
          </a>
        </div>
      </div>

      {/* Tab selector — Video / PDF */}
      <div
        role="tablist"
        aria-label="Pilih format manual"
        style={{
          display: "inline-flex",
          padding: 4,
          gap: 4,
          borderRadius: 10,
          background: "var(--surface)",
          border: "1px solid var(--line)",
          marginBottom: 16,
        }}
      >
        {(
          [
            { value: "video", label: "Video Tutorial" },
            { value: "pdf", label: "Manual PDF" },
          ] as { value: ManualTab; label: string }[]
        ).map((t) => (
          <button
            key={t.value}
            role="tab"
            aria-selected={tab === t.value}
            onClick={() => setTab(t.value)}
            style={{
              padding: "8px 18px",
              borderRadius: 7,
              border: "none",
              cursor: "pointer",
              fontSize: "0.83rem",
              fontWeight: tab === t.value ? 700 : 500,
              color: tab === t.value ? "var(--accent)" : "var(--text-3)",
              background: tab === t.value ? "var(--white)" : "transparent",
              boxShadow: tab === t.value ? "var(--shadow-sm)" : "none",
              transition: "all 0.12s ease",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div
        style={{
          background: "var(--white)",
          border: "1px solid var(--line)",
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        {tab === "video" ? (
          <div style={{ padding: 16 }}>
            <video
              key={VIDEO_URL}
              controls
              preload="metadata"
              src={VIDEO_URL}
              style={{ width: "100%", maxHeight: "70vh", borderRadius: 8, background: "#000" }}
            >
              Browser anda tidak menyokong video.{" "}
              <a href={VIDEO_URL} download>
                Muat turun video
              </a>
              .
            </video>
            <p style={{ fontSize: "0.78rem", color: "var(--text-4)", marginTop: 10 }}>
              Jika video tidak dimainkan, gunakan butang Muat Turun Video di atas.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                padding: "10px 16px",
                borderBottom: "1px solid var(--line)",
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-2)" }}>
                SociHR-User-Manual.pdf
              </span>
              <a
                href={PDF_URL}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--accent)", textDecoration: "none" }}
              >
                Buka dalam tab baru →
              </a>
            </div>
            <iframe
              title="SociHR User Manual PDF"
              src={PDF_URL}
              style={{ width: "100%", height: "75vh", border: "none", background: "var(--surface)" }}
            />
          </div>
        )}
      </div>
    </Layout>
  );
}
