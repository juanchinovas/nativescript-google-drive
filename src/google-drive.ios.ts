import { ios } from "tns-core-modules/application";
import { File, knownFolders } from "tns-core-modules/file-system";
import { IDriveManager, FileInfo, FileInfoContent, SPACES, Config, executeThread } from "./google-drive.common";
import { NativeObjectPool } from "nativescript-native-object-pool";

let __config: Config;
/**
 * Google drive helper class
 * @class
 */
export class GoogleDriveHelper implements IDriveManager {

    /**
     * This method start Google SignIn flow and ask for Gogole Drive permissions to the user
     * and initialize a drive helper class
     * @static @function
     *
     * @param {Config} config
     *
     * @returns {Promise<GoogleDriveHelper>}
     */
    static singInOnGoogleDrive(config: Config): Promise<GoogleDriveHelper> {
        config.extraDriveScopes = config.extraDriveScopes || [];
        config.extraDriveScopes.unshift(driveHelper.getScope(config.space));
        config.extraDriveScopes.push(kGTLRAuthScopeDriveFile);

        return new Promise((res, rej) => {
            const _delegate = GIDSignInDelegateImpl.new();
            _delegate.resolvePromise = res;
            _delegate.rejectPromise = rej;

            const googleSignInService = GIDSignIn.sharedInstance();
            googleSignInService.uiDelegate = _delegate;
            googleSignInService.delegate = _delegate;
            googleSignInService.shouldFetchBasicProfile = false;
            googleSignInService.scopes = NSArray.arrayWithArray(<any>config.extraDriveScopes);
            (googleSignInService as any).presentingViewController = ios.rootController;
            googleSignInService.clientID = config.clientId;
            config.clientId = null;

            if ((googleSignInService as any).hasPreviousSignIn()) {
                (googleSignInService as any).restorePreviousSignIn();
            } else {
                googleSignInService.signIn();
            }

            __config = config;
        });
    }

    /**
     * Create a file with the specific metadata in Google Drive
     *
     * @param {FileInfoContent} fileInfo file metadata
     *
     * @returns {Promise<string>} created file id
     */
    createFile(fileInfo: FileInfoContent): Promise<string> {
        return new Promise((res, rej) => {
            fileInfo.mimeType = fileInfo.mimeType || "text/plain";

            function createFileHelperFn(fileInfo: FileInfoContent, googleDriveService: GTLRDriveService, parent: string) {

                const metadata = GTLRDrive_File.new();
                metadata.parents = NSArray.arrayWithArray(<any>[parent]);
                metadata.name = fileInfo.name;
                metadata.descriptionProperty = fileInfo.description;
                metadata.mimeType = fileInfo.mimeType;

                let uploader: GTLRDriveQuery_FilesCreate = null;
                let uploadParams: GTLRUploadParameters = null;
                if (fileInfo.content) {
                    let content: NSString = NSString.stringWithString(fileInfo.content.toString());
                    uploadParams = GTLRUploadParameters
                    .uploadParametersWithDataMIMEType(content.dataUsingEncoding(NSUTF8StringEncoding), metadata.mimeType);
                }

                uploader = GTLRDriveQuery_FilesCreate.queryWithObjectUploadParameters(metadata, uploadParams);
                uploader.fields = "id";

                googleDriveService.executeQueryCompletionHandler(uploader, (ticket, file: GTLRDrive_File, error) => {
                    if (error) {
                        throw error.localizedDescription;
                    }
                    /*This is on worker*/
                    // @ts-ignore
                    onCompleted(file.identifier);
                });
            }

            executeThread({
                func: createFileHelperFn,
                args: {
                    fileInfo,
                    googleDriveService: "-",
                    parent: fileInfo.parentId || __config.space
                },
                resPromise: res, 
                rejPromise: rej,
                _worker: __config.worker
            });
        });
    }

