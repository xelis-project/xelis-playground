importScripts('shared.js');

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


