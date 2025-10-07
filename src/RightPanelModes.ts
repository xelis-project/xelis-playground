

export class RightPanelModes {
    public btn_mode_contract: HTMLElement;
    public btn_mode_documentation: HTMLElement;

    constructor() {

        this.btn_mode_contract = document.getElementById('btn_mode_contract') as HTMLElement;
        this.btn_mode_documentation = document.getElementById('btn_mode_documentation') as HTMLElement;


        // TODO: generalize the following in case more modes are added

        this.btn_mode_contract.addEventListener('click', () => {
            if(this.btn_mode_contract.hasAttribute("disabled")) {
                return;
            }

            this.contract_mode();

        });

        this.btn_mode_documentation.addEventListener('click', () => {
            if(this.btn_mode_documentation.hasAttribute("disabled")) {
                return;
            }

            const contract_mode = document.getElementById("contract_container") as HTMLInputElement;
            const documentation_mode = document.getElementById("documentation_container") as HTMLInputElement;
            const r_mode_title = document.getElementById("r_mode_title") as HTMLElement;
            r_mode_title.textContent = "Library";

            contract_mode.style.display = "none";
            documentation_mode.style.display = "block";

            this.btn_mode_contract.removeAttribute("disabled");
            this.btn_mode_documentation.setAttribute("disabled", "");
        });
    }

    public contract_mode() {
        const contract_mode = document.getElementById("contract_container") as HTMLElement;
        const documentation_mode = document.getElementById("documentation_container") as HTMLElement;
        const r_mode_title = document.getElementById("r_mode_title") as HTMLElement;
        r_mode_title.textContent = "Contract";

        contract_mode.style.display = "block";
        documentation_mode.style.display = "none";

        this.btn_mode_documentation.removeAttribute("disabled");
        this.btn_mode_contract.setAttribute("disabled", "");
    }

}
