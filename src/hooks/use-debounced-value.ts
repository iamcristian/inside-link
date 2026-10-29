"use client";

import { useEffect, useState } from "react";

export interface DebounceController<T> {
  schedule: (nextValue: T) => void;
  cancel: () => void;
  flush: () => void;
}

/**
 * Controlador determinista de debounce reutilizable por el hook React y por tests unitarios.
 */
export function createDebounceController<T>(
  initialValue: T,
  delayMs: number,
  onEmit: (value: T) => void
): DebounceController<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: T = initialValue;
  let hasPending = false;

  const cancel = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    hasPending = false;
  };

  const schedule = (nextValue: T) => {
    pending = nextValue;
    hasPending = true;
    if (timer !== null) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      hasPending = false;
      onEmit(pending);
    }, Math.max(0, delayMs));
  };

  const flush = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (hasPending) {
      hasPending = false;
      onEmit(pending);
    }
  };

  return { schedule, cancel, flush };
}

/**
 * Hook que retrasa la actualización de un valor hasta que transcurran `delay` ms sin cambios (300ms por defecto).
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, Math.max(0, delay));

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
