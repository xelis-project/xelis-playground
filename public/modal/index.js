function load_modals() {
  const modals = document.querySelectorAll(`.modal`);
  modals.forEach((modal) => {
    modal.addEventListener("click", (e) => {
      if (e.target.classList.contains("modal-backdrop")) {
        modal.classList.add("hidden");
      }
    });
  });
}

load_modals();

export function open_modal(element) {
  element.classList.remove("hidden");
}
