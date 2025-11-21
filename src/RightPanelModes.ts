

export class RightPanelModes {
    public btn_mode_contract: HTMLElement;
    public btn_mode_documentation: HTMLElement;
    public btn_mode_rpcinspector: HTMLElement;

    public contract_mode_container = document.getElementById("contract_container") as HTMLElement;
    public documentation_mode_container = document.getElementById("documentation_container") as HTMLElement;
    public rpcinspector_mode_container = document.getElementById("rpcinspector_container") as HTMLElement;
    public r_mode_title = document.getElementById("r_mode_title") as HTMLElement;

    constructor() {

        const _thisRightPanelMode = this;

        this.btn_mode_contract = document.getElementById('btn_mode_contract') as HTMLElement;
        this.btn_mode_documentation = document.getElementById('btn_mode_documentation') as HTMLElement;
        this.btn_mode_rpcinspector = document.getElementById('btn_mode_rpcinspector') as HTMLElement;

        const mode_objects = [
            {
                btn: this.btn_mode_contract,
                container: this.contract_mode_container,
                name: "Contract"
            },
            {
                btn: this.btn_mode_documentation,
                container: this.documentation_mode_container,
                name: "Documentation"
            },
            {
                btn: this.btn_mode_rpcinspector,
                container: this.rpcinspector_mode_container,
                name: "RPC Inspector"
            }
        ];

        mode_objects.forEach(mode => {
            mode.btn.addEventListener('click', () => {
                if(mode.btn.hasAttribute("disabled")) {
                    return;
                }

                _thisRightPanelMode.r_mode_title.textContent = mode.name;
                mode.container.classList.add("rpm-show");
                mode.container.classList.remove("rpm-hide");
                mode.btn.setAttribute("disabled", "");

                 for(let i = 0; i < mode_objects.length; i++) {
                     if(mode_objects[i].name !== mode.name) {
                         mode_objects[i].container.classList.remove("rpm-show");
                         mode_objects[i].container.classList.add("rpm-hide");
                         mode_objects[i].btn.removeAttribute("disabled");
                     }
                 }
            });
        });
    }
}
