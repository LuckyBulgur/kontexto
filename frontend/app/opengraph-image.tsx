import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Kontexto: das deutsche Wort-Ratespiel";
export const dynamic = "force-static";

export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0a0a0a", color: "#fff", fontSize: 72, fontWeight: 700 }}>
        <div>KONTEXTO</div>
        <div style={{ fontSize: 32, fontWeight: 400, marginTop: 16, color: "#a1a1aa" }}>
          Das deutsche Wort-Ratespiel
        </div>
      </div>
    ),
    { ...size }
  );
}
