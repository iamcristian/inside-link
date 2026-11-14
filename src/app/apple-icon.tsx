import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#09090b",
          borderRadius: 36,
          border: "6px solid #10b981",
          fontFamily: "sans-serif",
          fontWeight: 700,
          fontSize: 82,
          letterSpacing: "-0.04em",
        }}
      >
        <span style={{ color: "#fafafa" }}>C</span>
        <span style={{ color: "#10b981" }}>A</span>
      </div>
    ),
    { ...size }
  );
}
