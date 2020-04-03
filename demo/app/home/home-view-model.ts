import { Observable } from "tns-core-modules/data/observable";
import * as applicationSetting from "tns-core-modules/application-settings";
import { isIOS } from "tns-core-modules/platform";
import { GoogleDriveHelper, SPACES, FileInfoContent, FileInfo, Config } from "nativescript-google-drive";
import { ActivityIndicator } from "tns-core-modules/ui/activity-indicator";
import { confirm } from "tns-core-modules/ui/dialogs";
// import * as  MyWorker from "nativescript-worker-loader!../test-worker";
// @ts-ignore
import * as  MyWorker from "nativescript-worker-loader!nativescript-google-drive/thread-worker";

export class HomeViewModel extends Observable {
    driveHelper: GoogleDriveHelper;
    loader: ActivityIndicator;


    constructor() {
        super();
        this.set("files", []);
        this.onInit();
    }

    onBusyChanged(data: any) {
        this.loader = <ActivityIndicator>data.object;
        this.loader.busy = false;
    }

    onInit() {
        // Android only
        const config: Config = {
            space: SPACES.APP_DATA_FOLDER,
            worker: MyWorker
        };
        // iOS need the extra clientID
        if (isIOS) {
            const googleClientID = "680729366979-1bf7aoceaf52ijj7k8fmcbavbstvbbcm.apps.googleusercontent.com";
            config.clientId = googleClientID;
        }

        GoogleDriveHelper.singInOnGoogleDrive(config)
        .then((helper: GoogleDriveHelper) => {
            this.driveHelper = helper;
            try {
                //this.onFindFolder();
                //this.onFindFileInFolder();
                this.onListFileFromParent();
            } catch (e) {
                console.log(e);
            }
        })
        .catch(console.log);
    }


    onPressToDisconnect() {
        let options = {
            title: "Select",
            message: "Are you sure you want disconnect the google account?",
            okButtonText: "Yes",
            cancelButtonText: "No"
        };

        confirm(options).then((result: boolean) => {
            if (result) {
                this.driveHelper.signOut()
                .then(done => {
                    console.log("done.: ", done);
                })
                .catch(console.log);
            }
        });
    }

    onCreateFile() {
        this.loader.busy = true;
        const name = isIOS && "ios-back-up-test.json" || "android-back-up-test.json";
        const metadata: FileInfoContent = <FileInfoContent>{
            name,
            content: `
            {
                "name": "J. novas",
                "lastName": "Novas",
            }
            `,
            description: "A test create a json file",
            mimeType: "application/json",
            parentId: applicationSetting.getString("FolderId", null)
        };

        this.driveHelper.createFile(metadata)
        .then(id => {
            console.log("#file-metadata(id)", id);
            applicationSetting.setString("FileId", id);

            this.loader.busy = false;
        })
        .catch((a) => {
            console.log(a);
            this.loader.busy = false;
        });
    }

    onReadFile() {
        this.loader.busy = true;
        const fileId = applicationSetting.getString("FileId");
        console.log("#fileId", fileId);
        if (fileId) {
            this.driveHelper.readFileContent(fileId)
            .then(file => {
                console.log(file);
                this.loader.busy = false;
            })
            .catch((a) => {
                console.log(a);
                this.loader.busy = false;
            });
        } else {
            this.loader.busy = false;
        }
    }

    onDownloadFile() {
        this.loader.busy = true;
        const fileId = applicationSetting.getString("FileId");
        console.log("#fileId", fileId);
        if (fileId) {
            this.driveHelper.downloadFile(fileId)
            .then(file => {
                console.log(file);
                file.readText()
                .then((res) => {
                    console.log(res);
                }).catch((err) => {
                    console.log(err.stack);
                });
                this.loader.busy = false;
            })
            .catch((a) => {
                console.log(a);
                this.loader.busy = false;
            });
        }
    }

    onDeleteFile() {
        this.loader.busy = true;
        const fileId = applicationSetting.getString("FileId");
        console.log("#fileId", fileId);
        if (fileId) {
            this.driveHelper.deleteFile(fileId)
            .then(file => {
                console.log(file);
                this.loader.busy = false;
            })
            .catch((a) => {
                console.log(a);
                this.loader.busy = false;
            });
        }
    }

    onFindFile() {
        this.loader.busy = true;
        const name = isIOS && "ios-back-up-test.json" || "android-back-up-test.json";
        this.driveHelper.searchFiles({
            name
        })
        .then(file => {
            console.log(file);
            if (file.length) {
                applicationSetting.setString("FileId", file[0].id);
            }
            this.loader.busy = false;
        })
        .catch((a) => {
            console.log(a);
            this.loader.busy = false;
        });
    }

    onUpdateFile() {
        this.loader.busy = true;
        const name = isIOS && "ios-back-up-test.json" || "android-back-up-test.json";
        const metadata: FileInfoContent = <FileInfoContent>{
            name,
            content: `
            {
                "name": "J. novas",
                "lastName": "Novas",
                "nameOfFile": ${name},
                "date": '${new Date()}',
            }`,
            description: "A test create a json file " + new Date(),
            mimeType: "application/json",
            parentId: applicationSetting.getString("FolderId", null),
            id: applicationSetting.getString("FileId", null)
        };

        this.driveHelper.updateFile(metadata)
        .then((done: boolean) => {
            console.log("#updateFile()", done);

            this.loader.busy = false;
        })
        .catch((a) => {
            console.log(a);
            this.loader.busy = false;
        });
    }

    onCreateFolder() {
        const folderMetadata: FileInfo = <FileInfo>{
            name: "config-folder",
            description: "A test created folder"
        };
        this.loader.busy = true;
        this.driveHelper.createFolder(folderMetadata)
        .then(folderId => {
            console.log("folderId.: ", folderId);
            applicationSetting.setString("FolderId", folderId);
            this.loader.busy = false;
        })
        .catch((a) => {
            console.log(a);
            this.loader.busy = false;
        });
    }

    onFindFolder() {
        // this.loader.busy = true;
        this.driveHelper.findFolder("config-folder")
        .then(foldersInfo => {
            console.log(foldersInfo);
            // applicationSetting.setString("FolderId", folderId);
            // this.loader.busy = false;
        })
        .catch((a) => {
            console.log(a);
            // this.loader.busy = false;
        });
    }

    onFindFileInFolder() {
        // this.loader.busy = true;
        const name = isIOS && "ios-back-up-test.json" || "android-back-up-test.json";
        const folderMetadata: FileInfo = <FileInfo>{
            name,
            description: "A test create a json file",
            mimeType: "application/json",
            parentId: applicationSetting.getString("FolderId", null)
        };
        this.driveHelper.searchFiles(folderMetadata)
        .then(filesInfo => {
            console.log(filesInfo);
            // applicationSetting.setString("FolderId", folderId);
            // this.loader.busy = false;
        })
        .catch((a) => {
            console.log(a);
            // this.loader.busy = false;
        });
    }

    onListFileFromParent() {
        // this.loader.busy = true;
        const parentFolderId = applicationSetting.getString("FolderId", null);
        this.driveHelper.listFilesByParent(parentFolderId)
        .then(filesInfo => {
            this.set("files", filesInfo);
            //console.log(filesInfo);
            // applicationSetting.setString("FolderId", folderId);
            // this.loader.busy = false;
        })
        .catch((a) => {
            console.log(a);
            // this.loader.busy = false;
        });
    }
}
