import { File } from "tns-core-modules/file-system";

export interface IDriveManager {
    createFile(fileInfo: FileInfoContent): Promise<string>;
    updateFile(fileInfo: FileInfoContent): Promise<boolean>;
    readFileContent(driveFileId: string): Promise<string>;
    deleteFile(driveFileId: string): Promise<boolean>;
    downloadFile(driveFileId: string): Promise<File>;
    uploadFile(fileInfo: FileInfoContent): Promise<string>;
    listFilesByParent(parentId?: string): Promise<Array<FileInfo>>;
    searchFiles(fileInfo: FileInfo): Promise<Array<FileInfo>>;
    createFolder(fileInfo: FileInfo): Promise<string>;
    findFolder(name: string): Promise<Array<FileInfo>>;
}

/**
 * File metadata used to create and upload file and create folder
 */
export interface FileInfo {
    name: string;
    mimeType?: string;
    id?: string;
    description?: any;
    parentId?: string;
    createdTime?: Date;
    size?: number;
}

/**
 * File metadata with content
 */
export interface FileInfoContent extends FileInfo {
    content: string | File;
}

/**
 * Google Drive Spaces.
 * Supported spaces [drive | appDataFolder]
 *
 */
export enum SPACES {
    DRIVE = "drive",
    APP_DATA_FOLDER = "appDataFolder"
}

/**
 * Interface to initialize the plugin
 */
export interface Config {
    space: SPACES;
    extraDriveScopes?: Array<string>;
    worker: Worker;
    clientId?: string;
}

/**
 * Convert function into string representing
 * the function to be send as paramenter to the worker.
 * @param {any} data
 * @return {any}
 */
function __convertFunctionAsString(func: Function): string | null {
    const reg = /\s+(?=typeof|function|const|let|if|new|throw|return)|(\/\/.*|\/\*.*\*\/)[\n\t\r]+/img;
    return func && func.toString().replace(reg, "") || null;
};

/**
 * Create an worker thread and send data to it
 * @param {func: Function,_worker: Worker, resPromese: Function, rejPromise: Function } params
 */
export function executeThread(params: { 
    _worker: Worker, 
    args: any,
    func: Function,
    resPromise: Function, 
    rejPromise: Function }): void {
    
    const func = __convertFunctionAsString(params.func);
    const ThreadWorker: Worker =  params._worker;
    // @ts-ignore
    const worker = new ThreadWorker();
    worker.postMessage({args: params.args, func});

    worker.onmessage = (msg: MessageEvent) => {
        worker.terminate();
        params.resPromise(msg.data);
    };
    worker.onerror = (err: ErrorEvent) => {
        worker.terminate();
        params.rejPromise(err.message);
    };
}