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

async function verify_project_directory(project) {

    let verify = {project: project, is_valid: true, project_dir_missing: false, missing_files: []};

    if (project.name === null || project.name === undefined) {
        verify.project.is_valid = false;
        console.error(`Project/File Verify: Cannot load file. No project provided`);
        return verify;
    }

    try {
        const opfsRoot = await navigator.storage.getDirectory();
        const projects_directory_handle = await opfsRoot.getDirectoryHandle(PROJECTS_ROOT_DIR);
        const project_handle = await projects_directory_handle.getDirectoryHandle(project.name);

        verify.is_valid = true;

        let missing_files = [];

        for (const filename of Object.keys(project.files)) {
            try {
                await project_handle.getFileHandle(filename);
            } catch (error) {
                missing_files.push(filename);
                if(project.files[filename] === project.last_used_file_metadata) {
                    project.last_used_file_metadata = null;
                }
                delete project.files[filename];
                console.error(`Project/File Verify: File ${project.name}/${filename} not found`);
            }
        }

        if(missing_files.length > 0) {
            verify.is_valid = false;
            verify.missing_files = missing_files;
        }

    } catch (error) {
        verify.is_valid = false;
        verify.project_dir_missing = true;
        console.error(`Project/File Verify: Project directory not found`);
    }

    return verify;

}

async function verify_path(project, filename) {

    let verify = {project: {project: project, is_valid: false}, file: {name: filename, is_valid: false}};

    if (project.name === null || project.name === undefined) {
        verify.project.is_valid = false;
        console.error(`Project/File Verify: Cannot load file. No project provided`);
        return verify;
    }

    if (filename === null || filename === undefined) {
        verify.file.is_valid = false;
        console.error(`Project/File Verify: Cannot load file. No file name provided`);
        return verify;
    }

    try {
        const opfsRoot = await navigator.storage.getDirectory();
        const projects_directory_handle = await opfsRoot.getDirectoryHandle(PROJECTS_ROOT_DIR);
        const project_handle = await projects_directory_handle.getDirectoryHandle(project.name);
        verify.project.is_valid = true;

        if(filename === "") {
            verify.file.is_valid = true;
            return verify;
        }
        try {
            await project_handle.getFileHandle(filename);
            verify.file.is_valid = true;
        } catch (error) {
            verify.file.is_valid = false;
            console.error(`Project/File Verify: File not found`);
        }

    } catch (error) {
        verify.project.is_valid = false;
        console.error(`Project/File Verify: Project directory not found`);
    }

    return verify;

}

onmessage = async (e) => {

    if(e.data.command === null || e.data.command === undefined) {
        console.log("Unknown command");
    }

    const cmd_opts = e.data.cmd_opts;

    switch (e.data.command) {
        case "load_file_from_project":
            const file_data = await opfs_load_file_from_project(cmd_opts.project, cmd_opts.filename);
            postMessage({notice: "file_loaded", data: {project: cmd_opts.project, filename: cmd_opts.filename, file_data: file_data}});
            break;
        case "save_file_to_project":
            opfs_save_file(cmd_opts.project.name, cmd_opts.filename, cmd_opts.content).then(() => {
                postMessage({notice: "file_saved_result", data: {status: "ok", project: cmd_opts.project, filename: cmd_opts.filename, should_notify: cmd_opts.should_notify}});
                });
            break;
            //TODO: make recursive check.
        case "verify_project_directory":
            const pd_verify = await verify_project_directory(cmd_opts.project);
            postMessage({notice: cmd_opts.notice, data: {verify: pd_verify}});
            break;
        case "verify_path":
            const filename = cmd_opts.file_metadata !== null ? cmd_opts.file_metadata.name : "";
             const verify = await verify_path(cmd_opts.project, filename);
            postMessage({notice: cmd_opts.notice, data: {verify: verify}});
            break;

        case "list_all_project_directories":
            const project_dirs = await opfs_list_all_project_dirs();
            postMessage({notice: "list_all_project_directories_result", data: {project_dirs: project_dirs}});
            break;

        case "list_project_dir":
            const project_dir_list_info = await opfs_list_project_dir(cmd_opts.project_name);
            postMessage({notice: "list_project_dir_result", data: {project_dir_list_info: project_dir_list_info}});
            break;

        case "new_project":
            let directory_ok = false;
            const proj_directory_handle = await opfs_new_project(e.data.cmd_opts.project_name);
            directory_ok = proj_directory_handle !== null
                && proj_directory_handle !== undefined
                && proj_directory_handle.kind === "directory";
            postMessage({notice: "Project directory created.", data: {directory_ok: directory_ok}});
            break;
        case "delete_project":
            const info_obj = await opfs_delete_dir(cmd_opts.project_name);
            postMessage({notice: "delete_project_result", data: info_obj});
            break;
        default:
            break;
    }
};

