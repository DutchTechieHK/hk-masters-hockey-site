import { afterEach, describe, expect, it, vi } from "vitest";
import { setPlayerToken, clearPlayerToken, PLAYER_SESSION_EVENT } from "./playerAuth";

afterEach(() => vi.unstubAllGlobals());

describe("private lineup session changes", () => {
  it("notifies the current tab immediately when the signed-in player changes", () => {
    const storage = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    });
    const events = [];
    vi.stubGlobal("window", { dispatchEvent: (event) => events.push(event.type) });
    setPlayerToken("test-one");
    setPlayerToken("test-one");
    setPlayerToken("test-two");
    clearPlayerToken();
    expect(events).toEqual([PLAYER_SESSION_EVENT, PLAYER_SESSION_EVENT, PLAYER_SESSION_EVENT]);
  });
});
