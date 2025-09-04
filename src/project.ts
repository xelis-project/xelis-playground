import {uuidv7} from 'uuidv7';
import {zipSync, strToU8, zip} from 'fflate';
import {PanelOptions, UIContainers} from "./UIContainers";

type ProjectUUID = string;
type ProjectName = string;
type ProjectsRecord = Record<ProjectUUID, Project>;
type FileMetaUUID = string;
type FileName = string;
// the key cannot be the UUID. We need to overwrite files with the same name.
type FilesMetaRecord = Record<FileName, FileMetaData>;

/* NormalState: normal project, directory or file.*/
const NormalState = "normal";
/* PhantomState: A project that has been deleted from the file system but still exists in the database */
const PhantomState = "phantom";
/* OrphanState: A directory that has been deleted from the file system but still exists in the database */
const OrphanState = "orphan";

/* ProjectState */
type ProjectState = typeof NormalState | typeof PhantomState;
type DirectoryState = typeof NormalState | typeof OrphanState;

export class FileMetaData {
    uuid: string = uuidv7();
    name: string =  "";
    path: string = "";
    created: Date = new Date();
    modified: Date = new Date();

    constructor(name: FileName) {
        this.name = name;
    }
}

interface BasicObject {
    [key: string]: string | object;
}

interface NotificationObject {
    [key: string]: any; // Allows any string key to have a value of any type
}

export class PMConfig {
    static PROJECTS_ROOT_DIR = "projects";
    static DB_OBJECT_PROJECTS = "projects";
    static DB_VERSION: number = 37;
    static DEFAULT_PROJECT = "Examples";
    static DB_NAME = "silex_studio";
    static MANAGER_APP_NAME = "Silex Studio";
}

export class Project {
    uuid: ProjectUUID = uuidv7();
    name: ProjectName = "";
    description: string;
    created: Date;
    modified: Date;

    state: ProjectState = "normal";

    files: FilesMetaRecord = {};
    current_file: FileMetaData | null = null;
    last_used_file_metadata: FileMetaData | null = null;
    // the last used file contents will be periodically refreshed from OPFS
    // TODO: dedicated worker?
    last_used_file_contents: string = "";
    database: IDBDatabase | null = null;
    constructor(name: ProjectName) {
        this.name = name;
        this.description = "";
        this.created = new Date();
        this.modified = new Date();
    }
}


export class ProjectManager {
    projects: ProjectsRecord = {};
    #current_project: Project | null = null;

    btn_new_project: HTMLElement;
    worker_opfs: Worker;
    worker_last_file_used_poll: Worker;
    show_phantoms = false;
    show_orphans = false;
    
    buffer_needs_saving = ()=> {return false;};

    static init_projects_db() {
        const silex_studio_db_request = window.indexedDB.open(PMConfig.DB_NAME, PMConfig.DB_VERSION);

        let is_upgrade = false;
        silex_studio_db_request.onupgradeneeded = (event) => {
            console.log(`${PMConfig.DB_NAME} upgradeneeded`);
            console.log(`${PMConfig.DB_NAME} database: upgrading.`);

            // Save the IDBDatabase interface
            const db = silex_studio_db_request.result;

            if(!db.objectStoreNames.contains(PMConfig.DB_OBJECT_PROJECTS)){
                console.log(`UPGRADING: Creating the ${PMConfig.DB_OBJECT_PROJECTS} object store.`);
                const objectStore = db.createObjectStore(PMConfig.DB_OBJECT_PROJECTS, {autoIncrement: true });
                objectStore.createIndex("uuid", "uuid", { unique: true });

                objectStore.transaction.oncomplete = (event) => {
                    // Store values in the newly created objectStore.
                    const assetsObjectStore = db
                        .transaction(PMConfig.DB_OBJECT_PROJECTS, "readwrite")
                        .objectStore(PMConfig.DB_OBJECT_PROJECTS);
                };
            } else {
                console.log(`UPGRADING: Found the ${PMConfig.DB_OBJECT_PROJECTS} object store.`);
                is_upgrade = true;
            }
        };

        silex_studio_db_request.onerror = (event) => {
            console.error(`Can't open the ${PMConfig.DB_NAME} database: ${silex_studio_db_request.error?.message}`);
        }

        silex_studio_db_request.onsuccess = (_) => {
            const db = silex_studio_db_request.result;

            if(is_upgrade) {
                // Pull the projects and update the instances with the upgraded class if necessary
                // write back to indexdb

                const objectStore = db.transaction(PMConfig.DB_OBJECT_PROJECTS).objectStore(PMConfig.DB_OBJECT_PROJECTS);

                objectStore.getAll().onsuccess = (event ) => {
                    console.log("UPGRADING: Getting all projects.");
                    const et = event.target as IDBRequest<[Project]>;
                    const projects = et.result;

                    for (const project of projects) {

                        type ObjectKey = keyof Project;

                        let upgraded_project = new Project(project.name);
                        console.log(upgraded_project);
                        let did_upgrade_project = false;

                        for (const [up_key, up_value] of Object.entries(upgraded_project as Project)) {
                            if(project[up_key as ObjectKey] === undefined) {
                                console.log(`${project.name} is missing "${up_key}"`);
                                // Example of upgrading a project
                                switch (up_key.toString()) {
                                    case "last_used_file_metadata":
                                        // @ts-ignore
                                        project[up_key as ObjectKey] = project.current_file;
                                        did_upgrade_project = true;
                                        break;
                                    case "last_used_file_contents":
                                        // @ts-ignore
                                        project[up_key as ObjectKey] = "";
                                        did_upgrade_project = true;
                                        break;
                                    case "state":
                                        // @ts-ignore
                                        project[up_key as ObjectKey] = up_value;
                                        did_upgrade_project = true;
                                        break;
                                    default:
                                        break;
                                }
                            }

                            // key removal
                            ["current_file"].forEach(key => {
                                // @ts-ignore
                                if(project[key] !== undefined) {
                                    // @ts-ignore
                                    delete project[key];
                                    did_upgrade_project = true;
                                }
                            });
                        }

                        if(did_upgrade_project) {
                            console.log(project);
                            ProjectManager.save_project_metadata(project);
                        }
                    }
                };
            }

            console.log(`IndexDB: ${PMConfig.DB_OBJECT_PROJECTS} object store ready.`);

        }
    }
    
    static save_project_metadata(project: Project) {
        const silex_studio = "Silex Studio";
        const silex_studio_db_request = window.indexedDB.open(PMConfig.DB_NAME, PMConfig.DB_VERSION
        );

        silex_studio_db_request.onerror = (event) => {
            console.error(`Can't open the ${silex_studio} database: ${silex_studio_db_request.error?.message}`);
        }

        silex_studio_db_request.onsuccess = (event) => {
            const proj_refs_db: IDBDatabase = silex_studio_db_request.result;
            const objectStore = proj_refs_db.transaction(PMConfig.DB_OBJECT_PROJECTS, "readwrite").objectStore(PMConfig.DB_OBJECT_PROJECTS);
            // update
            objectStore.put(project, project.uuid);
            console.log(`Project ${project.name} updated.`);
        }
    }

