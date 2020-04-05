import { android as androidContext, AndroidApplication, AndroidActivityResultEventData } from "tns-core-modules/application";
import { File, knownFolders } from "tns-core-modules/file-system";
import { IDriveManager, FileInfo, SPACES, Config, executeThread, FileInfoContent } from "./google-drive.common";
import { NativeObjectPool } from "nativescript-native-object-pool";

const REQUEST_CODE_SIGN_IN: number = 0;
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
        // @ts-ignore
        config.extraDriveScopes.push(com.google.api.services.drive.DriveScopes.DRIVE_FILE);

        return new Promise((res, rej) => {

            if (!driveHelper.isGooglePlayServicesAvailable) {
                rej("Google Play services is required for this feature, but not available on this device");
                return;
            }

            // @ts-ignore
            const signInAccount = com.google.android.gms.auth.api.signin.GoogleSignIn.getLastSignedInAccount(androidContext.context);

            if (signInAccount != null) {
                res( driveHelper.initializeDriveClient(signInAccount, config) );
                return;
            }

            const onActivityResultEvent = (eventData: AndroidActivityResultEventData) => {
                androidContext.off(AndroidApplication.activityResultEvent, onActivityResultEvent);

                if (eventData.resultCode === android.app.Activity.RESULT_OK) {

                    if (eventData.requestCode === REQUEST_CODE_SIGN_IN) {
                        // @ts-ignore
                        const accountTask = com.google.android.gms.auth.api.signin.GoogleSignIn.getSignedInAccountFromIntent(eventData.intent);
                        if (accountTask.isSuccessful()) {
                            res( driveHelper.initializeDriveClient(accountTask.getResult(), config) );
                        }
                    }
                    return;
                }
                rej(`Google Drive access request was rejected.`);
            };

            const googleSignInClient = driveHelper.authOnGoogleDriveAccount(config);
            androidContext.foregroundActivity.startActivityForResult(googleSignInClient.getSignInIntent(), REQUEST_CODE_SIGN_IN);
            androidContext.on(AndroidApplication.activityResultEvent, onActivityResultEvent);

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

            NativeObjectPool.add("parents", driveHelper.getRoot(fileInfo.parentId || __config.space));

            function createFileHelperFn(fileInfo: any, googleDriveService: any, parents: any): string {
                // @ts-ignore
                const metadata = new com.google.api.services.drive.model.File();
                metadata.setParents(parents)
                        .setName(fileInfo.name)
                        .setDescription(fileInfo.description)
                        .setMimeType(fileInfo.mimeType);

                let contentStream = null;
                let fileResult = null;
                if (fileInfo.content) {
                    // @ts-ignore
                    contentStream = com.google.api.client.http.ByteArrayContent.fromString(fileInfo.mimeType, fileInfo.content);
                    fileResult = googleDriveService.files().create(metadata, contentStream).execute();
                } else {
                    fileResult = googleDriveService.files().create(metadata).execute();
                }

                if (!fileResult) {
                    throw "File couldn't be created, Null result when requesting file creation.";
                }

                return fileResult.getId();
            }

            executeThread({
                func: createFileHelperFn,
                args: {
                    fileInfo,
                    googleDriveService: "-",
                    parents: "+"
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

            NativeObjectPool.add("parents", driveHelper.getRoot(fileInfo.parentId || __config.space));

            function updateFileHelperFn(fileInfo: FileInfoContent, googleDriveService: any, parents: any, isFile: boolean, hasUpdateMetadataPermission: boolean): boolean {
                if (!fileInfo.content) {
                    throw "The file content cannot be null ";
                }
                // @ts-ignore
                const metadata = new com.google.api.services.drive.model.File();
                if (hasUpdateMetadataPermission) {
                    metadata.setParents(parents)
                        .setName(fileInfo.name)
                        .setDescription(fileInfo.description)
                        .setMimeType(fileInfo.mimeType);
                }

                let contentStream = null;
                let fileResult = null;
                if (isFile) {
                    // @ts-ignore
                    contentStream = com.google.api.client.http.FileContent(fileInfo.mimeType, (<any>fileInfo.content)._path);
                } else {
                    // @ts-ignore
                    contentStream = com.google.api.client.http.ByteArrayContent.fromString(fileInfo.mimeType, fileInfo.content);
                }

                fileResult = googleDriveService.files().update(fileInfo.id, metadata, contentStream).execute();

                if (!fileResult) {
                    throw "File couldn't be created, Null result when requesting file creation.";
                }

                return true;
            }

            executeThread({
                func: updateFileHelperFn,
                args: {
                    fileInfo,
                    googleDriveService: "-",
                    parents: "+",
                    isFile: fileInfo.content instanceof File,
                    // @ts-ignore
                    hasUpdateMetadataPermission: __config.extraDriveScopes.indexOf(com.google.api.services.drive.DriveScopes.DRIVE_METADATA) !== -1
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
            function readFileHelperFn(driveFileId: string, googleDriveService: any): string {
                const fileResult = googleDriveService.files().get(driveFileId).executeMediaAsInputStream();
                const  reader = new java.io.BufferedReader( new java.io.InputStreamReader(fileResult));
                const builder = new java.lang.StringBuilder();
                let line: string;
                while ((line = reader.readLine()) != null) {
                    builder.append(line);
                }

                return builder.toString();
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
            function deleteFileHelperFn(driveFileId: string, googleDriveService: any): boolean {
                googleDriveService.files().delete(driveFileId).execute();
                return true;
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
                const outputStream = new java.io.FileOutputStream(path);
                googleDriveService.files().get(driveFileId).executeMediaAndDownloadTo(outputStream);

                return path;
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
     * @param {FileInfo} fileInfo file metadata
     *
     * @returns {Promise<string>} uploaded file id
     */
    uploadFile(fileInfo: FileInfo): Promise<string> {
        return new Promise((res, rej) => {
            NativeObjectPool.add("spaces", driveHelper.getRoot(fileInfo.parentId || __config.space));
            function uploadFileHelperFn(fileInfo: any, googleDriveService: any, spaces: any): string {
                // @ts-ignore
                const metadata = new com.google.api.services.drive.model.File();
                metadata.setParents(spaces)
                        .setName(fileInfo.name)
                        .setDescription(fileInfo.description)
                        .setMimeType(fileInfo.mimeType);

                let fileContent = null;
                if (typeof(fileInfo.content) !== "string" && fileInfo.content._path) {
                    // @ts-ignore
                    fileContent = new com.google.api.client.http.FileContent(fileInfo.mimeType, new java.io.File(fileInfo.content._path));
                    const fileMeta = googleDriveService.files().create(metadata, fileContent).execute();

                    if (!fileMeta) {
                        throw "File couldn't be uploaded, Null result when requesting file upload.";
                    }

                    return fileMeta.getId();
                }

                throw "File couldn't be uploaded, file info content is not a File";
            }

            executeThread({
                func: uploadFileHelperFn,
                args: {
                    fileInfo,
                    googleDriveService: "-",
                    spaces: '+'
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
            function listFilesHelperFn(parentId: any, googleDriveService: any, spaces: any): Array<FileInfo> {
                // @ts-ignore
                const query = googleDriveService.files().list()
                    .setQ(`'${parentId}' in parents`)
                    .setFields("files(id, name,size,createdTime,description,mimeType, parents)")
                    .setSpaces(parentId)
                    .execute();

                const files = query.getFiles();
                const results = [];
                for (let i = 0, len = files.size(); i < len; i++) {
                    results.push(<FileInfo>{
                        name: files.get(i).getName(),
                        description: files.get(i).getDescription(),
                        mimeType: files.get(i).getMimeType(),
                        parentId: files.get(i).getParents().toString().replace("[", "").replace("]", ""),
                        id: files.get(i).getId(),
                        size: files.get(i).getSize() && files.get(i).getSize().floatValue() || 0,
                        createdTime: new Date(Number(files.get(i).getCreatedTime().getValue()))
                    });
                }
                return results;
            }

            executeThread({
                func: listFilesHelperFn,
                args: {
                    parentId: (parentId || __config.space),
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
            fileInfo.parentId = fileInfo.parentId || __config.space;
            function searchFilesHelperFn(fileInfo: any, googleDriveService: any, spaces: any): Array<FileInfo> {
                let queryString = `'${fileInfo.parentId}' in parents`;
                for (let key in fileInfo) {
                    if (fileInfo[key] && ["parentId", "description"].indexOf(key) === -1) {
                        queryString +=  ` and ${key} = '${fileInfo[key]}'`;
                    }
                }

                const query = googleDriveService.files().list()
                    .setQ(queryString)
                    .setFields("files(id,name,size,createdTime,description,mimeType,parents)")
                    .setSpaces(spaces)
                    .execute();

                const files = query.getFiles();
                const result = [];
                for (let i = 0, len = files.size(); i < len; i++) {
                    result.push(<FileInfo> Object.freeze({
                        name: files.get(i).getName(),
                        description: files.get(i).getDescription(),
                        mimeType: files.get(i).getMimeType(),
                        parentId: files.get(i).getParents().toString().replace("[", "").replace("]", ""),
                        id: files.get(i).getId(),
                        size: files.get(i).getSize() && files.get(i).getSize().floatValue() || 0,
                        createdTime: new Date(Number(files.get(i).getCreatedTime().getValue()))
                    }));
                }

                return result;
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
            NativeObjectPool.add("roots", driveHelper.getRoot(fileInfo.parentId || __config.space));
            function searchFilesHelperFn(fileInfo: any, googleDriveService: any, roots: any): string {
                // @ts-ignore
                const metadata = new com.google.api.services.drive.model.File();
                metadata.setParents(roots)
                        .setName(fileInfo.name)
                        .setDescription(fileInfo.description)
                        .setMimeType("application/vnd.google-apps.folder");


                const fileResult = googleDriveService.files().create(metadata).execute();

                if (!fileResult) {
                    throw ("Folder couldn't be created, Null result when requesting folder creation.");
                }

                return fileResult.getId();
            }

            executeThread({
                func: searchFilesHelperFn,
                args: {
                    fileInfo,
                    googleDriveService: "-",
                    roots: "+"
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
            NativeObjectPool.add("spaces", driveHelper.getRoot(__config.space));
            function findFolderHelperFn(name: any, googleDriveService: any, spaces: string): Array<FileInfo> {
                let queryString = `name = '${name}' and mimeType ='application/vnd.google-apps.folder'`;
                const query = googleDriveService.files().list()
                    .setQ(queryString)
                    .setFields("files(id,name,size,createdTime,description,mimeType,parents)")
                    .setSpaces(spaces)
                    .execute();

                const files = query.getFiles();
                const result = [];
                for (let i = 0, len = files.size(); i < len; i++) {
                    result.push(<FileInfo> Object.freeze({
                        name: files.get(i).getName(),
                        description: files.get(i).getDescription(),
                        parentId: files.get(i).getParents().toString().replace("[", "").replace("]", ""),
                        id: files.get(i).getId(),
                        createdTime: new Date(Number(files.get(i).getCreatedTime().getValue()))
                    }));
                }
                return result;
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
                const googleSignInClient = driveHelper.authOnGoogleDriveAccount(__config);
                googleSignInClient.signOut();
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
 * Authenticate the user on google drive account
 *
 * @returns {com.google.android.gms.auth.api.signin.GoogleSignInClient}
 */
// @ts-ignore
driveHelper.authOnGoogleDriveAccount = function(config: Config): com.google.android.gms.auth.api.signin.GoogleSignInClient {
    const mappedScope = config.extraDriveScopes.map(scope => {
        // @ts-ignore
        return new com.google.android.gms.common.api.Scope(scope);
    });
    // @ts-ignore
    const DEFAULT_SIGN_IN = com.google.android.gms.auth.api.signin.GoogleSignInOptions.DEFAULT_SIGN_IN;
    // @ts-ignore
    const signInOptions = new com.google.android.gms.auth.api.signin.GoogleSignInOptions.Builder(DEFAULT_SIGN_IN)
        .requestScopes(mappedScope.shift(), mappedScope)
        .requestEmail()
        .build();

    // @ts-ignore
    const googleSignInClient = com.google.android.gms.auth.api.signin.GoogleSignIn.getClient(androidContext.startActivity, signInOptions);
    return googleSignInClient;
};

/**
 * Initialize a drive client
 *
 * @param {com.google.android.gms.auth.api.signin.GoogleSignInAccount} signInAccount
 * @param {Config} config
 *
 * @returns {GoogleDriveHelper} Google drive helper
 */
// @ts-ignore
driveHelper.initializeDriveClient = function (signInAccount: com.google.android.gms.auth.api.signin.GoogleSignInAccount, config: Config) {
    // @ts-ignore
    const credential = com.google.api.client.googleapis.extensions.android.gms.auth.GoogleAccountCredential
    // @ts-ignore
    .usingOAuth2(androidContext.context, java.util.Collections.singleton(driveHelper.getScope(config.space)));
        credential.setSelectedAccount(signInAccount.getAccount());
    // @ts-ignore
    const googleDriveService = new com.google.api.services.drive.Drive.Builder(
        // @ts-ignore
        com.google.api.client.extensions.android.http.AndroidHttp.newCompatibleTransport(),
        // @ts-ignore
        new com.google.api.client.json.gson.GsonFactory(), credential)
        .setApplicationName(androidContext.packageName)
        .build();

    NativeObjectPool.remove("googleDriveService");
    NativeObjectPool.add("googleDriveService", googleDriveService);

    __config = config;

    return new GoogleDriveHelper();
};

/**
 * Check if google play services are available in the device
 *
 * @returns {boolean} if Google play services are available or not
 */
driveHelper.isGooglePlayServicesAvailable = function() {
    const ctx = androidContext.foregroundActivity || androidContext.startActivity;
    // @ts-ignore
    const googleApiAvailability = com.google.android.gms.common.GoogleApiAvailability.getInstance();
    // @ts-ignore
    const playServiceStatusSuccess = com.google.android.gms.common.ConnectionResult.SUCCESS;
    const playServicesStatus = googleApiAvailability.isGooglePlayServicesAvailable(ctx);
    const available = playServicesStatus === playServiceStatusSuccess;
    if (!available && googleApiAvailability.isUserResolvableError(playServicesStatus)) {
      // show a dialog offering the user to update (no need to wait for it to finish)
      googleApiAvailability.showErrorDialogFragment(ctx, playServicesStatus, 1, new android.content.DialogInterface.OnCancelListener({
        onCancel: dialogInterface => {
          console.log("Canceled");
        }
      }));
    }
    return available;
};

/**
 * Return the root parent in the drive to add, get or delete a file or folder
 *
 * @param {string} parentId parent id is optional
 *
 * @returns {java.util.List<string>} a collection of string
 */
driveHelper.getRoot = function(parentId?: string): java.util.List<string> {
    let root: java.util.List<string>;
    if (parentId == null) {
        root = java.util.Collections.singletonList("root");
    } else {
        root = java.util.Collections.singletonList(parentId);
    }

    return root;
};

/**
 * Determine which google drive scope use
 *
 * @param {SPACES} space selected scope
 *
 * @returns {string} Google drive scope
 */
driveHelper.getScope = function(space: SPACES) {
    return space === SPACES.DRIVE ?
        // @ts-ignore
        com.google.api.services.drive.DriveScopes.DRIVE :
        // @ts-ignore
        com.google.api.services.drive.DriveScopes.DRIVE_APPDATA;
};

export * from './google-drive.common';