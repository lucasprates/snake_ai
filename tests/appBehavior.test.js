import test from "node:test";
import assert from "node:assert/strict";

function createClassList(element) {
  return {
    add(...classNames) {
      for (const className of classNames) {
        if (!className) {
          continue;
        }

        element._classes.add(className);
      }
    },
    remove(...classNames) {
      for (const className of classNames) {
        element._classes.delete(className);
      }
    },
    toggle(className, force) {
      if (force === true) {
        element._classes.add(className);
        return true;
      }

      if (force === false) {
        element._classes.delete(className);
        return false;
      }

      if (element._classes.has(className)) {
        element._classes.delete(className);
        return false;
      }

      element._classes.add(className);
      return true;
    },
    contains(className) {
      return element._classes.has(className);
    }
  };
}

class ElementMock {
  constructor(ownerDocument, tagName = "div", id = null) {
    this.ownerDocument = ownerDocument;
    this.tagName = tagName.toUpperCase();
    this.id = id;
    this.dataset = {};
    this.style = {
      setProperty: () => {}
    };
    this.children = [];
    this.listeners = new Map();
    this.attributes = new Map();
    this.value = "";
    this.textContent = "";
    this.disabled = false;
    this._classes = new Set();
    this.classList = createClassList(this);
  }

  get className() {
    return [...this._classes].join(" ");
  }

  set className(value) {
    this._classes.clear();
    const parts = String(value ?? "").trim().split(/\s+/);
    for (const part of parts) {
      if (part) {
        this._classes.add(part);
      }
    }
  }

  append(...nodes) {
    this.children.push(...nodes);
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }

    this.listeners.get(type).push(handler);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  focus() {
    this.ownerDocument.activeElement = this;
  }

  dispatch(type, init = {}) {
    const handlers = this.listeners.get(type) ?? [];
    const event = {
      type,
      target: this,
      currentTarget: this,
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
      ...init
    };

    for (const handler of handlers) {
      handler(event);
    }
  }
}

class DocumentMock {
  constructor() {
    this.elementsById = new Map();
    this.activeElement = null;
    this.controlsElement = new ElementMock(this, "section");
    this.controlsElement.className = "controls";
    this.directionButtons = [];

    this.registerCoreElements();
  }

  register(id, tagName = "div") {
    const element = new ElementMock(this, tagName, id);
    this.elementsById.set(id, element);
    return element;
  }

  registerCoreElements() {
    const board = this.register("board");
    board.className = "board";
    this.register("score");
    this.register("rogue-status");
    this.register("status");
    this.register("rogue-count", "select").value = "0";
    this.register("modal-rogue-count", "select").value = "0";
    this.register("difficulty", "select").value = "MEDIUM";
    this.register("modal-difficulty", "select").value = "MEDIUM";
    this.register("start-btn", "button");
    this.register("restart-btn", "button");
    this.register("pause-btn", "button");
    this.register("controls-toggle-btn", "button");
    this.register("modal-message");
    this.register("modal-score");
    this.register("modal-restart-btn", "button");
    this.register("best-ai-count");
    this.register("best-difficulty");
    this.register("high-score");
    this.register("scores-toggle-btn", "button");
    const scoresPanel = this.register("scores-panel");
    scoresPanel.className = "scores-panel hidden";
    this.register("scores-difficulty", "select").value = "MEDIUM";
    this.register("scores-list", "ul");

    const modal = this.register("game-over-modal");
    modal.className = "modal hidden";

    const directions = ["UP", "LEFT", "RIGHT", "DOWN"];
    for (const direction of directions) {
      const button = new ElementMock(this, "button");
      button.setAttribute("data-direction", direction);
      this.directionButtons.push(button);
    }
  }

  getElementById(id) {
    return this.elementsById.get(id) ?? null;
  }

  createElement(tagName) {
    return new ElementMock(this, tagName);
  }

  querySelector(selector) {
    if (selector === ".controls") {
      return this.controlsElement;
    }

    return null;
  }

  querySelectorAll(selector) {
    if (selector === "[data-direction]") {
      return this.directionButtons;
    }

    return [];
  }
}

class WindowMock {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }

    this.listeners.get(type).push(handler);
  }
}

function createLocalStorageMock() {
  const values = new Map();

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    clear() {
      values.clear();
    }
  };
}