    static delete_project_metadata(project: Project) {
        const silex_studio = "Silex Studio";
        const silex_studio_db_request = window.indexedDB.open(PMConfig.DB_NAME, PMConfig.DB_VERSION
        );

        silex_studio_db_request.onerror = (event) => {
            console.error(`Can't open the ${silex_studio} database: ${silex_studio_db_request.error?.message}`);
        }

        silex_studio_db_request.onsuccess = (event) => {
            const proj_refs_db: IDBDatabase = silex_studio_db_request.result;
            const objectStore = proj_refs_db.transaction(PMConfig.DB_OBJECT_PROJECTS, "readwrite").objectStore(PMConfig.DB_OBJECT_PROJECTS);
            // update
            objectStore.delete( project.uuid);
            console.log(`Project ${project.name} deleted.`);
        }
    }

    /*
    * Check for IndexDB phantoms (IndexDB project data with no OPFS directories and/or files).
    * Can happen if the user deletes the project folder in OPFS, but not from IndexDB.
    */
    static fs_check_phantoms(opfs_projects_dirs: string[]) {

        const silex_studio_db_request = window.indexedDB.open(PMConfig.DB_NAME);

        silex_studio_db_request.onerror = (event) => {
            console.error(`Can't open the ${PMConfig.DB_NAME} database: ${silex_studio_db_request.error?.message}`);
        }

        let phantom_projects: Project[] = [];
        silex_studio_db_request.onsuccess = (event) => {
            const proj_refs_db: IDBDatabase = silex_studio_db_request.result;
            const objectStore = proj_refs_db.transaction(PMConfig.DB_OBJECT_PROJECTS).objectStore(PMConfig.DB_OBJECT_PROJECTS);
            objectStore.getAll().onsuccess = (event) => {
                const et = event.target as IDBRequest<[Project]>;
                const projects = et.result;
                for (const project of projects) {
                    for (let i = 0; i < opfs_projects_dirs.length; ++i) {
                        if(project.name === opfs_projects_dirs[i]) {
                            if(project.state !== NormalState) { // the only possible states are normal and phantom - for now.
                                console.log(`Project ${project.name} is in state ${project.state}, but exists in OPFS. Updating state to normal.`);
                                project.state = NormalState;
                                ProjectManager.save_project_metadata(project);
                            }
                            return;
                        }
                    }

                    if(project.state !== PhantomState) {
                        // not located in opfs
                        console.log(`${project.name} is not in OPFS. The state is  ${project.state}.  Marking this project as a phantom project.`);
                        project.state = PhantomState;
                        ProjectManager.save_project_metadata(project);
                        console.log(`${project.name} is a ${PhantomState} project.}`);
                    } else {
                        console.log(`${project.name} is a ${PhantomState} project.`);
                    }
                    phantom_projects.push(project);
                }
            };
        }
        return phantom_projects;
    }

