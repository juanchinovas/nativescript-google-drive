import { File } from "tns-core-modules/file-system";
import { IDriveManager, FileInfo, SPACES, Config, FileInfoContent } from "./google-drive.common";
export declare class GoogleDriveHelper implements IDriveManager {
    /**
     * This method start Google SignIn flow and ask for Gogole Drive permissions to the user
     * and initialize a drive helper class
     * @static @function
     *
     * @param {Config} config
     *
     * @returns {Promise<GoogleDriveHelper>}
     */
    static signInOnGoogleDrive(config: Config): Promise<GoogleDriveHelper>;
    /**
     * Create a file with the specified metadata in Google Drive
     *
     * @param {FileInfoContent} fileInfo file metadata
     *
     * @returns {Promise<string>} created file id
     */
    createFile(fileInfo: FileInfoContent): Promise<string>;
    /**
     * Update a file content in Google Drive.
     * If you want to update the metadata, you have to required permission to metadata scope to the user.
     *
     * @param {FileInfoContent} fileInfo file metadata
     *
     * @returns {Promise<string>} created file id
     */
    updateFile(fileInfo: FileInfoContent): Promise<boolean>;
    /**
     * Read the content of plain text file
     * @param {string} driveFileId
     *
     * @returns {Promise<string>} text contained in the file
     */
    readFileContent(driveFileId: string): Promise<string>;
    /**
     * Delete a file
     * @param {string} driveFileId
     *
     * @returns {Promise<boolean>} deleted or not
     */
    deleteFile(driveFileId: string): Promise<boolean>;
    /**
     * Download a file
     * @param {string} driveFileId
     *
     * @returns {Promise<File>} file downloaded
     */
    downloadFile(driveFileId: string): Promise<File>;
    /**
     * Upload a file with the specified metadata in Google Drive
     *
     * @param {FileInfo} fileInfo file metadata
     *
     * @returns {Promise<string>} uploaded file id
     */
    uploadFile(fileInfo: FileInfo): Promise<string>;
    /**
     * List all the files contained in the parent or root folder
     * @param {string} parentId parent folder OPTIONAL
     *
     * @returns {Promise<Array<FileInfo>>} file list
     */
    listFilesByParent(parentId?: string): Promise<Array<FileInfo>>;
    /**
     * Search files in Google Drive with the given metadata.
     *
     * @param {FileInfo} fileInfo file metadata to search for
     *
     * @returns {Promise<Array<FileInfo>>} file list matched
     */
    searchFiles(fileInfo: FileInfo): Promise<Array<FileInfo>>;
    /**
     * Create a folder with the given metadata. the content property is ignore
     * @param {FileInfo} fileInfo folder metadata
     *
     * @returns {Promise<string>} created folder id
     */
    createFolder(fileInfo: FileInfo): Promise<string>;
    /**
     * Find folders by name
     *
     * @param {string} name
     *
     * @returns {Promise<Array<FileInfo>>} folder list
     */
    findFolder(name: string): Promise<Array<FileInfo>>;
    /**
     * Disconnect the google drive account
     * @returns {Promise<boolean>}
     */
    signOut(): Promise<boolean>;
}

export { FileInfoContent, FileInfo, SPACES, Config } from './google-drive.common';
