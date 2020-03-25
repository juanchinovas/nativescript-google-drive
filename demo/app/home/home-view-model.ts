import { Observable } from "tns-core-modules/data/observable";
import * as applicationSetting from "tns-core-modules/application-settings";
import { GoogleDriveHelper, SPACES, FileInfo } from "nativescript-google-drive";
import { ActivityIndicator } from "tns-core-modules/ui/activity-indicator";
import { confirm } from "tns-core-modules/ui/dialogs";
//import * as  MyWorker from "nativescript-worker-loader!../test-worker";
import * as  MyWorker from "nativescript-worker-loader!nativescript-google-drive/thread-worker";

export class HomeViewModel extends Observable {
    driveHelper: GoogleDriveHelper;
    loader: ActivityIndicator;

    constructor() {
        super();
        this.onInit();
    }

    onBusyChanged(data: any) {
        this.loader = <ActivityIndicator>data.object;
        this.loader.busy = false;
    }

    onInit() {
        GoogleDriveHelper.singInOnGoogleDrive(SPACES.APP_DATA_FOLDER, MyWorker)
        .then((helper: GoogleDriveHelper) => {
            this.driveHelper = helper;
            try {
                //this.onFindFolder();
                //this.onFindFileInFolder();
                this.onListFileFromParent();
            } catch(e) {
                console.log(e);
            }
        })
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
                this.driveHelper.disconnectAccount()
                .then(done=> {
                    console.log("done.: ", done);
                })
                .catch(console.log)
            }
        });
    }

    onCreateFile() {
        this.loader.busy = true;
        const metadata: FileInfo = <FileInfo>{
            name: "back-up-test.json",
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
        .catch((a)=> {
            console.log(a);
            this.loader.busy = false;
        });
    }

    onReadFile() {
        this.loader.busy = true;
        const fileId = applicationSetting.getString("FileId");
        console.log("#fileId", fileId);
        if (fileId) {
            this.driveHelper.readFile(fileId)
            .then(file => {
                console.log(file);
                this.loader.busy = false;
            })
            .catch((a)=> {
                console.log(a);
                this.loader.busy = false;
            });
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
            .catch((a)=> {
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
            .catch((a)=> {
                console.log(a);
                this.loader.busy = false;
            });
        }
    }

    onFindFile() {
        this.loader.busy = true;
        this.driveHelper.findFile("back-up-test.json")
        .then(file => {
            console.log(file);
            applicationSetting.setString("FileId", file[0].id);
            this.loader.busy = false;
        })
        .catch((a)=> {
            console.log(a);
            this.loader.busy = false;
        });
    }

    onCreateFolder() {
        const folderMetadata: FileInfo = <FileInfo>{
            name: "config-folder",
            content: null,
            description: "A test created folder"
        };
        this.loader.busy = true;
        this.driveHelper.createFolder(folderMetadata)
        .then(folderId => {
            console.log("folderId.: ", folderId);
            applicationSetting.setString("FolderId", folderId);
            this.loader.busy = false;
        })
        .catch((a)=> {
            console.log(a);
            this.loader.busy = false;
        });
    }

    onFindFolder() {
        //this.loader.busy = true;
        this.driveHelper.findFolder("config-folder")
        .then(foldersInfo => {
            console.log(foldersInfo);
            //applicationSetting.setString("FolderId", folderId);
            //this.loader.busy = false;
        })
        .catch((a)=> {
            console.log(a);
            //this.loader.busy = false;
        });
    }

    onFindFileInFolder() {
        //this.loader.busy = true;
        const folderMetadata: FileInfo = <FileInfo>{
            name: "back-up-test.json",
            content: null,
            description: "A test create a json file",
            mimeType: "application/json",
            parentId: applicationSetting.getString("FolderId", null)
        };
        this.driveHelper.searchFiles(folderMetadata)
        .then(filesInfo => {
            console.log(filesInfo);
            //applicationSetting.setString("FolderId", folderId);
            //this.loader.busy = false;
        })
        .catch((a)=> {
            console.log(a);
            //this.loader.busy = false;
        });
    }

    onListFileFromParent() {
        //this.loader.busy = true;
        const parentFolderId = applicationSetting.getString("FolderId", null);
        this.driveHelper.listFiles(parentFolderId)
        .then(filesInfo => {
            console.log(filesInfo);
            //applicationSetting.setString("FolderId", folderId);
            //this.loader.busy = false;
        })
        .catch((a)=> {
            console.log(a);
            //this.loader.busy = false;
        });
    }
}