    constructor() {
        const _thisPM = this;

        ProjectManager.init_projects_db();

        this.projects = {};
        this.worker_opfs = new Worker(new URL("./workers/project_management/opfs_worker.js", import.meta.url));
        this.worker_last_file_used_poll = new Worker(new URL("./workers/project_management/last_used_poll_worker.js", import.meta.url));

        this.btn_new_project = document.querySelector(`#btn_editor_new_project`) as HTMLElement;

        this.worker_opfs.onmessage = (e) => {
            console.log("Message received from OPFS_worker:");
            const message = e.data;
            switch(message.notice) {
                case "verify_default_project_dir_file":
                    //console.log("verify_default_project_dir_file");
                    //console.log(message.data.verify);
                    _thisPM.emit_notification("default-project-post-check", message.data.verify);
                    break;

                case "verify_user_project_dir_file":
                    //console.log("verify_default_project_dir_file");
                    //console.log(message.data.verify);
                    _thisPM.emit_notification("user-post-check", message.data.verify);
                    break;

                case "file_loaded":
                    console.log("file_loaded");
                    const notification = {
                        project: message.data.project,
                        filename: message.data.filename,
                        file_data: message.data.file_data,
                    }

                    this.emit_notification("file_loaded", notification);
                    break;

                case "list_all_project_directories_result":
                    const orphans = this.fs_check_orphans(message.data.project_dirs);
                    const phantoms = ProjectManager.fs_check_phantoms(message.data.project_dirs);
                    // console.log("list_all_project_directories_result");
                    if(Object.entries(orphans).length > 0) {
                        Object.entries(orphans).forEach(([p_name, d_state]) => {
                            if(d_state === OrphanState) {
                                console.log(`Project ${p_name} is an orphan.`);
                            }
                        });
                    }

                    phantoms.forEach(phantom => {
                        console.log(`Project ${phantom.name} is a phantom.`);
                        console.log(phantom);
                    });

                    break;

                case "list_project_dir_result":
                    // TODO: HERE, OR APP LEVEL?
                    // make sure OPFS matches IndexDB metadata.
                    const dir_list_info = message.data.project_dir_list_info;

                    let status: string = dir_list_info.status.toLowerCase();

                    const OPFS_ERROR = "OPFS ERROR: ";
                    if( status === "ok") {
                        console.log(`list_project_dir_result for ${dir_list_info.project_name} OK`);
                        // console.log(dir_list_info.dir_contents);
                    } else if (status === "error") {
                        const error = dir_list_info.error;
                        switch (error.name) {
                            case 'NotAllowedError':
                                console.log(`${OPFS_ERROR}Permission denied to access or create the directory.`);
                                break;
                            case 'TypeError':
                                console.log(`${OPFS_ERROR}Invalid directory name provided.`);
                                break;
                            case 'TypeMismatchError':
                                console.log(`${OPFS_ERROR}An entry named "${dir_list_info.project_name}" already exists but is a file, not a directory.`);
                                break;
                            case 'NotFoundError':
                                console.log(`${OPFS_ERROR}Project directory "${dir_list_info.project_name}" was not found or does not exist.`);
                                break;
                            default:
                                console.log(`${OPFS_ERROR}An unexpected error occurred:`, error);
                                break;
                        }
                    } else {
                        console.log(`${OPFS_ERROR}Unknown OPFS list_project_dir_result status: ${dir_list_info.status}`);
                    }
                    break;
                case "delete_project_result":
                    console.log("project deleted");
                    const delete_notification = {
                        project: message.data.project_name,
                        status: message.data.status,
                        message: message.data.message,
                    }

                    this.emit_notification("project deleted", delete_notification);
                    break;
                case "file_saved_result":
                    if(message.data.should_notify) {
                        // just a small delay to allow the file to be written to disk.
                        this.last_used_file_refresh(500);
                    }
                    break;
                default:
                    console.log(message);
                    break;
            }
        };

        this.worker_opfs.onerror = (e) => {
            console.error(e);
        }

        this.worker_last_file_used_poll.onmessage = (e) => {
            //console.log("Message received from worker_last_file_used_poll:");
            const message = e.data;
           // console.log(message);
            switch(message.notice) {
                case "file_polling_started":
                    // console.log("File polling started.");
                    break;
                case "get_current_project":
                    this.worker_last_file_used_poll.postMessage({command: "poll_with_current_project", cmd_opts: {project: this.get_current_project()}});
                    break;

                case "last_file_refreshed":
                    const m_project = message.data.project as Project;

                    if(m_project === undefined || m_project === null) {
                        console.log("Bizarre. cant update last file data. no project.");
                        return;
                    }

                    if(m_project.last_used_file_metadata?.uuid === this.#current_project?.last_used_file_metadata?.uuid) {
                        localStorage.setItem('last_file_used_data', message.data.last_file_data);
                        this.emit_notification("project-last-file-refresh");
                    }

                    break;

                default:
                    console.log(message);
                    break;
            }
        }

        this.worker_last_file_used_poll.onerror = (e) => {
            console.error(e);
        }

        this.btn_new_project.addEventListener("click", _ => {
            this.btn_new_project.classList.add("selected");
            this.ui_new_project();
        });


        // The only way to open the main project container panel
        // @ts-ignore
        document.addEventListener("project-container-external-open", this.project_panel_open_handler.bind(null, _thisPM), {once: true});

        // Load process: Stage 0
        this.load_projects_record();

        document.addEventListener("projects-metadata-loaded", () => {
            // Load process: Stage 1
            // TODO: Temp fix until Examples become the Default Project.
            // make sure the default project is not a phantom.
            let found_default = false;
            Object.entries(this.projects).forEach(([uuid, project]) => {
                if(project.name === PMConfig.DEFAULT_PROJECT) {
                    found_default = true;
                    // TODO: When the default becomes Example, just load the Example project.
                    // Make sure the default project is not a phantom.;
                    _thisPM.worker_opfs.postMessage({command: "verify_project_directory_and_file", cmd_opts: {project: project, file_metadata: project.last_used_file_metadata, notice: "verify_default_project_dir_file"}});
                }
            });

            if(!found_default) {
                console.log("Creating default project.");
                //TODO Examples - make it readonly
                _thisPM.create_new_project(PMConfig.DEFAULT_PROJECT, "");
                this.init_user_project();
                _thisPM.worker_last_file_used_poll.postMessage({command: "start_polling", cmd_opts: {seconds: 60}});
            }
        });

        document.addEventListener("default-project-post-check", (event) => {
            // Load process: Stage 2
            const e = event as CustomEvent;
            console.log(e.detail);
            const project_verify = e.detail.project;
            const project = project_verify.project as Project;

            // get current project from localstorage
            const ls_project_json = localStorage.getItem('current_project');
            let ls_project: Project | null = null;
            if(ls_project_json !== null) {
                ls_project = JSON.parse(ls_project_json) as Project;
            }

            if(!project_verify.is_valid) {
                // create default project in opfs
                // TODO - Call create Examples project
                this.worker_opfs.postMessage({command: "new_project", cmd_opts: {project_name: PMConfig.DEFAULT_PROJECT }});

                if(ls_project !== null && ls_project.name === PMConfig.DEFAULT_PROJECT) {
                    localStorage.removeItem('current_project');
                }
            }

            if(!e.detail.file.is_valid) {
                if(ls_project !== null && ls_project.name === PMConfig.DEFAULT_PROJECT) {

                    Object.entries(project.files).forEach(([filename, fmd]) => {
                        if(filename === e.detail.file.filename) {
                            if(project.last_used_file_metadata !== null && project.last_used_file_metadata.uuid === fmd.uuid) {
                                project.last_used_file_metadata = null;
                            }
                            delete project.files[filename];
                        }
                    });

                    ls_project.last_used_file_metadata = null;
                    project_verify.project.last_used_file_metadata = null;
                    ProjectManager.save_project_metadata(project);
                    localStorage.setItem('current_project', JSON.stringify(project));
                }
            }

            // if(project.state === PhantomState) {
            //     console.log(`Project ${project.name} is a phantom. Changing state to normal.`);
            //     project.state = NormalState;
            //
            //     project.files = {};
            //     project.last_used_file_metadata = null;
            //
            //     ProjectManager.save_project_metadata(project);
            //     localStorage.setItem('current_project', JSON.stringify(project));
            //
            //     console.log(project);
            //     // create project folder in OPFS
            //     this.worker_opfs.postMessage({command: "new_project", cmd_opts: {project_name: PMConfig.DEFAULT_PROJECT }});
            // }

            // This doesn't get called until we verify that the default project is ok in OPFS.
            this.init_user_project();
            //_thisPM.worker_last_file_used_poll.postMessage({command: "start_polling", cmd_opts: {seconds: 60}});
        });

        document.addEventListener("user-post-check", (event) => {
            // Load process: Stage 3
            const e = event as CustomEvent;
            const project_verify = e.detail.project;
            const project = project_verify.project as Project;

            console.log(e.detail);
            console.log(project);

            if(!project_verify.is_valid) {
                console.warn("User Project is not valid. Deleting it.");
                localStorage.removeItem('current_project');
                Object.entries(this.projects).forEach(([uuid, project]) => {
                    if(project.name === PMConfig.DEFAULT_PROJECT) {
                        localStorage.setItem('current_project', JSON.stringify(project));
                        this.set_current_project(project);
                    }
                });
            }

            if(!e.detail.file.is_valid) {
                console.warn(`The last used file ${e.detail.file.filename} is not valid. Removing it from the project metadata.`);
                Object.entries(project.files).forEach(([filename, fmd]) => {
                    console.warn(`checking ${filename} - ${e.detail.file.name}`);

                    if(filename === e.detail.file.name) {
                        if(project.last_used_file_metadata !== null && project.last_used_file_metadata.uuid === fmd.uuid) {
                            project.last_used_file_metadata = null;
                        }
                        console.warn(`deleting file meta for ${e.detail.file.name}`);
                        delete project.files[filename];
                        ProjectManager.save_project_metadata(project);
                        localStorage.setItem('current_project', JSON.stringify(project));
                    }
                });
                project.last_used_file_metadata = null;
            }





            this.set_current_project(project);
        });
    }

    last_used_file_refresh (delay: number = 100){
        const _thisPM = this;
        function sleep(ms: number) {
            function delayed_emit() {
                console.log("delayed notification: file_saved_result");
                _thisPM.worker_last_file_used_poll.postMessage({command: "poll_with_current_project", cmd_opts: {project: _thisPM.get_current_project()}});
            }
            return new Promise(resolve => setTimeout(delayed_emit, ms));
        }

        sleep(delay).then(() => {});
    }

