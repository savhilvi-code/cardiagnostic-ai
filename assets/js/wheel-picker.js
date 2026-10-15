(function () {
  "use strict";

  let state = null;
  let activeIndex = 0;
  let activeRenderedIndex = 0;
  let scrollFrame = 0;
  let settleTimer = 0;
  let pointer = null;

  const ROW_HEIGHT = 50;
  const WHEEL_RADIUS = 86;
  const ROW_ANGLE = Math.PI / 5.6;

  const element = (id) => document.getElementById(id);

  function items() {
    return Array.from(element("wheelPickerList")?.querySelectorAll(".wheel-picker-option") || []);
  }

  function scrollToIndex(index, behavior = "smooth") {
    const viewport = element("wheelPickerViewport");
    const option = items()[index];
    if (!viewport || !option) return;
    viewport.scrollTo({
      top: option.offsetTop - (viewport.clientHeight - option.offsetHeight) / 2,
      behavior
    });
  }

  function nearestIndex() {
    const viewport = element("wheelPickerViewport");
    const options = items();
    if (!viewport || !options.length) return 0;
    const center = viewport.scrollTop + viewport.clientHeight / 2;
    return options.reduce((best, option, index) => {
      const distance = Math.abs(option.offsetTop + option.offsetHeight / 2 - center);
      return distance < best.distance ? { index, distance } : best;
    }, { index: 0, distance: Number.POSITIVE_INFINITY }).index;
  }

  function normalizeRenderedIndex(index) {
    if (!state) return index;
    const optionCount = state.options.length;
    const block = Math.floor(index / optionCount);
    if (block > 1 && block < state.repeatCount - 2) return index;
    const normalized = index + (state.middleBlock - block) * optionCount;
    const viewport = element("wheelPickerViewport");
    if (viewport) viewport.scrollTop += (normalized - index) * ROW_HEIGHT;
    return normalized;
  }

  function renderActive(renderedIndex) {
    const options = items();
    const viewport = element("wheelPickerViewport");
    activeRenderedIndex = Math.max(0, Math.min(renderedIndex, options.length - 1));
    activeIndex = Number(options[activeRenderedIndex]?.dataset.optionIndex || 0);
    options.forEach((option, optionIndex) => {
      const selected = optionIndex === activeRenderedIndex;
      const optionCenter = 100 + optionIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
      const viewportCenter = (viewport?.scrollTop || 0) + (viewport?.clientHeight || 250) / 2;
      const rowOffset = Math.max(-2.5, Math.min(2.5, (optionCenter - viewportCenter) / ROW_HEIGHT));
      const distance = Math.abs(rowOffset);
      const radians = rowOffset * ROW_ANGLE;
      const curvedY = Math.sign(rowOffset) * WHEEL_RADIUS * Math.sin(Math.min(Math.abs(radians), Math.PI / 2));
      const flatY = rowOffset * ROW_HEIGHT;
      option.classList.toggle("is-selected", selected);
      option.setAttribute("aria-selected", String(selected));
      option.style.setProperty("--wheel-opacity", String(Math.max(.16, 1 - distance * .34)));
      option.style.setProperty("--wheel-scale", String(Math.max(.8, 1 - distance * .07)));
      option.style.setProperty("--wheel-angle", `${rowOffset * -32}deg`);
      option.style.setProperty("--wheel-y", `${curvedY - flatY}px`);
      option.style.setProperty("--wheel-depth", `${WHEEL_RADIUS * (Math.cos(Math.min(Math.abs(radians), Math.PI / 2)) - 1)}px`);
    });
    const selected = options[activeRenderedIndex];
    if (selected) viewport?.setAttribute("aria-activedescendant", selected.id);
  }

  function updateFromScroll() {
    cancelAnimationFrame(scrollFrame);
    scrollFrame = requestAnimationFrame(() => renderActive(nearestIndex()));
    clearTimeout(settleTimer);
    settleTimer = window.setTimeout(() => {
      if (pointer) return;
      const renderedIndex = normalizeRenderedIndex(nearestIndex());
      renderActive(renderedIndex);
      scrollToIndex(renderedIndex);
    }, 120);
  }

  function close({ restoreFocus = true } = {}) {
    const modal = element("wheelPickerModal");
    if (!modal?.classList.contains("show")) return;
    const trigger = state?.trigger;
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("wheel-picker-open");
    state = null;
    pointer = null;
    clearTimeout(settleTimer);
    if (restoreFocus) trigger?.focus?.();
  }

  function open({ title, options, value, confirmLabel, trigger, onConfirm }) {
    const modal = element("wheelPickerModal");
    const list = element("wheelPickerList");
    if (!modal || !list || !Array.isArray(options) || !options.length) return;
    let repeatCount = Math.max(9, Math.ceil(80 / options.length));
    if (repeatCount % 2 === 0) repeatCount += 1;
    const middleBlock = (repeatCount - 1) / 2;
    state = { title, options, value, trigger: trigger || document.activeElement, onConfirm, repeatCount, middleBlock };
    element("wheelPickerTitle").textContent = title;
    element("wheelPickerConfirm").textContent = confirmLabel || window.PulsI18n.t("picker.apply");
    const repeatedOptions = Array.from({ length: repeatCount }, (_, block) => (
      options.map((option, optionIndex) => ({ option, optionIndex, renderedIndex: block * options.length + optionIndex }))
    )).flat();
    list.replaceChildren(...repeatedOptions.map(({ option, optionIndex, renderedIndex }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "wheel-picker-option";
      button.id = `wheel-picker-option-${renderedIndex}`;
      button.dataset.value = option.value;
      button.dataset.optionIndex = String(optionIndex);
      button.dataset.suffixFirst = String(Boolean(option.suffixFirst));
      button.setAttribute("role", "option");
      button.textContent = option.label;
      if (option.suffix) {
        const suffix = document.createElement("span");
        suffix.textContent = option.suffix;
        suffix.setAttribute("aria-hidden", "true");
        button.append(suffix);
      }
      button.addEventListener("click", () => {
        renderActive(renderedIndex);
        scrollToIndex(renderedIndex);
      });
      return button;
    }));
    const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
    const selectedRenderedIndex = middleBlock * options.length + selectedIndex;
    renderActive(selectedRenderedIndex);
    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("wheel-picker-open");
    requestAnimationFrame(() => {
      scrollToIndex(selectedRenderedIndex, "auto");
      renderActive(selectedRenderedIndex);
      element("wheelPickerViewport")?.focus({ preventScroll: true });
    });
  }

  async function confirm() {
    if (!state) return;
    const option = state.options[activeIndex];
    const confirmButton = element("wheelPickerConfirm");
    if (!option || !confirmButton || confirmButton.disabled) return;
    confirmButton.disabled = true;
    try {
      await state.onConfirm?.(option.value, option);
      close();
    } catch (error) {
      console.warn("Wheel picker selection was not saved:", error);
    } finally {
      confirmButton.disabled = false;
    }
  }

  function initialize() {
    const viewport = element("wheelPickerViewport");
    const modal = element("wheelPickerModal");
    viewport?.addEventListener("scroll", updateFromScroll, { passive: true });
    viewport?.addEventListener("keydown", (event) => {
      if (!state) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        const targetIndex = activeRenderedIndex + step;
        renderActive(targetIndex);
        scrollToIndex(targetIndex);
      } else if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        const blockStart = Math.floor(activeRenderedIndex / state.options.length) * state.options.length;
        const targetIndex = blockStart + (event.key === "Home" ? 0 : state.options.length - 1);
        renderActive(targetIndex);
        scrollToIndex(targetIndex);
      } else if (event.key === "Enter") {
        event.preventDefault();
        void confirm();
      } else if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    });
    viewport?.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "touch") return;
      pointer = { id: event.pointerId, y: event.clientY, scrollTop: viewport.scrollTop };
      viewport.setPointerCapture(event.pointerId);
      viewport.classList.add("is-dragging");
    });
    viewport?.addEventListener("pointermove", (event) => {
      if (!pointer || pointer.id !== event.pointerId) return;
      viewport.scrollTop = pointer.scrollTop + pointer.y - event.clientY;
    });
    const endDrag = (event) => {
      if (!pointer || pointer.id !== event.pointerId) return;
      pointer = null;
      viewport.classList.remove("is-dragging");
      const renderedIndex = normalizeRenderedIndex(nearestIndex());
      renderActive(renderedIndex);
      scrollToIndex(renderedIndex);
    };
    viewport?.addEventListener("pointerup", endDrag);
    viewport?.addEventListener("pointercancel", endDrag);
    element("wheelPickerClose")?.addEventListener("click", () => close());
    element("wheelPickerConfirm")?.addEventListener("click", () => void confirm());
    modal?.addEventListener("click", (event) => {
      if (event.target === modal) close();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && modal?.classList.contains("show")) {
        event.preventDefault();
        close();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", initialize);
  window.PulsWheelPicker = Object.freeze({ open, close });
})();
