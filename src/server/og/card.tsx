import React from "react";
import { ImageResponse } from "next/og";
import type { OgPresentation } from "./presentation";

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

export function renderOgImage(
  card: OgPresentation,
  headers: HeadersInit,
): ImageResponse {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        padding: 44,
        backgroundColor: "#101117",
        color: "#edf1f7",
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          border: "1px solid #303645",
          borderRadius: 24,
          padding: "42px 52px",
          backgroundColor: "#171a23",
        }}
      >
        <div
          style={{
            display: "flex",
            color: "#a5b7d2",
            fontSize: 22,
            letterSpacing: 3,
          }}
        >
          INSIDE LINK / {card.label}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: card.title.length > 44 ? 54 : 68,
              fontWeight: 700,
              lineHeight: 1.08,
              lineClamp: 2,
            }}
          >
            {card.title}
          </div>
          <div
            style={{
              fontSize: 29,
              color: "#acb5c5",
              lineHeight: 1.25,
              lineClamp: 2,
            }}
          >
            {card.description}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            borderTop: "1px solid #303645",
            paddingTop: 22,
            fontSize: 21,
            color: "#a5b7d2",
          }}
        >
          <span>cristianarando.dev</span>
          <span>{card.slug}</span>
        </div>
      </div>
    </div>,
    { width: OG_WIDTH, height: OG_HEIGHT, headers },
  );
}