    init_user_project() {
        const _thisPM = this;
        // Chec}k if a user project exists (localstorage or IndexDB)
        // If so, attempt to load it.
        // It may have been deleted from IndexDB.
        // If this fails, load first existing project and TODO: last used file,
        // If no existing projects, create PMConfig.DEFAULT_PROJECT

        const ls_project_json = localStorage.getItem('current_project');
        let ls_project: Project | null = null;

        if(ls_project_json !== null) {
            ls_project = JSON.parse(ls_project_json) as Project;
        }

        if(ls_project !== null) {
            console.log("User Project found in local storage. loading...");

            if(Object.entries(this.projects).length === 0) {
                // this really shouldn't occur, because load_projects_record() would generate the default project
                // if there are no projects.
                // the metadata was deleted. rather than get into the habit of deleting user data, lets restore the metadata
                // first, create default project
                // TODO: check OPFS
                // if(ls_project.name !== PMConfig.DEFAULT_PROJECT) {
                //     this.create_new_project(PMConfig.DEFAULT_PROJECT, "");
                // } else {
                //     console.log("Default project already exists.");
                // }

                localStorage.removeItem('current_project')
                console.warn("User Project found in local storage, but no projects exist in IndexDB. Creating the default project.");
                //ProjectManager.save_project_metadata(ls_project);

            } else {
                // locate the project. if it does not exist, put it back
                const user_project = this.projects[ls_project.uuid];

                console.log(user_project);

                if(user_project === null || user_project === undefined) {
                    ProjectManager.save_project_metadata(ls_project);
                }
            }

            // todo check OPFS - what if the user deleted the files in OPFS??
            _thisPM.worker_opfs.postMessage({command: "verify_project_directory_and_file", cmd_opts: {project: ls_project, file_metadata: ls_project.last_used_file_metadata, notice: "verify_user_project_dir_file"}});
        } else {
            console.log("User Project not found. creating");
            // Ok to ignore any related folders/files in OPFS for now
            if(Object.entries(this.projects).length === 0) {
                // again, as above, shouldn't occur. load_projects_record will create the default project.
                const new_project = this.create_new_project(PMConfig.DEFAULT_PROJECT, "");
                this.set_current_project(new_project);
            } else {
                // find default
                let found_uuid = "";
                Object.entries(this.projects).forEach(([uuid, project]) => {
                    if(found_uuid !== "") {
                        return;
                    }
                    if(project.name === PMConfig.DEFAULT_PROJECT) {
                        found_uuid = project.uuid;
                    }});

                if (found_uuid.length > 0) {
                    localStorage.setItem('current_project', JSON.stringify(this.projects[found_uuid]));
                    this.set_current_project(this.projects[found_uuid]);
                } else {
                    const first_project = Object.entries(this.projects)[0][1];
                    localStorage.setItem('current_project', JSON.stringify(first_project));
                    this.set_current_project(first_project);
                }
            }
        }
    }

    get_current_project(): Project | null {
        return this.#current_project
    }

    set_current_project(project: Project): void {
        this.#current_project = project;

        localStorage.setItem('current_project', JSON.stringify(project));
        this.emit_notification("project-changed");
    }

    load_projects_record(send_events: boolean = true) {
        const silex_studio_db_request = window.indexedDB.open(PMConfig.DB_NAME, PMConfig.DB_VERSION);

        silex_studio_db_request.onerror = (event) => {
            console.error(`Can't open the ${PMConfig.DB_NAME} database: ${silex_studio_db_request.error?.message}`);
        }

        silex_studio_db_request.onsuccess = (event) => {

            const proj_refs_db: IDBDatabase = silex_studio_db_request.result;
            const objectStore = proj_refs_db.transaction(PMConfig.DB_OBJECT_PROJECTS).objectStore(PMConfig.DB_OBJECT_PROJECTS);
            objectStore.getAll().onsuccess = (event) => {
                console.log("Getting all projects.");
                const et = event.target as IDBRequest<[Project]>;
                const projects = et.result;
                for (const project of projects) {
                    if(project.uuid !== undefined) {
                        this.projects[project.uuid] = project;
                    } else {
                        console.log(`${project.name} has a missing uuid`);
                    }
                }

                console.log(`Project references loaded.`);

                if(send_events) {
                    const project_did_change_event = new CustomEvent("projects-metadata-loaded", {
                        detail: {
                            project: this.#current_project,
                        },
                    });
                    document.dispatchEvent(project_did_change_event);
                }
            };
        }
    }

    project_panel_open_handler (pm: ProjectManager, e: Event)  {
        // console.log("project container opened.");
        // remove this event listener. It will be added again when the project container is closed.
        // @ts-ignore
        document.removeEventListener("project-subcontainer-will-open", pm.project_panel_open_handler);
        pm.ui_list_all_projects();
    }

    ui_list_all_projects() {
        const _thisPM = this;
        const ui_lapb_container = UIContainers.get_panel_selection_container('#editor_project_container') as HTMLElement;

        if(ui_lapb_container === null) {
            console.error("Container for rendering project info into not found.");
            return;
        }

        ui_lapb_container.replaceChildren();

        _thisPM.worker_opfs.postMessage({command: "list_all_project_directories", cmd_opts: {}});

        const project_row_handler = (opts: {project: Project}, e: Event)=> {
            ui_lapb_container.replaceChildren();
            _thisPM.ui_project_details(opts.project);
        }

        let event_list: HTMLElement[] = [];

        const subcontainer_open_handler = (e: Event) => {
            console.log("project container - internal container open.");

            // everything in the top level container is invalid.
            // invalidate the project row events
            event_list.forEach(e => {
                // @ts-ignore
                e.removeEventListener("click", project_row_handler);
            });

            ui_lapb_container.replaceChildren();
            //
            document.removeEventListener("project-subcontainer-will-open", subcontainer_open_handler);
            // cannot open the project container externally again. But a sub-container can force it to open.
            document.removeEventListener("project-container-external-open", external_close_handler);
            // The only time reset should be needed is if an opened subcontainer gets closed, and we need to a list of projects again.
            document.addEventListener("project-container-reset", project_reset_handler.bind(null), {once: true});

        }

        function render_project_rows() {
            event_list = [];

            const data_table_container = document.createElement('div');
            data_table_container.classList.add("data-table-container", "scrollable");
            data_table_container.id = "projects-table-container";

            let data_table = document.createElement("table");
            data_table.setAttribute("rel", "projects");
            data_table.classList.add("data-table");

            const dt_head = document.createElement("thead");
            dt_head.innerHTML = "<tr><th>Name</th><th>Description</th><th>Created</th><th>Files</th></tr>";

            const dt_body = document.createElement("tbody");
            dt_body.id = "projects-body";

            Object.entries(_thisPM.projects).forEach(([uuid, project]) => {
                const dt_tr = document.createElement("tr");
                dt_tr.setAttribute("data-uuid", project.uuid);
                dt_tr.classList.add("project-row");
                dt_tr.addEventListener("click", project_row_handler.bind(null, {project}), {once: true});
                event_list.push(dt_tr);

                [project.name,
                    project.description,
                    new Date(project.created).toLocaleDateString(),
                    Object.entries(project.files).length].forEach(opt => {

                    const td = document.createElement("td");

                    td.textContent = opt.toString();
                    dt_tr.appendChild(td);
                });

                dt_body.appendChild(dt_tr);
            });

            data_table.appendChild(dt_head);
            data_table.appendChild(dt_body);

            const dt_foot = document.createElement("tfoot");
            dt_foot.innerHTML = `<tr><td colspan="4"><span class="data-count">${Object.entries(_thisPM.projects).length}</span> projects </td></tr>`;

            data_table.appendChild(dt_foot);

            data_table_container.appendChild(data_table);
            ui_lapb_container.appendChild(data_table_container);

            document.addEventListener("project-subcontainer-will-open", subcontainer_open_handler, {once: true});
        }

        render_project_rows();

        const external_close_handler = (e: Event) => {
            // we don't know what state the project container is in.
            // simple solution would be to dispatch a project internal close event and let the internal clean it up
            console.log(e.type.toString());
            // then assume event_list has items.
            event_list.forEach(e => {
                // @ts-ignore
                e.removeEventListener("click", project_row_handler);
            });

            // clean up other buttons. "new project" is on the top level. TODO: Leave or implement here?

            ui_lapb_container.replaceChildren();
            document.removeEventListener("project-subcontainer-will-open", subcontainer_open_handler);
            document.removeEventListener("project-container-external-close", external_close_handler);
            document.removeEventListener("project-container-should-open", external_close_handler);
            document.removeEventListener("project-container-should-close", external_close_handler);

            // The only way to open the main project container panel
            document.addEventListener("project-container-external-open", this.project_panel_open_handler.bind(null, _thisPM), {once: true});

            // hide the panel
            UIContainers.panel_close(UIContainers.panel_options({data_panel_id: "editor_project_container"} as PanelOptions));

            console.log("project window closed.");

        }

        const project_reset_handler = (e: Event) => {

            console.log("project container - reset. HANDLING");

            console.log(e.type.toString());
            // then assume event_list has items.
            event_list.forEach(e => {
                // @ts-ignore
                e.removeEventListener("click", project_row_handler);
            });

            ui_lapb_container.replaceChildren();

            // replace the project rows
            render_project_rows();

            console.log("project window reset");

        }

        document.addEventListener("project-container-external-close", external_close_handler, {once: true});

        // sent from a closing internal project container.
        document.addEventListener("project-container-should-close", external_close_handler, {once: true});


        UIContainers.panel_open(UIContainers.panel_options({data_panel_id: "editor_project_container"} as PanelOptions));
        _thisPM.ui_enable_project_buttons();
    }