function createFakeTimers() {
  const timers = new Map();
  let nextId = 1;

  return {
    setTimeout(fn, delay) {
      const id = nextId;
      nextId += 1;
      timers.set(id, { fn, delay });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    runNext() {
      const iterator = timers.entries().next();
      if (iterator.done) {
        return false;
      }

      const [id, timer] = iterator.value;
      timers.delete(id);
      timer.fn();
      return true;
    },
    firstDelay() {
      const iterator = timers.values().next();
      if (iterator.done) {
        return null;
      }

      return iterator.value.delay;
    }
  };
}

function installAppEnvironment() {
  const document = new DocumentMock();
  const window = new WindowMock();
  const localStorage = createLocalStorageMock();
  const timers = createFakeTimers();
  const originals = {
    document: globalThis.document,
    window: globalThis.window,
    localStorage: globalThis.localStorage,
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout
  };

  globalThis.document = document;
  globalThis.window = window;
  globalThis.localStorage = localStorage;
  globalThis.setTimeout = timers.setTimeout;
  globalThis.clearTimeout = timers.clearTimeout;

  return {
    document,
    localStorage,
    timers,
    restore() {
      globalThis.document = originals.document;
      globalThis.window = originals.window;
      globalThis.localStorage = originals.localStorage;
      globalThis.setTimeout = originals.setTimeout;
      globalThis.clearTimeout = originals.clearTimeout;
    }
  };
}

async function loadAppModule() {
  const appUrl = new URL("../src/app.js", import.meta.url);
  await import(`${appUrl.href}?app_behavior_test=${Date.now()}-${Math.random()}`);
}

test("run difficulty stays locked for active tick timing and HUD best label", async (t) => {
  const env = installAppEnvironment();
  t.after(() => {
    env.restore();
  });

  await loadAppModule();

  const startButton = env.document.getElementById("start-btn");
  const difficultySelect = env.document.getElementById("difficulty");
  const rogueCountSelect = env.document.getElementById("rogue-count");
  const bestDifficulty = env.document.getElementById("best-difficulty");

  rogueCountSelect.value = "0";
  difficultySelect.value = "EASY";
  startButton.dispatch("click");

  assert.equal(env.timers.firstDelay(), 220);
  assert.equal(bestDifficulty.textContent, "Easy");

  difficultySelect.value = "HARD";
  difficultySelect.dispatch("change");
  assert.equal(bestDifficulty.textContent, "Easy");

  assert.equal(env.timers.runNext(), true);
  assert.equal(env.timers.firstDelay(), 220);
});

test("run rogue count stays locked during an active game", async (t) => {
  const env = installAppEnvironment();
  t.after(() => {
    env.restore();
  });

  await loadAppModule();

  const startButton = env.document.getElementById("start-btn");
  const rogueCountSelect = env.document.getElementById("rogue-count");
  const difficultySelect = env.document.getElementById("difficulty");
  const rogueStatus = env.document.getElementById("rogue-status");

  rogueCountSelect.value = "1";
  difficultySelect.value = "MEDIUM";
  startButton.dispatch("click");

  assert.match(rogueStatus.textContent, /\/1$/);

  rogueCountSelect.value = "5";
  rogueCountSelect.dispatch("change");
  assert.match(rogueStatus.textContent, /\/1$/);
});

test("pausing stops scheduled ticks until resumed", async (t) => {
  const env = installAppEnvironment();
  t.after(() => {
    env.restore();
  });

  await loadAppModule();

  const startButton = env.document.getElementById("start-btn");
  const pauseButton = env.document.getElementById("pause-btn");
  const difficultySelect = env.document.getElementById("difficulty");
  const rogueCountSelect = env.document.getElementById("rogue-count");

  rogueCountSelect.value = "0";
  difficultySelect.value = "MEDIUM";
  startButton.dispatch("click");

  assert.equal(env.timers.firstDelay(), 160);

  pauseButton.dispatch("click");
  assert.equal(env.timers.firstDelay(), null);

  pauseButton.dispatch("click");
  assert.equal(env.timers.firstDelay(), 160);
});

test("scores panel difficulty mirrors active run on open but stays independent", async (t) => {
  const env = installAppEnvironment();
  t.after(() => {
    env.restore();
  });

  await loadAppModule();

  const startButton = env.document.getElementById("start-btn");
  const scoresToggleButton = env.document.getElementById("scores-toggle-btn");
  const scoresDifficultySelect = env.document.getElementById("scores-difficulty");
  const difficultySelect = env.document.getElementById("difficulty");
  const rogueCountSelect = env.document.getElementById("rogue-count");
  const bestDifficulty = env.document.getElementById("best-difficulty");

  rogueCountSelect.value = "0";
  difficultySelect.value = "EASY";
  startButton.dispatch("click");

  scoresToggleButton.dispatch("click");
  assert.equal(scoresDifficultySelect.value, "EASY");
  assert.equal(bestDifficulty.textContent, "Easy");

  scoresDifficultySelect.value = "HARD";
  scoresDifficultySelect.dispatch("change");
  assert.equal(bestDifficulty.textContent, "Easy");
  assert.equal(difficultySelect.value, "EASY");

  scoresToggleButton.dispatch("click");
  scoresToggleButton.dispatch("click");
  assert.equal(scoresDifficultySelect.value, "EASY");
});

test("game-over score summary does not change after modal setup edits", async (t) => {
  const env = installAppEnvironment();
  t.after(() => {
    env.restore();
  });

  await loadAppModule();

  env.localStorage.setItem(
    "snake_highScoresByAiCount",
    JSON.stringify({
      "0:EASY": 5,
      "0:HARD": 9
    })
  );

  const startButton = env.document.getElementById("start-btn");
  const difficultySelect = env.document.getElementById("difficulty");
  const rogueCountSelect = env.document.getElementById("rogue-count");
  const modal = env.document.getElementById("game-over-modal");
  const modalScore = env.document.getElementById("modal-score");
  const modalDifficultySelect = env.document.getElementById("modal-difficulty");
  const bestDifficulty = env.document.getElementById("best-difficulty");

  rogueCountSelect.value = "0";
  difficultySelect.value = "EASY";
  startButton.dispatch("click");

  let safety = 0;
  while (modal.classList.contains("hidden")) {
    safety += 1;
    assert.ok(safety < 30, "expected game over before 30 ticks");
    assert.equal(env.timers.runNext(), true);
  }

  const initialSummary = modalScore.textContent;
  assert.match(initialSummary, /Easy/);
  assert.match(initialSummary, /5/);

  modalDifficultySelect.value = "HARD";
  modalDifficultySelect.dispatch("change");

  assert.equal(modalScore.textContent, initialSummary);
  assert.equal(bestDifficulty.textContent, "Easy");
});