    /**
     * Update a file content in Google Drive.
     * If you want to update the metadata, you have to required permission to metadata scope to the user.
     *
     * @param {FileInfoContent} fileInfo file metadata
     *
     * @returns {Promise<string>} created file id
     */
    updateFile(fileInfo: FileInfoContent): Promise<boolean> {
        return new Promise((res, rej) => {
            fileInfo.mimeType = fileInfo.mimeType || "text/plain";

            function updateFileHelperFn(fileInfo: FileInfoContent, googleDriveService: GTLRDriveService, parent: string, isFile: boolean) {
                if (!fileInfo.content) {
                    throw "The file content cannot be null ";
                }

                const scopes: NSArray<String> = GIDSignIn.sharedInstance().scopes;
                const metadata = GTLRDrive_File.new();
                if (scopes.containsObject(kGTLRAuthScopeDriveMetadata)) {
                    metadata.parents = NSArray.arrayWithArray(<any>[parent]);
                    metadata.name = fileInfo.name;
                    metadata.descriptionProperty = fileInfo.description;
                    metadata.mimeType = fileInfo.mimeType;
                }

                let uploader: GTLRDriveQuery_FilesUpdate = null;
                let uploadParams: GTLRUploadParameters = null;
                if (isFile) {
                    uploadParams = GTLRUploadParameters
                    .uploadParametersWithDataMIMEType(NSData.dataWithContentsOfFile((<any>fileInfo.content)._path), fileInfo.mimeType);
                } else {
                    let content: NSString = NSString.stringWithString(fileInfo.content.toString());
                    uploadParams = GTLRUploadParameters
                    .uploadParametersWithDataMIMEType(content.dataUsingEncoding(NSUTF8StringEncoding), fileInfo.mimeType);
                }

                uploader = GTLRDriveQuery_FilesUpdate.queryWithObjectFileIdUploadParameters(metadata, fileInfo.id, uploadParams);
                googleDriveService.executeQueryCompletionHandler(uploader, (ticket, file: GTLRDrive_File, error) => {
                    if (error) {
                        throw error.localizedDescription;
                    }
                    /*This is on worker*/
                    // @ts-ignore
                    onCompleted(true);
                });
            }

            executeThread({
                func: updateFileHelperFn,
                args: {
                    fileInfo,
                    googleDriveService: "-",
                    parent: fileInfo.parentId || __config.space,
                    isFile: fileInfo.content instanceof File
                },
                resPromise: res, 
                rejPromise: rej,
                _worker: __config.worker
            });
        });
    }

    /**
     * Read a text plain file
     * @param {string} driveFileId
     *
     * @returns {Promise<string>} text contained in the file
     */
    readFileContent(driveFileId: string): Promise<string> {
        return new Promise((res, rej) => {
            function readFileHelperFn(driveFileId: string, googleDriveService: GTLRDriveService) {
                const driveFileGet: GTLRDriveQuery_FilesGet =  GTLRDriveQuery_FilesGet.queryForMediaWithFileId(driveFileId);
                googleDriveService.executeQueryCompletionHandler(driveFileGet, (ticket, data: GTLRDataObject, error) => {
                    if (error) {
                        throw error.localizedDescription;
                    }
                    /*This is on worker*/
                    // @ts-ignore
                    onCompleted(NSString.stringWithCStringLength(data.data.bytes, data.data.length));
                });
            }

            executeThread({
                func: readFileHelperFn,
                args: {
                    driveFileId,
                    googleDriveService: "-"
                },
                resPromise: res, 
                rejPromise: rej,
                _worker: __config.worker
            });
        });
    }

    /**
     * Delete a file
     * @param {string} driveFileId
     *
     * @returns {Promise<boolean>} deleted or not
     */
    deleteFile(driveFileId: string): Promise<boolean> {
       return new Promise((res, rej) => {
            function deleteFileHelperFn(driveFileId: string, googleDriveService: GTLRDriveService) {
                const driveFileDelete: GTLRDriveQuery_FilesDelete =  GTLRDriveQuery_FilesDelete.queryWithFileId(driveFileId);
                googleDriveService.executeQueryCompletionHandler(driveFileDelete, (ticket, file, error) => {
                    if (error) {
                        throw error.localizedDescription;
                    }
                    /*This is on worker*/
                    // @ts-ignore
                    onCompleted(true);
                });
            }

            executeThread({
                func: deleteFileHelperFn,
                args: {
                    driveFileId,
                    googleDriveService: "-"
                },
                resPromise: res, 
                rejPromise: rej,
                _worker: __config.worker
            });
        });
    }