    ui_save_code_to_project(save_opts: PanelOptions) {

        const ui_scb_container = UIContainers.get_panel_selection_container('#editor_save_code_container') as HTMLElement;

        if(ui_scb_container === null) {
            console.error("Container for rendering save code dialog not found.");
            return;
        }

        ui_scb_container.replaceChildren();

        const dialog_container = document.createElement('div');
        dialog_container.classList.add("dialog-container", "layout-tight");

        const dialog_title = document.createElement('div');
        dialog_title.classList.add("dialog-title");
        dialog_title.textContent = "Save Code to Project";

        dialog_container.appendChild(dialog_title);

        const project_name_input = UIContainers.make_input_component("Project Name", "input");
        project_name_input.input.required = true;
        project_name_input.input.disabled = true;
        project_name_input.input.setAttribute("placeholder", project_name_input.input.getAttribute("placeholder") + " (required)");
        project_name_input.container.classList.add( "vertical");

        const filename_input = UIContainers.make_input_component("File Name", "input");
        filename_input.container.classList.add( "vertical");
        filename_input.input.required = true;
        filename_input.input.value = this.get_current_project()?.last_used_file_metadata?.name ?? "";

        dialog_container.appendChild(project_name_input.container);
        dialog_container.appendChild(filename_input.container);

        const ok_cancel_container = document.createElement('div');
        ok_cancel_container.classList.add("dialog-btn-container", "right");

        const btn_save = document.createElement('button');
        btn_save.classList.add("dialog-btn", "btn");
        btn_save.textContent = "Save";
        if(filename_input.input.value.length === 0) {
            btn_save.setAttribute("disabled", "");
        }

        btn_save.addEventListener("click", _ => {
            //currently only supporting current project.
            this.save_code_to_project(<Project>this.get_current_project(), filename_input.input.value, <string>localStorage.getItem("code"), true);
            localStorage.setItem('current_project', JSON.stringify(<Project>this.get_current_project()));
            UIContainers.panel_close(UIContainers.panel_options(save_opts as PanelOptions));
        }, {once: true});

        const btn_cancel = document.createElement('button');
        btn_cancel.classList.add("dialog-btn", "btn");
        btn_cancel.textContent = "Cancel";
        btn_cancel.addEventListener("click", _ => {
            UIContainers.panel_close(UIContainers.panel_options(save_opts as PanelOptions));
            btn_cancel.removeEventListener("click", _ => {});
            ui_scb_container.replaceChildren();
        }, {once: true});

        ok_cancel_container.appendChild(btn_cancel);
        ok_cancel_container.appendChild(btn_save);

        dialog_container.appendChild(ok_cancel_container);

        // TODO: Replace project name input with dropdown menu
        project_name_input.input.value = <string>this.get_current_project()?.name;

        filename_input.input.addEventListener("input", e => {
            if(filename_input.input.value.length > 0 && project_name_input.input.value.length > 0) {
                btn_save.removeAttribute("disabled");
            } else {
                btn_save.setAttribute("disabled", "");
            }
        });

        ui_scb_container.appendChild(dialog_container);

        this.ui_disable_project_buttons();
    }

    save_code_to_project(project: Project, filename: string, content: string, should_notify = true) {
        // if should notify, then the saved file will be polled for changes immediately.
        // this allows the ui show that the editor and the file are in sync.
        // see the "file_saved_result" notification and handling."
        // For now, the current project
        // TODO: allow for project change (based on menu dropdown)

        // add file to project
        let filemeta = this.projects[project.uuid].files[filename] || new FileMetaData(filename);
        filemeta.modified = new Date();

        project.files[filename] = filemeta;
        this.projects[project.uuid] = project;
        ProjectManager.save_project_metadata(project);
        // save file in folder in OPFS
        this.worker_opfs.postMessage({command: "save_file_to_project", cmd_opts: {project: project, filename: filename, content: content, should_notify: should_notify}});
        project.last_used_file_metadata = filemeta;

        //console.log(`Saving ${filename} to ${project.name}`);
    }

    ui_new_project() {
        const _thisPM = this;

        document.dispatchEvent(new CustomEvent("project-subcontainer-will-open", {
            detail: {
                container: "project-details",
            },
        }));

        const ui_npb_container = UIContainers.get_panel_selection_container('#editor_project_container') as HTMLElement;

        if(ui_npb_container === null) {
            console.error("Container for rendering project info into not found.");
            return;
        }

        ui_npb_container.replaceChildren();

        const dialog_container = document.createElement('div');
        dialog_container.classList.add("dialog-container", "layout-tight");

        const close_btn = document.createElement('button');
        close_btn.classList.add("dialog-btn", "opt-btn", "icon-green", "close-btn", "top-right");
        close_btn.textContent = "X";
        close_btn.addEventListener("click", cancel_handler, {once: true});
        dialog_container.appendChild(close_btn);
        dialog_container.appendChild(close_btn);

        const dialog_title = document.createElement('div');
        dialog_title.classList.add("dialog-title");
        dialog_title.textContent = "Create Project";
        dialog_container.appendChild(dialog_title);


        const project_name_input = UIContainers.make_input_component("Project Name", "text");
        project_name_input.container.classList.add("vertical");
        project_name_input.input.required = true;
        project_name_input.input.setAttribute("placeholder", project_name_input.input.getAttribute("placeholder") + " (required)");
        const project_description_input = UIContainers.make_input_component("Project Description", "text");
        project_description_input.container.classList.add( "vertical");

        dialog_container.appendChild(project_name_input.container);
        dialog_container.appendChild(project_description_input.container);

        const ok_cancel_container = document.createElement('div');
        ok_cancel_container.classList.add("dialog-btn-container", "right");

        const btn_create = document.createElement('button');
        btn_create.classList.add("dialog-btn", "btn");
        btn_create.textContent = "Create";
        btn_create.setAttribute("disabled", "");
        btn_create.addEventListener("click", _ => {
            this.create_new_project(project_name_input.input.value, project_description_input.input.value);

            _thisPM.ui_enable_project_buttons();
            ui_npb_container.replaceChildren();
            _thisPM.emit_notification("project-subcontainer-will-close");
            _thisPM.emit_notification("project-container-reset");
        }, {once: true});

        const btn_cancel = document.createElement('button');
        btn_cancel.classList.add("dialog-btn", "btn");
        btn_cancel.textContent = "Cancel";

        function cancel_handler(e: Event) {
            _thisPM.ui_enable_project_buttons();
            ui_npb_container.replaceChildren();
            _thisPM.emit_notification("project-subcontainer-will-close");
            _thisPM.emit_notification("project-container-reset");

            e.target?.removeEventListener("click", cancel_handler);
        }
        btn_cancel.addEventListener("click", cancel_handler);

        ok_cancel_container.appendChild(btn_cancel);
        ok_cancel_container.appendChild(btn_create);

        dialog_container.appendChild(ok_cancel_container);

        project_name_input.input.addEventListener("input", e => {
            if(project_name_input.input.value.length > 0) {
                btn_create.removeAttribute("disabled");
            } else {
                btn_create.setAttribute("disabled", "");
            }
        });

        ui_npb_container.appendChild(dialog_container);

        this.ui_disable_project_buttons();
    }

