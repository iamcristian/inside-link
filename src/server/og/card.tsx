import { readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { ImageResponse } from "next/og";
import type { OgPresentation } from "./presentation";

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const authorAvatar = `data:image/png;base64,${readFileSync(join(process.cwd(), "src/server/og/author-avatar.png")).toString("base64")}`;

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
        backgroundColor: "#101010",
        color: "#f5f5f5",
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          border: "1px solid #343434",
          borderRadius: 24,
          padding: "42px 52px",
          backgroundColor: "#181818",
        }}
      >
        <div
          style={{
            display: "flex",
            color: "#bdbdbd",
            fontSize: 22,
            letterSpacing: 4,
          }}
        >
          INSIDE LINK / {card.label}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: card.title.length > 44 ? 54 : 68,
              fontWeight: 700,
              letterSpacing: -1.5,
              lineHeight: 1.08,
              lineClamp: 2,
            }}
          >
            {card.title}
          </div>
          <div
            style={{
              fontSize: 29,
              color: "#c5c5c5",
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
            borderTop: "1px solid #343434",
            paddingTop: 22,
            fontSize: 21,
            color: "#bdbdbd",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <img
              src={authorAvatar}
              alt=""
              width={56}
              height={56}
              style={{
                borderRadius: 28,
              }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ color: "#f5f5f5", fontWeight: 700 }}>
                Cristian Arando
              </span>
              <span style={{ fontSize: 17 }}>
                Software &amp; Systems Engineer
              </span>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              justifyContent: "center",
              gap: 3,
            }}
          >
            <span>links.cristianarando.dev</span>
            {card.slug && <span style={{ fontSize: 17 }}>{card.slug}</span>}
          </div>
        </div>
      </div>
    </div>,
    { width: OG_WIDTH, height: OG_HEIGHT, headers },
  );
}