    /**
     * Download a file
     * @param {string} driveFileId
     *
     * @returns {Promise<File>} file downloaded
     */
    downloadFile(driveFileId: string): Promise<File> {
        return new Promise((res, rej) => {
            function downloadFileHelperFn(driveFileId: string, googleDriveService: any, path: string) {
                const driveFileGet: GTLRDriveQuery_FilesGet =  GTLRDriveQuery_FilesGet.queryForMediaWithFileId(driveFileId);
                googleDriveService.executeQueryCompletionHandler(driveFileGet, (ticket, file: GTLRDataObject, error) => {
                    if (error) {
                        throw error.localizedDescription;
                    }
                    const fileManager = NSFileManager.defaultManager;

                    if (fileManager.fileExistsAtPath(path)) {
                        fileManager.removeItemAtPathError(path);
                    }
                    const done = NSFileManager.defaultManager.createFileAtPathContentsAttributes(path, file.data, null);
                    if (!done) throw `Couldn't save the file at ${path}`;
                    /*This is on worker*/
                    // @ts-ignore
                    onCompleted(path);
                });
            }
            executeThread({
                func: downloadFileHelperFn,
                args: {
                    driveFileId,
                    googleDriveService: "-",
                    path: `${knownFolders.temp().path}/${driveFileId}`
                },
                resPromise: (result: any) => {
                    res(File.fromPath(result));
                },
                rejPromise: rej,
                _worker: __config.worker
            });
        });
    }

    /**
     * Upload a file with the specific metadata in Google Drive
     *
     * @param {FileInfoContent} fileInfo file metadata
     *
     * @returns {Promise<string>} uploaded file id
     */
    uploadFile(fileInfo: FileInfoContent): Promise<string> {
        return new Promise((res, rej) => {

            function uploadFileHelperFn(fileInfo: any, googleDriveService: GTLRDriveService, spaces: any) {
                const metadata = GTLRDrive_File.new();
                metadata.parents = NSArray.arrayWithArray(<any>[spaces]);
                metadata.name = fileInfo.name;
                metadata.descriptionProperty = fileInfo.description;
                metadata.mimeType = fileInfo.mimeType;

                let uploader: GTLRDriveQuery_FilesCreate = null;
                if (typeof(fileInfo.content) !== "string" && fileInfo.content._path) {
                    throw "File couldn't be uploaded, file info content is not a File";
                }
                const fileHandler = NSFileHandle.fileHandleForReadingAtPath(fileInfo.content._path);
                const uploadParams = GTLRUploadParameters.uploadParametersWithFileHandleMIMEType(fileHandler, fileInfo.mimeType);

                uploader = GTLRDriveQuery_FilesCreate.queryWithObjectUploadParameters(metadata, uploadParams);
                uploader.fields = "id";

                googleDriveService.executeQueryCompletionHandler(uploader, (ticket, file: GTLRDrive_File, error) => {
                    if (error) {
                        throw error.localizedDescription;
                    }
                    /*This is on worker*/
                    // @ts-ignore
                    onCompleted(file.identifier);
                });
            }

            executeThread({
                func: uploadFileHelperFn,
                args: {
                    fileInfo,
                    googleDriveService: "-",
                    spaces: fileInfo.parentId || __config.space
                },
                resPromise: res, 
                rejPromise: rej,
                _worker: __config.worker
            });

         });
    }

    /**
     * List all the files contained in the parent or root folder
     * @param {string} parentId parent folder OPTIONAL
     *
     * @returns {Promise<Array<FileInfo>>} file list
     */
    listFilesByParent(parentId?:  string): Promise<Array<FileInfo>> {
        return new Promise((res, rej) => {

            function listFilesHelperFn(parentId: any, googleDriveService: any, spaces: any) {
                const driveFileList: GTLRDriveQuery_FilesList =  GTLRDriveQuery_FilesList.query();
                driveFileList.q = `'${parentId}' in parents`;
                driveFileList.spaces = spaces;
                driveFileList.fields = "files(id,name,size,createdTime,description,mimeType,parents)";

                googleDriveService.executeQueryCompletionHandler(driveFileList, (ticket, result: GTLRDrive_FileList, error) => {
                    if (error) {
                        throw error.localizedDescription;
                    }
                    const files = result.files;
                    const results = [];
                    for (let i = 0, len = files.count; i < len; i++) {
                        results.push(<FileInfo>{
                            name: files.objectAtIndex(i).name,
                            description: files.objectAtIndex(i).descriptionProperty,
                            mimeType: files.objectAtIndex(i).mimeType,
                            parentId: files.objectAtIndex(i).parents.componentsJoinedByString(",").toString(),
                            id: files.objectAtIndex(i).identifier,
                            size: files.objectAtIndex(i).size,
                            createdTime: new Date(files.objectAtIndex(i).createdTime.date)
                        });
                    }
                    /*This is on worker*/
                    // @ts-ignore
                    onCompleted(results);
                });
            }

            executeThread({
                func: listFilesHelperFn,
                args: {
                    parentId: parentId || __config.space,
                    googleDriveService: "-",
                    spaces: __config.space
                },
                resPromise: res, 
                rejPromise: rej,
                _worker: __config.worker
            });
        });
    }