    create_new_project(name: string, description: string) : Project {
        const project_with_same_name = Object.values(this.projects).find(project => project.name === name);
        if(project_with_same_name !== undefined) {
            console.warn(`New project "${project_with_same_name.name}" was not created. A project with same name already exists, and will be used instead.`);
            return project_with_same_name;
        }

        const new_project = new Project(name);
        new_project.description = description;

        this.projects[new_project.uuid] = new_project;
        ProjectManager.save_project_metadata(new_project);

        // create project folder in OPFS
        this.worker_opfs.postMessage({command: "new_project", cmd_opts: {project_name: new_project.name }});

        return new_project;
    }

    ui_project_details(project: Project) {

        const _thisPM = this;

        const ui_pb_container = UIContainers.get_panel_selection_container('#editor_project_container') as HTMLElement;

        if(ui_pb_container === null) {
            console.error("Container for rendering project info into not found.");
            return;
        }

        document.dispatchEvent(new CustomEvent("project-subcontainer-will-open", {
            detail: {
                container: "project-details",
            },
        }));

        const dialog_container = document.createElement('div');
        dialog_container.id = "project-details-container";
        dialog_container.classList.add("dialog-container", "layout-tight");

        const close_btn = document.createElement('button');
        close_btn.classList.add("dialog-btn", "opt-btn", "icon-green", "close-btn", "top-right");
        close_btn.textContent = "X";

        dialog_container.appendChild(close_btn);

        const dialog_title = document.createElement('div');
        dialog_title.classList.add("dialog-title");
        dialog_title.textContent = project.name;

        dialog_container.appendChild(dialog_title);

        const pi_container = document.createElement('div');
        pi_container.classList.add("info-block");

        const desc_html = `<div><key class="">Description</key><value>${project.description}</value></div>`;
        const created_html = `<div><key>Created</key><value>${new Date(project.created).toLocaleDateString()}</value></div>`;
        const modified_html = `<div><key>Modified</key><value>${new Date(project.modified).toLocaleDateString()}</value></div>`;
        const state_html = `<div><key>State</key><value class="${project.state}" style="text-transform: uppercase">${project.state}</value></div>`;

        const total_files_html = `<div><key>Files</key><value>${Object.entries(project.files).length}</value></div>`;

        const curr_file = project.last_used_file_metadata?.name ?? "-";
        const current_file_html = `<div><key>Last Used</key><value>${curr_file}</value></div>`;

        pi_container.innerHTML = desc_html + created_html + modified_html + current_file_html + total_files_html + state_html;

        dialog_container.appendChild(pi_container);

        // Display files (and possibly directories)
        // Will display items in IndexDB,
        // Confirm with OPFS (green)
        // Hide files that are missing in IndexDB (yellow)
        // Or missing in OPFS (blue)
        // Can be displayed by checking a preference option
        this.worker_opfs.postMessage({command: "list_project_dir", cmd_opts: {project_name: project.name }});
        // todo: use event to update table with opfs data (eg. file type)

        const data_table_container = document.createElement('div');
        data_table_container.classList.add("data-table-container", "scrollable");

        let data_table = document.createElement("table");
        data_table.classList.add("data-table", "project-files-data");

        const dt_head = document.createElement("thead");
        dt_head.innerHTML = "<tr><th>Name</th><th>Kind</th><th>Created</th><th>Modified</th><th></th></tr>";

        const dt_body = document.createElement("tbody");
        dt_body.id = "project-files-body";

        let row_clicked = false;   // want to know if a row click should cause this panel to close.

        const project_entry_row_handler = (opts: {project: Project, filename: string, file_metadata: FileMetaData}, file_load_click_event: Event)=> {
            row_clicked = true;

            if(_thisPM.buffer_needs_saving()) {
                console.log("editor buffer needs saving.");

                function buffer_confirm_handler(project: Project, filename: string, file_metadata: FileMetaData, e: Event) {
                    const alert_container = document.getElementById('alert_container_left') as HTMLElement;

                    if(alert_container === null) {
                        console.error("Container for rendering alert dialog not found.");
                        return;
                    }

                    const ui_buffer_warning_container = UIContainers.get_panel_selection_container('#alert_container_left') as HTMLElement;

                    if(ui_buffer_warning_container === null) {
                        console.error("Container for unsaved buffer warning alert not found.");
                        return;
                    }

                    ui_buffer_warning_container.replaceChildren();

                    const dialog_container = document.createElement('div');
                    dialog_container.id = "buffer-unsaved-container";
                    dialog_container.classList.add("dialog-container", "layout-tight", "warning-alert");

                    const btn_close_alert = document.createElement('button');
                    btn_close_alert.classList.add("dialog-btn", "opt-btn", "icon-green", "close-btn", "top-right");
                    btn_close_alert.textContent = "X";
                    dialog_container.appendChild(btn_close_alert);

                    const btn_cancel_alert = document.createElement('button');
                    btn_cancel_alert.classList.add("dialog-btn", "btn");
                    btn_cancel_alert.textContent = "Cancel";

                    const btn_load_file_alert = document.createElement('button');
                    btn_load_file_alert.classList.add("dialog-btn", "btn");
                    btn_load_file_alert.textContent = "Load File";

                    function cancel_handler(e: Event) {
                        alert_container.classList.add("hide");
                        ui_buffer_warning_container.replaceChildren();
                        btn_cancel_alert.removeEventListener("click", cancel_handler);
                        btn_close_alert.removeEventListener("click", cancel_handler);
                        btn_load_file_alert.removeEventListener("click", load_file_alert_handler);

                        // @ts-ignore
                        file_load_click_event.target.addEventListener("click", project_entry_row_handler.bind(null, {project, filename, file_metadata}), {once: true});

                    }

                    btn_close_alert.addEventListener("click", cancel_handler, {once: true});
                    btn_cancel_alert.addEventListener("click", cancel_handler, {once: true});

                    const dialog_title = document.createElement('div');
                    dialog_title.classList.add("dialog-title", "warning");
                    dialog_title.textContent = "WARNING: Unsaved Changes";
                    dialog_container.appendChild(dialog_title);


                    const dialog_text = document.createElement('div');
                    dialog_text.classList.add("notice");
                    dialog_text.innerHTML = `<div>Loading this file will overwrite the current buffer, which has unsaved changes.</div>`;
                    dialog_container.appendChild(dialog_text);

                    const ok_cancel_container = document.createElement('div');
                    ok_cancel_container.classList.add("dialog-btn-container", "right");

                    function load_file_alert_handler(e: Event) {

                        ui_buffer_warning_container.replaceChildren();
                        alert_container.classList.add("hide");

                        // remove cancel buttons listeners
                        btn_close_alert.removeEventListener("click", cancel_handler);
                        btn_cancel_alert.removeEventListener("click", cancel_handler);
                        // @ts-ignore
                        btn_load_file_alert.removeEventListener("click", load_file_alert_handler);

                        _thisPM.worker_opfs.postMessage({command: "load_file_from_project", cmd_opts: {project: opts.project, filename: opts.filename}});
                        opts.project.last_used_file_metadata = opts.file_metadata;
                        _thisPM.set_current_project(opts.project);

                        _thisPM.emit_notification("project-did-load-file");
                        _thisPM.emit_notification("project-subcontainer-will-close");
                        _thisPM.emit_notification("project-container-should-close");
                    }

                    btn_load_file_alert.addEventListener("click", load_file_alert_handler.bind(null), {once: true});

                    dialog_container.appendChild(ok_cancel_container);
                    ok_cancel_container.appendChild(btn_cancel_alert);
                    ok_cancel_container.appendChild(btn_load_file_alert);
                    ui_buffer_warning_container.appendChild(dialog_container);
                    alert_container.classList.remove("hide");
                }

                buffer_confirm_handler(opts.project, opts.filename, opts.file_metadata, file_load_click_event);

            } else {
                console.log("editor buffer does not need saving.");
                _thisPM.worker_opfs.postMessage({command: "load_file_from_project", cmd_opts: {project: opts.project, filename: opts.filename}});
                project.last_used_file_metadata = opts.file_metadata;
                _thisPM.set_current_project(project);

                _thisPM.emit_notification("project-did-load-file");
                _thisPM.emit_notification("project-subcontainer-will-close");
            }
        }

        const entry_row_elems: HTMLElement[] = [];
        Object.entries(project.files).forEach(([filename, file_metadata]) => {
            const dt_tr = document.createElement("tr");
            dt_tr.setAttribute("data-uuid", file_metadata.uuid);
            dt_tr.classList.add("file-row");

            [filename,
                "-",
                new Date(file_metadata.created).toLocaleDateString(),
                new Date(file_metadata.modified).toLocaleDateString()].forEach(opt => {

                const td = document.createElement("td");

                td.textContent = opt;
                dt_tr.appendChild(td);
            });

            const load_link_td = document.createElement("td");
            load_link_td.textContent = "-";

            if(project.state === NormalState) {
                load_link_td.textContent = "";
                const btn_load_file = document.createElement("button");
                btn_load_file.classList.add("opt-btn", "icon-green");
                btn_load_file.textContent = "open";
                entry_row_elems.push(btn_load_file);
                load_link_td.appendChild(btn_load_file);

                btn_load_file.addEventListener("click", project_entry_row_handler.bind(null, {project, filename, file_metadata}), {once: true});
            }

            dt_tr.appendChild(load_link_td);

            if(project.state === NormalState || (project.state === PhantomState && this.show_phantoms)) {
                dt_body.appendChild(dt_tr);
            }
        });

        data_table.appendChild(dt_head);
        data_table.appendChild(dt_body);

        const dt_foot = document.createElement("tfoot");
        dt_foot.innerHTML = `<tr><td colspan="5"><span class="data-count">${Object.entries(project.files).length}</span> files </td></tr>`;

        data_table.appendChild(dt_foot);
        data_table_container.appendChild(data_table);
        dialog_container.appendChild(data_table_container);

        const buttons_container = document.createElement('div');
        buttons_container.classList.add("dialog-btn-container", "right");

        if(project.state === PhantomState && this.show_phantoms) {
            const phantom_notice = document.createElement('div');
            phantom_notice.classList.add("warning-notice1");
            phantom_notice.textContent = "This is a phantom project. The associated files are not available.";
            buttons_container.appendChild(phantom_notice);
        }

        // Activate button
        const btn_activate = document.createElement('button');
        const btn_delete = document.createElement('button');
        const btn_export = document.createElement('button');

        btn_activate.textContent = "Activate";
        btn_delete.textContent = "Delete";
        btn_export.textContent = "Export";

        if(project.state !== NormalState) {
            // dont activate phantoms
            btn_activate.setAttribute("disabled", "disabled");
        }

        if(Object.entries(project.files).length === 0) {
            // dont export empty projects
            btn_export.setAttribute("disabled", "disabled");
        }

        if(project.name === PMConfig.DEFAULT_PROJECT) {
            // dont delete default project
            btn_delete.setAttribute("disabled", "disabled");
        }

        btn_activate.addEventListener("click", _ => {
            this.set_current_project(project);
            _thisPM.emit_notification("project-subcontainer-will-close");
            _thisPM.emit_notification("project-container-should-close");
            _thisPM.emit_notification("screen-left-reset");

        }, {once: true});


        function delete_handler(project: Project, e: Event) {
            const alert_container = document.getElementById('alert_container_left') as HTMLElement;

            if(alert_container === null) {
                console.error("Container for rendering alert dialog not found.");
                return;
            }

            const ui_delete_warning_container = UIContainers.get_panel_selection_container('#alert_container_left') as HTMLElement;

            if(ui_delete_warning_container === null) {
                console.error("Container for delete warning alert not found.");
                return;
            }

            ui_delete_warning_container.replaceChildren();

            const dialog_container = document.createElement('div');
            dialog_container.id = "delete-project-container";
            dialog_container.classList.add("dialog-container", "layout-tight", "warning-alert");

            const btn_close_alert = document.createElement('button');
            btn_close_alert.classList.add("dialog-btn", "opt-btn", "icon-green", "close-btn", "top-right");
            btn_close_alert.textContent = "X";
            dialog_container.appendChild(btn_close_alert);

            const btn_cancel_alert = document.createElement('button');
            btn_cancel_alert.classList.add("dialog-btn", "btn");
            btn_cancel_alert.textContent = "Cancel";

            const btn_delete_alert = document.createElement('button');
            btn_delete_alert.classList.add("dialog-btn", "btn");
            btn_delete_alert.textContent = "Delete Project";

            function cancel_handler(e: Event) {
                alert_container.classList.add("hide");
                ui_delete_warning_container.replaceChildren();
                btn_cancel_alert.removeEventListener("click", cancel_handler);
                btn_close_alert.removeEventListener("click", cancel_handler);
                btn_delete_alert.removeEventListener("click", cancel_handler);

                // main delete button event set to once.
                // let add it back.
                btn_delete.addEventListener("click", delete_handler.bind(null, project), {once: false});

            }

            btn_close_alert.addEventListener("click", cancel_handler, {once: true});
            btn_cancel_alert.addEventListener("click", cancel_handler, {once: true});

            const dialog_title = document.createElement('div');
            dialog_title.classList.add("dialog-title", "warning");
            dialog_title.textContent = "WARNING: You are about to delete this project.";
            dialog_container.appendChild(dialog_title);

            const project_info = document.createElement('div');
            project_info.classList.add("info-block");
            project_info.innerHTML = `<div><key>Project</key><value>${project.name}</value></div>`;
            //project_info.innerHTML += `<div><key>Description</key><value>${project.description}</value></div>`;
            //project_info.innerHTML += `<div><key>Created</key><value>${new Date(project.created).toLocaleDateString()}</value></div>`;
            //project_info.innerHTML += `<div><key>Modified</key><value>${new Date(project.modified).toLocaleDateString()}</value></div>`;
            project_info.innerHTML += `<div><key>State</key><value class="${project.state}" style="text-transform: uppercase">${project.state}</value></div>`;
            project_info.innerHTML += `<div><key>Files</key><value>${Object.entries(project.files).length}</value></div>`;

            dialog_container.appendChild(project_info);

            const dialog_text = document.createElement('div');
            dialog_text.classList.add("notice");
            dialog_text.innerHTML = `<div>All files and directories associated with this project will be deleted. You can always export the files before deleting them.</div><div class="warning-notice2">THIS ACTION CANNOT BE UNDONE.</div>`;
            dialog_container.appendChild(dialog_text);

            const ok_cancel_container = document.createElement('div');
            ok_cancel_container.classList.add("dialog-btn-container", "right");

            function delete_alert_handler(project: Project, e: Event) {
                _thisPM.delete_project(project);
                ui_delete_warning_container.replaceChildren();
                alert_container.classList.add("hide");

                // remove cancel buttons listeners
                btn_close_alert.removeEventListener("click", cancel_handler);
                btn_cancel_alert.removeEventListener("click", cancel_handler);
                // @ts-ignore
                btn_delete_alert.removeEventListener("click", delete_alert_handler);

                _thisPM.emit_notification("project-subcontainer-will-close");
                _thisPM.emit_notification("project-container-reset");
            }


            btn_delete_alert.addEventListener("click", delete_alert_handler.bind(null, project), {once: true});

            dialog_container.appendChild(ok_cancel_container);
            ok_cancel_container.appendChild(btn_cancel_alert);
            ok_cancel_container.appendChild(btn_delete_alert);
            ui_delete_warning_container.appendChild(dialog_container);


            alert_container.classList.remove("hide");
        }

        btn_delete.addEventListener("click", delete_handler.bind(null, project) , {once: true});

        btn_export.addEventListener("click", async _ => {
            await this.export_project_zip_fflate(project);
            _thisPM.emit_notification("project-subcontainer-will-close");
            _thisPM.emit_notification("project-container-should-close");
            _thisPM.emit_notification("screen-left-reset");
        }, {once: true});


        [btn_activate, btn_delete, btn_export].forEach(btn => {
            btn.classList.add("dialog-btn", "btn");
            buttons_container.appendChild(btn);
        });

        dialog_container.appendChild(buttons_container);
        ui_pb_container.appendChild(dialog_container);

        const project_internal_close_handler = (e: Event) => {
            console.log("closing project details.");

            // clean up file entry row events
            entry_row_elems.forEach(e => {
                // @ts-ignore
                e.removeEventListener("click", project_entry_row_handler);
            });

            ui_pb_container.replaceChildren();

            document.removeEventListener("project-subcontainer-will-close", project_internal_close_handler);
            if(row_clicked){
                this.emit_notification("project-container-should-close");
            }
        }

        document.addEventListener("project-subcontainer-will-close", project_internal_close_handler, {once: true});

        close_btn.addEventListener("click", _ => {
            row_clicked = false;
            this.emit_notification("project-subcontainer-will-close");
            this.emit_notification("project-container-reset");
        });
    }

