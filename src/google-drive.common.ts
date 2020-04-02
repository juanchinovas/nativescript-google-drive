import { File } from "tns-core-modules/file-system";

export interface IDriveManager {
    createFile(fileInfo: FileInfo): Promise<string>;
    updateFile(fileInfo: FileInfo): Promise<boolean>;
    readFileContent(driveFileId: string): Promise<any>;
    deleteFile(driveFileId: string): Promise<boolean>;
    downloadFile(driveFileId: string): Promise<File>;
    uploadFile(fileInfo: FileInfo): Promise<string>;
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
    content?: string | File;
    mimeType: string;
    id?: string;
    description?: any;
    parentId?: string;
    createdTime?: Date;
    size?: number;
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