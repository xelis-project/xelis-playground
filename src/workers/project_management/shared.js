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