    ui_disable_project_buttons() {
        this.btn_new_project.setAttribute("disabled", "");
    }

    ui_enable_project_buttons() {
        [this.btn_new_project].forEach((btn) => {
                btn.removeAttribute("disabled");
                btn.classList.add("selected");
        });
    }

    delete_project(project: Project) {
        // delete project folder in OPFS
        this.worker_opfs.postMessage({command: "delete_project", cmd_opts: {project_name: project.name}});

        // finally, delete the project from local storage and memory
        let json_project = localStorage.getItem('current_project');

        if(json_project !== null) {
            let project_obj = JSON.parse(json_project);
            if(project_obj.uuid === project.uuid) {
                localStorage.removeItem('current_project');
            }
        }

        ProjectManager.delete_project_metadata(project);

        delete this.projects[project.uuid];
    }


    /** Check for OPFS orphans (directories and files with no IndexDB data)
     * If orphans exist, recreate the IndexDB data.
     * notify user of orphans, give option to recreate.
     * caller should update this.projects.
    **/
    fs_check_orphans(opfs_projects_dirs: string[]) {
        console.log("Checking for orphans.");
        let project_dir_state: Record<string, DirectoryState> =  {};
        opfs_projects_dirs.forEach(project_dir => {

            let dir_type: DirectoryState = OrphanState;

            // todo: check for missing projects in IndexDB instead of using the PM.
            for(const [_, project] of Object.entries(this.projects)) {
                if(project.name === project_dir) {
                    dir_type = NormalState;
                    break;
                }
            }

            project_dir_state[project_dir] = dir_type;
            //console.log(`${project_dir} located: ${dir_type}`);

        });

        return project_dir_state;
    }

