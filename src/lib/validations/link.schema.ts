import { z } from "zod";
import { SlugSchema } from "./slug.schema";

export const SafeUrlSchema = z
  .string()
  .trim()
  .url("Debe ser una URL válida")
  .refine(
    (url) => {
      try {
        const parsed = new URL(url);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    },
    "Solo se permiten URLs con protocolo http:// o https://"
  );

export const HubLinkItemSchema = z.object({
  id: z.string().min(1).max(32),
  label: z.string().min(1, "El texto del botón es requerido").max(64),
  url: SafeUrlSchema,
  icon: z.string().default("external-link"),
  variant: z.enum(["primary", "secondary", "outline"]).default("primary"),
});

export type HubLinkItem = z.infer<typeof HubLinkItemSchema>;

export const LinkCategorySchema = z.enum([
  "social",
  "project",
  "resource",
  "personal",
  "temporary",
]);

export const BaseLinkSchema = z.object({
  slug: z.string().optional(),
  type: z.enum(["DIRECT", "HUB"]).default("DIRECT"),
  destinationUrl: SafeUrlSchema.optional().nullable(),
  redirectStatus: z.union([
    z.literal(301),
    z.literal(302),
    z.literal(307),
    z.literal(308),
  ]).default(307),
  forwardQueryParams: z.boolean().default(true),
  hubLinks: z.array(HubLinkItemSchema).max(12).optional().nullable(),
  title: z.string().min(1, "El título es requerido").max(150),
  description: z.string().max(500).optional().nullable(),
  ogImageUrl: SafeUrlSchema.optional().nullable(),
  category: LinkCategorySchema.default("project"),
  tags: z
    .array(
      z
        .string()
        .min(1)
        .max(30)
        .transform((t) => t.trim().toLowerCase())
    )
    .max(10)
    .default([]),
  icon: z.string().default("link"),
  isActive: z.boolean().default(true),
  isPublic: z.boolean().default(false),
  isPinned: z.boolean().default(false),
  pin: z
    .string()
    .min(4, "El PIN debe tener al menos 4 caracteres")
    .max(32)
    .optional()
    .nullable(),
  expiresAt: z.coerce.date().optional().nullable(),
  maxClicks: z.number().int().positive().optional().nullable(),
});

function validateLinkInvariants(
  data: Partial<z.infer<typeof BaseLinkSchema>>,
  ctx: z.RefinementCtx
) {
  if (data.slug && data.slug.trim().length > 0) {
    const parsed = SlugSchema.safeParse(data.slug);
    if (!parsed.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["slug"],
        message: parsed.error.issues[0]?.message || "Slug inválido",
      });
    }
  }

  if (data.type === "DIRECT") {
    if (!data.destinationUrl || data.destinationUrl.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["destinationUrl"],
        message: "La URL de destino es obligatoria para enlaces de tipo DIRECT",
      });
    }
  }

  if (data.type === "HUB") {
    if (!data.hubLinks || data.hubLinks.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["hubLinks"],
        message: "Debe incluir al menos un sub-enlace para el modo HUB",
      });
    }
  }
}

export const CreateLinkSchema = BaseLinkSchema.superRefine(validateLinkInvariants);

export const UpdateLinkSchema = BaseLinkSchema.partial()
  .extend({
    id: z.string().min(1),
  })
  .superRefine(validateLinkInvariants);

export type CreateLinkInput = z.infer<typeof CreateLinkSchema>;
export type UpdateLinkInput = z.infer<typeof UpdateLinkSchema>;
