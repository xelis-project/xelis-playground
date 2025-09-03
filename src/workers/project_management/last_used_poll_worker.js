//importScripts('shared.js');

const PROJECTS_ROOT_DIR = "projects";

async function opfs_load_file_from_project(project, filename) {

    let file_data = "";

    if (project === null || project === undefined) {
        console.error("Cannot load file. No project provided");
        return file_data;
    }

    if (filename === null || filename === undefined || filename === "") {
        console.error("Cannot load file. No file name provided");
        return file_data;
    }


    const opfsRoot = await navigator.storage.getDirectory();
    const projects_directory_handle = await opfsRoot.getDirectoryHandle(PROJECTS_ROOT_DIR);
    const project_handle = await projects_directory_handle.getDirectoryHandle(project.name);

    const fileHandle = await project_handle.getFileHandle(filename);

    let accessHandle;

    try {
        accessHandle = await fileHandle.createSyncAccessHandle({
            // only read access is needed for this, but OPFS unsafe saves might happen
            // in another worker, so we need to make it unsafe to avoid errors.
            mode: "read-only",
        });

        const textDecoder = new TextDecoder();
        // Initialize this variable for the size of the file.
        let size = 0;
        // The current size of the file, initially `0`.
        size = accessHandle.getSize();
        // Prepare a data view of the length of the file.
        const dataView = new DataView(new ArrayBuffer(size));

        // Read the entire file into the data view.
        accessHandle.read(dataView, { at: 0 });

        file_data = textDecoder.decode(dataView);

    } catch (error) {
        console.error("Failed to create SyncAccessHandle:", error);
        if (error.name === 'InvalidStateError') {
            console.error("This error often occurs if another handle or writable stream is already open for the file.");
        }
    } finally {
        if(accessHandle) {
            try {
                accessHandle.close();
            } catch (error) {
                console.error("Error closing SyncAccessHandle:", error);
            }
        }
    }

    return file_data;

}

let POLL_INTERVAL_SECONDS = 60;
let file_poll_interval;

onmessage = async (e) => {

    if(e.data.command === null || e.data.command === undefined) {
        console.log("Unknown command");
    }

    const cmd_opts = e.data.cmd_opts;

    switch (e.data.command) {
        case "start_polling":
            start_polling();
            postMessage({notice: "file_polling_started", data: {}});
            break;
        case "poll_with_current_project":
            const project = cmd_opts.project;
            const last_file_metadata = project.last_used_file_metadata;
            if(last_file_metadata === null || last_file_metadata === undefined) {
                console.log("No current file");
                return;
            }

            try {
                const file_data = await opfs_load_file_from_project(project, last_file_metadata.name);
                postMessage({notice: "last_file_refreshed", data: {project: project, last_file_data: file_data}});
            } catch (error) {
                console.log("Error reading file");
                console.log(error);
            }

            break;
        default:
            break;
    }
};

onerror = (event) => {
    console.error('Error within worker worker_lass_used_poll:', event.message);
    return true; // Prevents default behavior (e.g., worker termination)
};

function start_polling(seconds = POLL_INTERVAL_SECONDS) {
    if(file_poll_interval !== undefined && file_poll_interval !== null) {
        console.log("File polling already started.");
        return;
    }

    console.log(`Starting file polling every ${seconds} seconds.`);

    file_poll_interval = setInterval(() => {
        postMessage({notice: "get_current_project", data: {}});
    }, seconds * 1000);
}

function stop_polling() {
    clearInterval(file_poll_interval);
    file_poll_interval = undefined;
    console.log("File polling stopped");
}