    async export_project_zip_fflate(project: Project) {
        const opfsRoot = await navigator.storage.getDirectory();
        // todo handle error
        const projects_directory_root = await opfsRoot.getDirectoryHandle(PMConfig.PROJECTS_ROOT_DIR);
        const project_dir_handle = await projects_directory_root.getDirectoryHandle(project.name);
        async function get_project_directory_structure(handle: FileSystemDirectoryHandle | FileSystemFileHandle, ds = {}) {
            if(handle.kind === 'directory') {
                for await (let [name, entry] of handle.entries()) {
                    if(entry.kind === 'file') {
                        ds = await get_project_directory_structure(await handle.getFileHandle(name), ds);
                    } else if(entry.kind === 'directory') {
                        const subDirectoryHandle = await handle.getDirectoryHandle(name);
                        // @ts-ignore
                        ds[name] = await get_project_directory_structure(subDirectoryHandle, {});
                    }
                }
            } else {
                const file = await handle.getFile();
                console.log(`Adding file ${file.name}`);
                // @ts-ignore
                ds[file.name] = strToU8(await file.text());
            }

            return ds;
        }

        let file_structure= {};
        // @ts-ignore
        file_structure[project.name] = await get_project_directory_structure(project_dir_handle);

        const zip_buffer = zipSync(file_structure);
        // @ts-ignore
        const blob = new Blob([zip_buffer], { type: 'application/zip' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = project.name + Date.now() + ".zip";
        a.click();
        URL.revokeObjectURL(url);

        return;
    }

    /* Notifications */

    /* project-changed
    * project-did-load-file
    * */
    emit_notification(notification: string, detail: NotificationObject = {
        project: this.#current_project,
    }) {
        const event = new CustomEvent(notification, {
            detail,
        });
        document.dispatchEvent(event);
    }
    /* end Notifications */


}
