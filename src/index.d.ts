import { File } from "tns-core-modules/file-system";
import { IDriveManager, FileInfo, SPACES, Config } from "./google-drive.common";
export declare class GoogleDriveHelper implements IDriveManager {
    static singInOnGoogleDrive(config: Config): Promise<GoogleDriveHelper>;
    createFile(fileInfo: FileInfo): Promise<string>;
    readFile(driveFileId: string): Promise<string>;
    deleteFile(driveFileId: string): Promise<boolean>;
    downloadFile(driveFileId: string): Promise<File>;
    uploadFile(fileInfo: FileInfo): Promise<string>;
    listFiles(parentId?: string): Promise<Array<FileInfo>>;
    searchFiles(fileInfo: FileInfo): Promise<Array<FileInfo>>;
    createFolder(fileInfo: FileInfo): Promise<string>;
    findFile(name: string, mimeType?: string): Promise<Array<FileInfo>>;
    findFolder(name: string): Promise<Array<FileInfo>>;    
    signOut(): Promise<boolean>;
}
export { FileInfo, SPACES, Config } from './google-drive.common';
