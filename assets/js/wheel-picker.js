(function () {
  "use strict";

  let state = null;
  let activeIndex = 0;
  let scrollFrame = 0;
  let settleTimer = 0;
  let wheelTimer = 0;
  let wheelAccumulator = 0;
  let wheelDirection = 0;
  let wheelLocked = false;
  let pointer = null;

  const ROW_HEIGHT = 50;
  const WHEEL_RADIUS = 155;
  const ROW_ANGLE = Math.PI / 10.5;

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

  function renderActive(index) {
    const options = items();
    const viewport = element("wheelPickerViewport");
    activeIndex = Math.max(0, Math.min(index, options.length - 1));
    options.forEach((option, optionIndex) => {
      const selected = optionIndex === activeIndex;
      const optionCenter = 100 + optionIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
      const viewportCenter = (viewport?.scrollTop || 0) + (viewport?.clientHeight || 250) / 2;
      const rowOffset = Math.max(-2.5, Math.min(2.5, (optionCenter - viewportCenter) / ROW_HEIGHT));
      const distance = Math.abs(rowOffset);
      const radians = rowOffset * ROW_ANGLE;
      const curvedY = Math.sign(rowOffset) * WHEEL_RADIUS * Math.sin(Math.min(Math.abs(radians), Math.PI / 2));
      const flatY = rowOffset * ROW_HEIGHT;
      option.classList.toggle("is-selected", selected);
      option.setAttribute("aria-selected", String(selected));
      option.style.setProperty("--wheel-opacity", String(Math.max(.4, 1 - distance * .24)));
      option.style.setProperty("--wheel-scale", String(Math.max(.9, 1 - distance * .035)));
      option.style.setProperty("--wheel-angle", `${rowOffset * -18}deg`);
      option.style.setProperty("--wheel-y", `${curvedY - flatY}px`);
      option.style.setProperty("--wheel-depth", `${WHEEL_RADIUS * (Math.cos(Math.min(Math.abs(radians), Math.PI / 2)) - 1)}px`);
    });
    const selected = options[activeIndex];
    if (selected) viewport?.setAttribute("aria-activedescendant", selected.id);
  }

  function updateFromScroll() {
    cancelAnimationFrame(scrollFrame);
    scrollFrame = requestAnimationFrame(() => renderActive(nearestIndex()));
    clearTimeout(settleTimer);
    settleTimer = window.setTimeout(() => {
      if (pointer) return;
      const index = nearestIndex();
      renderActive(index);
      scrollToIndex(index);
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
    clearTimeout(wheelTimer);
    wheelAccumulator = 0;
    wheelDirection = 0;
    wheelLocked = false;
    if (restoreFocus) trigger?.focus?.();
  }

  function open({ title, options, value, confirmLabel, trigger, onConfirm }) {
    const modal = element("wheelPickerModal");
    const list = element("wheelPickerList");
    if (!modal || !list || !Array.isArray(options) || !options.length) return;
    state = { title, options, value, trigger: trigger || document.activeElement, onConfirm };
    element("wheelPickerTitle").textContent = title;
    element("wheelPickerConfirm").textContent = confirmLabel || window.PulsI18n.t("picker.apply");
    list.replaceChildren(...options.map((option, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "wheel-picker-option";
      button.id = `wheel-picker-option-${index}`;
      button.dataset.value = option.value;
      button.dataset.suffixFirst = String(Boolean(option.suffixFirst));
      button.setAttribute("role", "option");
      if (option.prefixImage) {
        button.classList.add("has-prefix-image");
        const image = document.createElement("img");
        image.className = "wheel-picker-flag";
        image.src = option.prefixImage;
        image.alt = "";
        const label = document.createElement("span");
        label.className = "wheel-picker-label";
        label.textContent = option.label;
        button.append(image, label);
      } else {
        button.textContent = option.label;
      }
      if (!option.prefixImage && option.suffix) {
        const suffix = document.createElement("span");
        suffix.textContent = option.suffix;
        suffix.setAttribute("aria-hidden", "true");
        button.append(suffix);
      }
      button.addEventListener("click", () => {
        renderActive(index);
        scrollToIndex(index);
      });
      return button;
    }));
    const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
    renderActive(selectedIndex);
    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("wheel-picker-open");
    requestAnimationFrame(() => {
      scrollToIndex(selectedIndex, "auto");
      renderActive(selectedIndex);
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
        const targetIndex = Math.max(0, Math.min(activeIndex + step, state.options.length - 1));
        renderActive(targetIndex);
        scrollToIndex(targetIndex);
      } else if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        const targetIndex = event.key === "Home" ? 0 : state.options.length - 1;
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
    viewport?.addEventListener("wheel", (event) => {
      if (!state || event.deltaY === 0) return;
      event.preventDefault();
      const unit = event.deltaMode === 1
        ? 16
        : event.deltaMode === 2
          ? viewport.clientHeight
          : 1;
      const delta = event.deltaY * unit;
      const direction = Math.sign(delta);
      if (direction !== wheelDirection) wheelAccumulator = 0;
      wheelDirection = direction;
      wheelAccumulator += delta;
      clearTimeout(wheelTimer);
      wheelTimer = window.setTimeout(() => {
        wheelAccumulator = 0;
        wheelDirection = 0;
        wheelLocked = false;
      }, 90);
      if (wheelLocked || Math.abs(wheelAccumulator) < 12) return;
      wheelLocked = true;
      wheelAccumulator = 0;
      const targetIndex = Math.max(0, Math.min(activeIndex + direction, state.options.length - 1));
      renderActive(targetIndex);
      scrollToIndex(targetIndex);
    }, { passive: false });
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
      const index = nearestIndex();
      renderActive(index);
      scrollToIndex(index);
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
