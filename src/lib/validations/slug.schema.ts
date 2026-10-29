import { z } from "zod";
import { isReservedSlug } from "../constants/reserved-slugs";

export function normalizeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remover tildes y diacríticos
    .replace(/\s+/g, "-") // espacios a guiones
    .replace(/[^a-z0-9-_]/g, "") // caracteres no válidos eliminados
    .replace(/-+/g, "-") // colapsar guiones repetidos
    .replace(/^[-_]+|[-_]+$/g, ""); // quitar guiones extremos
}

export const SlugSchema = z
  .string()
  // Validaciones sobre la entrada cruda: deben ocurrir ANTES de normalizar,
  // porque normalizeSlug elimina los puntos ("favicon.ico" -> "faviconico").
  .refine(
    (raw) => !raw.includes("."),
    "El slug no puede contener puntos ni extensiones de archivo"
  )
  .refine(
    (raw) => !isReservedSlug(raw),
    "El slug coincide con una ruta reservada del sistema o del portafolio"
  )
  .transform((val) => normalizeSlug(val))
  .pipe(
    z
      .string()
      .min(3, "El slug debe tener al menos 3 caracteres")
      .max(100, "El slug no puede exceder 100 caracteres")
      .regex(
        /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/,
        "El slug solo puede contener letras minúsculas, números, guiones y guiones bajos, sin guiones al inicio o final"
      )
      .refine(
        (val) => !val.includes("."),
        "El slug no puede contener puntos ni extensiones de archivo"
      )
      .refine(
        (val) => !isReservedSlug(val),
        "El slug coincide con una ruta reservada del sistema o del portafolio"
      )
  );

export type ValidatedSlug = z.infer<typeof SlugSchema>;

export type SlugClassification =
  | { ok: true; normalized: string }
  | { ok: false; normalized: string; reason: "RESERVED" | "INVALID"; message: string };

/**
 * Clasifica un slug crudo distinguiendo "reservado" de "sintácticamente inválido".
 * Función pura: reutilizable en servidor (servicio/API) y cliente (modal de edición).
 */
export function classifySlug(raw: string): SlugClassification {
  const normalized = normalizeSlug(raw);

  if (isReservedSlug(raw) || (normalized.length > 0 && isReservedSlug(normalized))) {
    return {
      ok: false,
      normalized,
      reason: "RESERVED",
      message: "El slug coincide con una ruta reservada del sistema o del portafolio",
    };
  }

  const result = SlugSchema.safeParse(raw);
  if (!result.success) {
    return {
      ok: false,
      normalized,
      reason: "INVALID",
      message: result.error.issues[0]?.message ?? "Slug inválido",
    };
  }

  return { ok: true, normalized: result.data };
}
