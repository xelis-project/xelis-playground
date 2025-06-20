export class Modal {
    constructor() {
        const modals = document.querySelectorAll(`.modal`);
        modals.forEach((modal) => {
            modal.addEventListener("click", (e) => {
                const target = e.target as HTMLElement;
                if (target.classList.contains("modal-backdrop")) {
                    modal.classList.add("hidden");
                }
            });
        });
    }

    open(element: HTMLElement) {
        element.classList.remove("hidden");
    }
}