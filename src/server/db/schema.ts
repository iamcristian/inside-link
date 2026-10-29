import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const links = sqliteTable(
  "links",
  {
    id: text("id").primaryKey(), // ULID
    slug: text("slug").notNull(),
    type: text("type", { enum: ["DIRECT", "HUB"] })
      .notNull()
      .default("DIRECT"),
    destinationUrl: text("destination_url"),
    redirectStatus: integer("redirect_status").notNull().default(307),
    forwardQueryParams: integer("forward_query_params", { mode: "boolean" })
      .notNull()
      .default(true),
    hubLinksJson: text("hub_links_json"),
    title: text("title").notNull(),
    description: text("description"),
    ogImageUrl: text("og_image_url"),
    category: text("category").notNull().default("project"),
    tagsJson: text("tags_json").notNull().default("[]"),
    icon: text("icon").notNull().default("link"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    isPublic: integer("is_public", { mode: "boolean" }).notNull().default(false),
    isPinned: integer("is_pinned", { mode: "boolean" }).notNull().default(false),
    passwordHash: text("password_hash"),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    maxClicks: integer("max_clicks"),
    clicksCount: integer("clicks_count").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("idx_links_slug_unique").on(table.slug),
    index("idx_links_admin_cursor").on(table.isPinned, table.id),
    index("idx_links_public_cursor").on(
      table.isPublic,
      table.isActive,
      table.isPinned,
      table.id
    ),
    index("idx_links_category").on(table.category, table.isPinned, table.id),
  ]
);

export const clickEvents = sqliteTable(
  "click_events",
  {
    id: text("id").primaryKey(), // ULID
    linkId: text("link_id")
      .notNull()
      .references(() => links.id, { onDelete: "cascade" }),
    subLinkId: text("sub_link_id"),
    country: text("country").notNull().default("XX"),
    city: text("city"),
    device: text("device").notNull().default("desktop"),
    os: text("os").notNull().default("Other"),
    browser: text("browser").notNull().default("Other"),
    referrer: text("referrer").notNull().default("Direct"),
    queryParamRef: text("query_param_ref"),
    clickedAt: integer("clicked_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("idx_click_events_link_time").on(table.linkId, table.clickedAt),
    index("idx_click_events_global_time").on(table.clickedAt),
  ]
);

export const pinAttempts = sqliteTable("pin_attempts", {
  key: text("key").primaryKey(), // Hash(ip + daily_secret + link_id)
  linkId: text("link_id")
    .notNull()
    .references(() => links.id, { onDelete: "cascade" }),
  attemptsCount: integer("attempts_count").notNull().default(1),
  windowExpiresAt: integer("window_expires_at", { mode: "timestamp_ms" }).notNull(),
});

// Better-Auth Tables
export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
});

export type Link = typeof links.$inferSelect;
export type NewLink = typeof links.$inferInsert;
export type ClickEvent = typeof clickEvents.$inferSelect;
export type NewClickEvent = typeof clickEvents.$inferInsert;