    /**
     * Search files in Google Drive with the given metadata.
     *
     * @param {FileInfo} fileInfo file metadata to search for
     *
     * @returns {Promise<Array<FileInfo>>} file list matched
     */
    searchFiles(fileInfo: FileInfo): Promise<Array<FileInfo>> {
        return new Promise((res, rej) => {
            function searchFilesHelperFn(fileInfo: any, googleDriveService: any, spaces: any) {
                let queryString = `'${fileInfo.parentId || spaces}' in parents`;
                for (let key in fileInfo) {
                    if (fileInfo[key] && ["parentId", "content", "description"].indexOf(key) === -1) {
                        queryString +=  ` and ${key} = '${fileInfo[key]}'`;
                    }
                }

                const driveFileList: GTLRDriveQuery_FilesList =  GTLRDriveQuery_FilesList.query();
                driveFileList.q = queryString;
                driveFileList.spaces = spaces;
                driveFileList.fields = "files(id,name,size,createdTime,description,mimeType,parents)";

                googleDriveService.executeQueryCompletionHandler(driveFileList, (ticket, result: GTLRDrive_FileList, error) => {
                    if (error) {
                        throw error.localizedDescription;
                    }
                    const files = result.files;
                    const results = [];
                    for (let i = 0, len = files.count; i < len; i++) {
                        results.push(<FileInfo>{
                            name: files.objectAtIndex(i).name,
                            description: files.objectAtIndex(i).descriptionProperty,
                            mimeType: files.objectAtIndex(i).mimeType,
                            parentId: files.objectAtIndex(i).parents.componentsJoinedByString(",").toString(),
                            id: files.objectAtIndex(i).identifier,
                            size: files.objectAtIndex(i).size,
                            createdTime: new Date(files.objectAtIndex(i).createdTime.date)
                        });
                    }
                    /*This is on worker*/
                    // @ts-ignore
                    onCompleted(results);
                });
            }
            executeThread({
                func: searchFilesHelperFn,
                args: {
                    fileInfo,
                    googleDriveService: "-",
                    spaces: __config.space
                },
                resPromise: res, 
                rejPromise: rej,
                _worker: __config.worker
            });
        });
    }

    /**
     * Create a folder with the given metadata. the content property is ignore
     * @param {FileInfo} fileInfo folder metadata
     *
     * @returns {Promise<string>} created folder id
     */
    createFolder(fileInfo: FileInfo): Promise<string> {
        return new Promise((res, rej) => {
            function searchFilesHelperFn(fileInfo: any, googleDriveService: any, parent: any) {
               const metadata = GTLRDrive_File.new();
                metadata.parents = NSArray.arrayWithArray(<any>[parent]);
                metadata.name = fileInfo.name;
                metadata.descriptionProperty = fileInfo.description;
                metadata.mimeType = "application/vnd.google-apps.folder";

                let uploader: GTLRDriveQuery_FilesCreate = null;

                if (fileInfo.content) {
                    let content: NSString = NSString.stringWithString(fileInfo.content.toString());
                    const uploadParams = GTLRUploadParameters
                    .uploadParametersWithDataMIMEType(content.dataUsingEncoding(NSUTF8StringEncoding), metadata.mimeType);
                    uploader = GTLRDriveQuery_FilesCreate.queryWithObjectUploadParameters(metadata, uploadParams);
                } else {
                    uploader = GTLRDriveQuery_FilesCreate.queryWithObjectUploadParameters(metadata, null);
                }
                uploader.fields = "id";

                googleDriveService.executeQueryCompletionHandler(uploader, (ticket, file: GTLRDrive_File, error) => {
                    if (error) {
                        throw error.localizedDescription;
                    }
                    /*This is on worker*/
                    // @ts-ignore
                    onCompleted(file.identifier);
                });
            }

            executeThread({
                func: searchFilesHelperFn,
                args: {
                    fileInfo,
                    googleDriveService: "-",
                    roots: fileInfo.parentId || __config.space
                },
                resPromise: res, 
                rejPromise: rej,
                _worker: __config.worker
            });
        });
    }

