import { android as androidContext, AndroidApplication, AndroidActivityResultEventData } from "tns-core-modules/application";
import { File, knownFolders } from "tns-core-modules/file-system";
import { IDriveManager, FileInfo, SPACES, Config } from "./google-drive.common";
import { NativeObjectPool } from "nativescript-native-object-pool";

const REQUEST_CODE_SIGN_IN: number = 0;
let WorkerThread: Worker;
let driveSpace: SPACES;
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
                rej(`Google Drive access request was rejected. resultCode:${eventData.resultCode}`);
            };

            const googleSignInClient = driveHelper.authOnGoogleDriveAccount(config.space);
            androidContext.foregroundActivity.startActivityForResult(googleSignInClient.getSignInIntent(), REQUEST_CODE_SIGN_IN);
            androidContext.on(AndroidApplication.activityResultEvent, onActivityResultEvent);

        });
    }

    /**
     * Create a file with the specific metadata in Google Drive
     *
     * @param {FileInfo} fileInfo file metadata
     *
     * @returns {Promise<string>} created file id
     */
    createFile(fileInfo: FileInfo): Promise<string> {
        return new Promise((res, rej) => {
            fileInfo.mimeType = fileInfo.mimeType || "text/plain";

            NativeObjectPool.add("parent", driveHelper.getRoot(fileInfo.parentId || driveSpace));

            function createFileHelperFn(fileInfo: any, googleDriveService: any, parent: any): string {
                // @ts-ignore
                const metadata = new com.google.api.services.drive.model.File();
                metadata.setParents(parent)
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
                    parent: "+"
                }
            }, res, rej);
        });
    }

    /**
     * Read a text plain file
     * @param {string} driveFileId
     *
     * @returns {Promise<string>} text contained in the file
     */
    readFile(driveFileId: string): Promise<string> {
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
                }
            }, res, rej);
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
                }
            }, res, rej);
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
                }
            }, (result: any) => {
                res(File.fromPath(result));
            }, rej);
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

            NativeObjectPool.add("spaces", driveHelper.getRoot(fileInfo.parentId || driveSpace));
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
                }
            }, res, rej);

         });
    }

    /**
     * List all the files contained in the parent or root folder
     * @param {string} parentId parent folder OPTIONAL
     *
     * @returns {Promise<Array<FileInfo>>} file list
     */
    listFiles(parentId?:  string): Promise<Array<FileInfo>> {
        return new Promise((res, rej) => {

            NativeObjectPool.add("spaces", driveHelper.getRoot(driveSpace));
            function listFilesHelperFn(parentId: any, googleDriveService: any, spaces: any): Array<FileInfo> {
                // @ts-ignore
                const query = googleDriveService.files().list()
                    .setQ(`'${parentId || 'root'}' in parents`)
                    .setFields("files(id, name,size,createdTime,description,mimeType, parents)")
                    .setSpaces(spaces)
                    .execute();

                const files = query.getFiles();
                const result = [];
                for (let i = 0, len = files.size(); i < len; i++) {
                    result.push(<FileInfo>{
                        content: null,
                        name: files.get(i).getName(),
                        description: files.get(i).getDescription(),
                        mimeType: files.get(i).getMimeType(),
                        parentId: files.get(i).getParents().toString().replace("[","").replace("]",""),
                        id: files.get(i).getId(),
                        size: files.get(i).getSize().floatValue(),
                        createdTime: new Date(Number(files.get(i).getCreatedTime().getValue()))
                    });
                }

                return result;
            };

            executeThread({
                func: listFilesHelperFn,
                args:{
                    parentId: (parentId || null),
                    googleDriveService: "-",
                    spaces: "+"
                }
            }, res, rej);
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
            NativeObjectPool.add("spaces", driveHelper.getRoot(driveSpace));
            function searchFilesHelperFn(fileInfo: any, googleDriveService: any, spaces: any): Array<FileInfo> {
                let queryString = `'${fileInfo.parentId || 'root'}' in parents`;
                for (let key in fileInfo) {
                    if (fileInfo[key] && ["parentId", "content", "description"].indexOf(key) === -1) {
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
                        content: null,
                        name: files.get(i).getName(),
                        description: files.get(i).getDescription(),
                        mimeType: files.get(i).getMimeType(),
                        parentId: files.get(i).getParents().toString().replace("[","").replace("]",""),
                        id: files.get(i).getId(),
                        size: files.get(i).getSize().floatValue(),
                        createdTime: new Date(Number(files.get(i).getCreatedTime().getValue()))
                    }));
                }
                
                return result;
            }
            executeThread({
                func: searchFilesHelperFn,
                args:{
                    fileInfo,
                    googleDriveService: "-",
                    spaces: "+"
                }
            }, res, rej);
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
            NativeObjectPool.add("roots", driveHelper.getRoot(fileInfo.parentId || driveSpace));
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
            };

            executeThread({
                func: searchFilesHelperFn,
                args: {
                    fileInfo,
                    googleDriveService: "-",
                    roots: "+"
                }
            }, res, rej);
        });
    }

    /**
     * Find files by name and mime type.
     *
     * @param {string} name
     * @param {string} mimeType
     *
     * @returns {Promise<Array<FileInfo>>} file list
     */
    findFile(name: string, mimeType?: string): Promise<Array<FileInfo>> {
        return new Promise((res, rej) => {
            NativeObjectPool.add("spaces", driveHelper.getRoot(driveSpace));
            function findFileHelperFn(name: any, mimeType: any, googleDriveService: any, spaces: any): Array<FileInfo> {
                let queryString = `name = '${name}' ${ ( mimeType ? "and mimeType ='${mimeType}'" : '' ) }`;

                const query = googleDriveService.files().list()
                    .setQ(queryString)
                    .setFields("files(id, name,size,createdTime,description,mimeType, parents)")
                    .setSpaces(spaces)
                    .execute();

                const files = query.getFiles();
                const result = [];
                for (let i = 0, len = files.size(); i < len; i++) {
                    result.push(<FileInfo> Object.freeze({
                        content: null,
                        name: files.get(i).getName(),
                        description: files.get(i).getDescription(),
                        mimeType: files.get(i).getMimeType(),
                        parentId: files.get(i).getParents().toString().replace("[","").replace("]",""),
                        id: files.get(i).getId(),
                        size: files.get(i).getSize().floatValue(),
                        createdTime: new Date(Number(files.get(i).getCreatedTime().getValue()))
                    }));
                }
                return result;
            };
            executeThread({
                func: findFileHelperFn,
                args: {
                    name,
                    mimeType: (mimeType || null),
                    googleDriveService: "-",
                    spaces: "+"
                }
            }, res, rej);
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
            NativeObjectPool.add("spaces", driveHelper.getRoot(driveSpace));
            function findFolderHelperFn(name: any, googleDriveService: any, spaces: any): Array<FileInfo> {
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
                        content: null,
                        name: files.get(i).getName(),
                        description: files.get(i).getDescription(),
                        parentId: files.get(i).getParents().toString().replace("[","").replace("]",""),
                        id: files.get(i).getId(),
                        createdTime: new Date(Number(files.get(i).getCreatedTime().getValue()))
                    }));
                }
                return result;
            }
            
            executeThread({
                func: findFolderHelperFn,
                args:{
                    name,
                    googleDriveService: "-",
                    spaces: "+"
                }
            }, res, rej);
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
                const googleSignInClient = driveHelper.authOnGoogleDriveAccount(driveSpace);
                googleSignInClient.signOut();
                res(true);
            } catch(e) {
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
driveHelper.authOnGoogleDriveAccount = function(space: SPACES): com.google.android.gms.auth.api.signin.GoogleSignInClient {
    // @ts-ignore
    const DEFAULT_SIGN_IN = com.google.android.gms.auth.api.signin.GoogleSignInOptions.DEFAULT_SIGN_IN;
    // @ts-ignore
    const mainScope = new com.google.android.gms.common.api.Scope(driveHelper.getScope(space));
    // @ts-ignore
    const fileScope = new com.google.android.gms.common.api.Scope(com.google.api.services.drive.DriveScopes.DRIVE_FILE);
    // @ts-ignore
    const signInOptions = new com.google.android.gms.auth.api.signin.GoogleSignInOptions.Builder(DEFAULT_SIGN_IN)
        .requestScopes(mainScope, [mainScope, fileScope])
        .requestEmail()
        .build();

    // @ts-ignore
    const googleSignInClient = com.google.android.gms.auth.api.signin.GoogleSignIn.getClient(androidContext.startActivity, signInOptions);
    return googleSignInClient;
}

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

    WorkerThread = config.worker;
    driveSpace = config.space;

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

/**
 * Prepare the data and function to sent to the 
 * second thread to be executed and used
 */
driveHelper.prepareThreadData = function(data: any) {
    const reg = /\s+(?=typeof|function|const|let|if|new|throw|return|\.|\[|\]|\{|\}|;)|(\n+|\r+)|\/\/.*/img;
    data.func = data.func && data.func.toString().replace(reg, "") || null;
    return data;
};

/**
 * Create an worker thread and send data to it
 * @param {any} data 
 * @param {Function} res 
 * @param {Function} rej 
 */
function executeThread(data: any, res: Function, rej: Function) {
    // @ts-ignore
    const worker = new WorkerThread();

    worker.postMessage(driveHelper.prepareThreadData(data));

    worker.onmessage = (msg: MessageEvent) => {
        worker.terminate();
        res(msg.data);
    };
    worker.onerror = (err: ErrorEvent)=> {
        worker.terminate();
        rej(err.message);
    };
}

export * from './google-drive.common';