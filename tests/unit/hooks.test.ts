import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createDebounceController } from "@/hooks/use-debounced-value";
import {
  attachInfiniteScrollObserver,
  shouldTriggerInfiniteLoad,
} from "@/hooks/use-infinite-scroll";

describe("Debounce Controller & Hook Logic (300ms)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("emits only the final value after 300ms of inactivity", () => {
    const emitted: string[] = [];
    const controller = createDebounceController("", 300, (v) => emitted.push(v));

    controller.schedule("g");
    vi.advanceTimersByTime(100);
    controller.schedule("gu");
    vi.advanceTimersByTime(100);
    controller.schedule("gui");
    vi.advanceTimersByTime(150);
    controller.schedule("guia");

    // Aún no han pasado 300ms desde el último cambio
    vi.advanceTimersByTime(299);
    expect(emitted).toEqual([]);

    // Al cumplirse los 300ms, emite únicamente "guia"
    vi.advanceTimersByTime(1);
    expect(emitted).toEqual(["guia"]);
  });

  it("cancels pending emissions cleanly on unmount/cancel", () => {
    const emitted: string[] = [];
    const controller = createDebounceController("", 300, (v) => emitted.push(v));

    controller.schedule("pendiente");
    vi.advanceTimersByTime(150);
    controller.cancel();
    vi.advanceTimersByTime(500);

    expect(emitted).toEqual([]);
  });
});

describe("Infinite Scroll Observer & Guard Logic", () => {
  it("prevents triggering when isFetchingNextPage is true or hasNextPage is false", () => {
    expect(
      shouldTriggerInfiniteLoad({
        isIntersecting: true,
        hasNextPage: true,
        isFetchingNextPage: true,
      })
    ).toBe(false);

    expect(
      shouldTriggerInfiniteLoad({
        isIntersecting: true,
        hasNextPage: false,
        isFetchingNextPage: false,
      })
    ).toBe(false);

    expect(
      shouldTriggerInfiniteLoad({
        isIntersecting: false,
        hasNextPage: true,
        isFetchingNextPage: false,
      })
    ).toBe(false);

    expect(
      shouldTriggerInfiniteLoad({
        isIntersecting: true,
        hasNextPage: true,
        isFetchingNextPage: false,
      })
    ).toBe(true);
  });

  it("invokes onLoadMore once per intersection cycle and disconnects cleanly", () => {
    let storedCallback: ((entries: Array<{ isIntersecting: boolean }>) => void) | null = null;
    let disconnected = false;
    let loadMoreCalls = 0;

    const fakeElement = {} as Element;
    const cleanup = attachInfiniteScrollObserver({
      element: fakeElement,
      hasNextPage: true,
      isFetchingNextPage: false,
      onLoadMore: () => {
        loadMoreCalls++;
      },
      createObserver: (cb) => {
        storedCallback = cb;
        return {
          observe: () => {},
          disconnect: () => {
            disconnected = true;
          },
        };
      },
    });

    expect(storedCallback).not.toBeNull();
    storedCallback!([{ isIntersecting: true }]);
    storedCallback!([{ isIntersecting: true }]); // duplicado en el mismo ciclo ignorado
    expect(loadMoreCalls).toBe(1);

    cleanup();
    expect(disconnected).toBe(true);
  });

  it("does not bind observer while isFetchingNextPage is true", () => {
    let observerCreated = false;
    const fakeElement = {} as Element;

    attachInfiniteScrollObserver({
      element: fakeElement,
      hasNextPage: true,
      isFetchingNextPage: true,
      onLoadMore: () => {},
      createObserver: () => {
        observerCreated = true;
        return { observe: () => {}, disconnect: () => {} };
      },
    });

    expect(observerCreated).toBe(false);
  });
});
