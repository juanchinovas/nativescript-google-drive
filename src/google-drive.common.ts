import { File } from "tns-core-modules/file-system";

export interface IDriveManager {
    createFile(fileInfo: FileInfo): Promise<string>;
    readFile(driveFileId: string): Promise<string>;
    deleteFile(driveFileId: string): Promise<boolean>;
    downloadFile(driveFileId: string): Promise<File>;
    uploadFile(fileInfo: FileInfo): Promise<string>;
    listFiles(parentId?: string): Promise<Array<FileInfo>>;
    findFile(name: string, mimeType?: string): Promise<Array<FileInfo>>;
    createFolder(fileInfo: FileInfo): Promise<string>;
    findFolder(name: string): Promise<Array<FileInfo>>;
}

/**
 * File metadata used to create and upload file and create folder
 */
export interface FileInfo {
    name: string;
    content: string | File;
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