async function opfs_new_project(project_name) {
    if (!project_name || project_name === "") {
        console.error("No project name provided");
        return;
    }

    const opfsRoot = await navigator.storage.getDirectory();
    const project_directory_handle = await opfsRoot.getDirectoryHandle(PROJECTS_ROOT_DIR, { create: true });
    return await project_directory_handle.getDirectoryHandle(project_name, {create: true});

}

async function opfs_list_all_project_dirs() {
    const opfsRoot = await navigator.storage.getDirectory();
    const project_directory_handle = await opfsRoot.getDirectoryHandle(PROJECTS_ROOT_DIR, { create: true });

    let project_directory_list = [];

    for await (let [name, handle] of project_directory_handle.entries()) {
        if(handle.kind === "file") {
            console.log(`[${name}] - files not allowed at top level project directory. Delete.`);
            continue;
        }
        project_directory_list.push(name);
    }

    return project_directory_list;
}

async function opfs_list_project_dir(project_name) {
    const opfsRoot = await navigator.storage.getDirectory();
    const projects_dir = await opfsRoot.getDirectoryHandle(PROJECTS_ROOT_DIR, { create: true });

    let status = "ok";
    let error = null;
    let dir_contents = [];
    await projects_dir.getDirectoryHandle(project_name)
        .then(
            async (project_directory_handle) => {
                for await (let [name, handle] of project_directory_handle.entries()) {
                    dir_contents.push({name: name, kind: handle.kind});
                    //console.log(name, handle.kind);
                }
            },
            (err) => {
                error = err;
                status = "error";
            }
        );

    return {status: status, project_name: project_name, dir_contents: dir_contents, error: error};
}

async function opfs_save_file(project_name, filename, contents) {

    let file_data =  contents || "";

    if (project_name === null || project_name === undefined || project_name === "") {
        console.error("Cannot save file. No project name provided");
        return;
    }

    if (filename === null || filename === undefined || filename === "") {
        console.error("Cannot save file. No file name provided");
        return;
    }

    const opfsRoot = await navigator.storage.getDirectory();
    const projects_root = await opfsRoot.getDirectoryHandle(PROJECTS_ROOT_DIR);
    const project_dir_handle = await projects_root.getDirectoryHandle(project_name);


    const fileHandle = await project_dir_handle.getFileHandle(filename, { create: true });
    let accessHandle;

    try {
        accessHandle = await fileHandle.createSyncAccessHandle({
            // only read access is needed for this, but OPFS unsafe saves might happen
            // in another worker, so we need to make it unsafe to avoid errors.
            mode: "readwrite-unsafe",
        });
        const encoder = new TextEncoder();
        const encoded_contents = encoder.encode(file_data);

        // Truncate the file to 0 bytes
        await accessHandle.truncate(0);
        accessHandle.write(encoded_contents, { at: 0 });

        accessHandle.flush();
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
}

async function opfs_delete_dir(project_name) {
    let status = "ok";
    let message = "ok";
    if (project_name === null || project_name === undefined || project_name === "") {
        status = "error";
        message = "Cannot delete directory. No project name provided"
        console.error(message);
        return {project_name: project_name, status: status, message: message};
    }

    const opfsRoot = await navigator.storage.getDirectory();
    const projects_root = await opfsRoot.getDirectoryHandle(PROJECTS_ROOT_DIR);

    await projects_root.removeEntry(project_name, {recursive: true});

    return {project_name: project_name, status: status, message: message};
}