    /**
     * Find folders by name
     *
     * @param {string} name
     *
     * @returns {Promise<Array<FileInfo>>} folder list
     */
    findFolder(name: string): Promise<Array<FileInfo>> {
        return new Promise((res, rej) => {
            function findFolderHelperFn(name: any, googleDriveService: any, spaces: any) {
                let queryString = `name = '${name}' and '${spaces}' in parents and mimeType ='application/vnd.google-apps.folder'`;
                const driveFileList: GTLRDriveQuery_FilesList =  GTLRDriveQuery_FilesList.query();
                driveFileList.q = queryString;
                driveFileList.spaces = spaces;
                driveFileList.fields = "files(id,name,size,createdTime,description,mimeType,parents)";

                googleDriveService.executeQueryCompletionHandler(driveFileList, (ticket, result: GTLRDrive_FileList, error) => {
                    if (error) {
                        throw error.localizedDescription;
                    }
                    const files = result.files;
                    const results = [];
                    for (let i = 0, len = files.count; i < len; i++) {
                        results.push(<FileInfo>{
                            name: files.objectAtIndex(i).name,
                            description: files.objectAtIndex(i).descriptionProperty,
                            parentId: files.objectAtIndex(i).parents.componentsJoinedByString(",").toString(),
                            id: files.objectAtIndex(i).identifier,
                            createdTime: new Date(files.objectAtIndex(i).createdTime.date)
                        });
                    }
                    /*This is on worker*/
                    // @ts-ignore
                    onCompleted(results);
                });
            }

            executeThread({
                func: findFolderHelperFn,
                args: {
                    name,
                    googleDriveService: "-",
                    spaces: __config.space
                },
                resPromise: res, 
                rejPromise: rej,
                _worker: __config.worker
            });
        });
    }

    /**
     * Disconnect the google drive account
     * @returns {Promise<boolean>}
     */
    signOut(): Promise<boolean> {
        return new Promise((res, rej) => {
            try {
                NativeObjectPool.remove("googleDriveService");
                GIDSignIn.sharedInstance().signOut();
                res(true);
            } catch (e) {
                rej(e);
            }
        });
    }
}


/**
 * Helper class to get the root folder on drive to create and save, look at and delete a file or folder
 * @object
 */

const driveHelper = Object.create(null);

/**
 * Determine which google drive scope use
 *
 * @param {SPACES} space selected scope
 *
 * @returns {string} Google drive scope
 */
driveHelper.getScope = function(space: SPACES): string {
    return space === SPACES.DRIVE ?
        kGTLRAuthScopeDrive : kGTLRAuthScopeDriveAppdata;
};

/**
 * GIDSignInDelegate implementation, to handler when user cancel or signIn successfully.
 * This class resolve or reject the JS Promise.
 */
class GIDSignInDelegateImpl extends NSObject implements GIDSignInDelegate {
    resolvePromise: Function;
    rejectPromise: Function;

    static ObjCProtocols = [GIDSignInDelegate];
    static new(): GIDSignInDelegateImpl {
        return <GIDSignInDelegateImpl>super.new();
    }

    signInDidDisconnectWithUserWithError?(signIn: GIDSignIn, user: GIDGoogleUser, error: NSError): void {
        if (error) {
            this.rejectPromise(error.localizedDescription);
            return;
        }
        this.resolvePromise(true);
    }

    signInDidSignInForUserWithError(signIn: GIDSignIn, user: GIDGoogleUser, error: NSError): void {
        if (error) {
            this.rejectPromise(error.localizedDescription);
            return;
        }

        const googleDriveService = GTLRDriveService.new();
        googleDriveService.authorizer = user.authentication.fetcherAuthorizer();

        NativeObjectPool.remove("googleDriveService");
        NativeObjectPool.add("googleDriveService", googleDriveService);

        this.resolvePromise(new GoogleDriveHelper());
    }

    signInPresentViewController(signIn: any, viewController: any) {
        const uiview = ios.rootController;
        uiview.presentViewControllerAnimatedCompletion(
            viewController,
            true,
            null
        );
    }

    signInDismissViewController(signIn: any, viewController: any) {
        viewController.dismissViewControllerAnimatedCompletion(
            true,
            null
        );
    }

    signInWillDispatchError?(signIn: GIDSignIn, error: NSError) {
        console.log("#signInWillDispatchError()");
    }

}

export * from './google-drive.common';