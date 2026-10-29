"use client";

import { useCallback, useEffect, useRef } from "react";

export interface InfiniteScrollGuardState {
  isIntersecting: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  disabled?: boolean;
}

export function shouldTriggerInfiniteLoad(state: InfiniteScrollGuardState): boolean {
  if (state.disabled) return false;
  if (!state.isIntersecting) return false;
  if (!state.hasNextPage) return false;
  if (state.isFetchingNextPage) return false;
  return true;
}

export interface ObserverLike {
  observe: (target: Element) => void;
  disconnect: () => void;
}

export type ObserverFactory = (
  callback: (entries: Array<{ isIntersecting: boolean }>) => void,
  options?: { rootMargin?: string; threshold?: number }
) => ObserverLike;

export function attachInfiniteScrollObserver(params: {
  element: Element | null;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  disabled?: boolean;
  rootMargin?: string;
  onLoadMore: () => void;
  createObserver?: ObserverFactory;
}): () => void {
  const {
    element,
    hasNextPage,
    isFetchingNextPage,
    disabled = false,
    rootMargin = "240px",
    onLoadMore,
    createObserver,
  } = params;

  if (!element || !hasNextPage || isFetchingNextPage || disabled) {
    return () => {};
  }

  const factory: ObserverFactory | null =
    createObserver ??
    (typeof IntersectionObserver !== "undefined"
      ? (cb, opts) => new IntersectionObserver(cb, opts)
      : null);

  if (!factory) {
    return () => {};
  }

  let triggeredInCycle = false;

  const observer = factory(
    (entries) => {
      const entry = entries[0];
      if (!entry) return;
      if (
        !triggeredInCycle &&
        shouldTriggerInfiniteLoad({
          isIntersecting: entry.isIntersecting,
          hasNextPage,
          isFetchingNextPage,
          disabled,
        })
      ) {
        triggeredInCycle = true;
        onLoadMore();
      }
    },
    { rootMargin, threshold: 0.05 }
  );

  observer.observe(element);

  return () => {
    observer.disconnect();
  };
}

export interface UseInfiniteScrollOptions {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  rootMargin?: string;
  disabled?: boolean;
}

/**
 * Hook de Infinite Scroll basado en IntersectionObserver.
 * Devuelve un ref callback para colocar en el elemento centinela al final de la lista.
 */
export function useInfiniteScroll(options: UseInfiniteScrollOptions) {
  const {
    hasNextPage,
    isFetchingNextPage,
    onLoadMore,
    rootMargin = "240px",
    disabled = false,
  } = options;

  const nodeRef = useRef<HTMLElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const rebind = useCallback(() => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    if (nodeRef.current) {
      cleanupRef.current = attachInfiniteScrollObserver({
        element: nodeRef.current,
        hasNextPage,
        isFetchingNextPage,
        disabled,
        rootMargin,
        onLoadMore,
      });
    }
  }, [hasNextPage, isFetchingNextPage, disabled, rootMargin, onLoadMore]);

  useEffect(() => {
    rebind();
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [rebind]);

  const sentinelRef = useCallback(
    (node: HTMLElement | null) => {
      nodeRef.current = node;
      rebind();
    },
    [rebind]
  );

  return { sentinelRef };
}
