(function () {
  "use strict";

  let state = null;
  let activeIndex = 0;
  let scrollFrame = 0;
  let pointer = null;

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
      const optionCenter = option.offsetTop + option.offsetHeight / 2;
      const viewportCenter = (viewport?.scrollTop || 0) + (viewport?.clientHeight || 250) / 2;
      const rowOffset = Math.max(-2, Math.min(2, (optionCenter - viewportCenter) / 50));
      const distance = Math.abs(rowOffset);
      option.classList.toggle("is-selected", selected);
      option.setAttribute("aria-selected", String(selected));
      option.style.setProperty("--wheel-opacity", String(Math.max(.34, 1 - distance * .28)));
      option.style.setProperty("--wheel-scale", String(1 - distance * .055));
      option.style.setProperty("--wheel-angle", `${rowOffset * -12}deg`);
    });
    const selected = options[activeIndex];
    if (selected) viewport?.setAttribute("aria-activedescendant", selected.id);
  }

  function updateFromScroll() {
    cancelAnimationFrame(scrollFrame);
    scrollFrame = requestAnimationFrame(() => renderActive(nearestIndex()));
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
      button.setAttribute("role", "option");
      button.textContent = option.label;
      if (option.suffix) {
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
        renderActive(activeIndex + step);
        scrollToIndex(activeIndex);
      } else if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        renderActive(event.key === "Home" ? 0 : state.options.length - 1);
        scrollToIndex(activeIndex);
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
      renderActive(nearestIndex());
      scrollToIndex(activeIndex);
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
