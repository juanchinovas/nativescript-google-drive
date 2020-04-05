import { Observable } from "tns-core-modules/data/observable";
import * as applicationSetting from "tns-core-modules/application-settings";
import { isIOS } from "tns-core-modules/platform";
import { GoogleDriveHelper, SPACES, FileInfoContent, FileInfo, Config } from "nativescript-google-drive";
import { confirm, action, alert, prompt, PromptResult, inputType, capitalizationType, PromptOptions } from "tns-core-modules/ui/dialogs";
import { ItemEventData } from "tns-core-modules/ui/list-view";
// import * as  MyWorker from "nativescript-worker-loader!../test-worker";
// @ts-ignore
import * as  MyWorker from "nativescript-worker-loader!nativescript-google-drive/thread-worker";

export class HomeViewModel extends Observable {
    driveHelper: GoogleDriveHelper;

    constructor() {
        super();
        this.set("files", []);
        this.set("isLoading", true);
        this.set("isSignedIn", false);
        setTimeout(() => {
            this.onInit();
        }, 3000);
    }

    onInit() {
        const config: Config = {
            space: SPACES.APP_DATA_FOLDER,
            worker: MyWorker
        };
        // iOS need this extra the clientID
        if (isIOS) {
            const googleClientID = "680729366979-1bf7aoceaf52ijj7k8fmcbavbstvbbcm.apps.googleusercontent.com";
            config.clientId = googleClientID;
        }

        GoogleDriveHelper.signInOnGoogleDrive(config)
        .then((helper: GoogleDriveHelper) => {
            this.driveHelper = helper;
            this.set("isSignedIn", true);
            this.onListFileFromParent();
        })
        .catch((err) => {
            this.set("isLoading", false);
            this.set("isSignedIn", false);
            alert(err).then(() => {
                console.log(err);
            });
        });
    }

    onAccionShow(event: ItemEventData) {
        const files = <Array<FileInfo>>this.get("files");
        const index = event.index;
        const fileInfo: FileInfo = files[index];
        this.__showOption(fileInfo);
    }

    onPressToDisconnect() {
        let options = {
            title: "Confirm",
            message: "Are you sure you want disconnect the google account?",
            okButtonText: "Yes",
            cancelButtonText: "No"
        };

        confirm(options).then((result: boolean) => {
            if (result) {
                this.set("isLoading", true);
                this.driveHelper.signOut()
                .then(done => {
                    console.log("done.: ", done);
                    if (done) {
                        this.set("isLoading", false);
                        this.set("isSignedIn", false);
                        this.set("files", []);
                    }
                })
                .catch(err => {
                    console.log(err);
                    this.set("isLoading", false);
                });
            }
        });
    }

    onCreateFileEvent() {
        this.__actionOption("Create file", null);
    }

    onCreateFile(fileInfo: FileInfo, name: string) {
        this.set("isLoading", true);
        const _name = isIOS && (name || "ios-back-up-test.json") || (name || "android-back-up-test.json");
        const metadata: FileInfoContent = <FileInfoContent>{
            name: _name,
            content: `
            {
                "name": "A file Name",
                "lastName": "A file lastname?"
            }
            `,
            description: "A test create a json file",
            mimeType: "application/json",
            parentId: fileInfo && fileInfo.parentId || null
        };

        this.driveHelper.createFile(metadata)
        .then(id => {
            console.log("#file-metadata(id)", id);
            alert(id).then(d => {
                if (id) {
                    this.onListFileFromParent();
                } else {
                    this.set("isLoading", false);
                }
            });
        })
        .catch((a) => {
            console.log(a);
            this.set("isLoading", false);
        });
    }

    onReadFile(fileInfo: FileInfo) {
        this.set("isLoading", true);
        console.log("#fileId", fileInfo.id);
        this.driveHelper.readFileContent(fileInfo.id)
        .then(file => {
            alert(file);
            this.set("isLoading", false);
        })
        .catch((a) => {
            console.log(a);
            this.set("isLoading", false);
        });
    }

    onDownloadFile() {
        this.set("isLoading", true);
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
                this.set("isLoading", false);
            })
            .catch((a) => {
                console.log(a);
                this.set("isLoading", false);
            });
        }
    }

    onDeleteFile(fileInfo: FileInfo) {
        let options = {
            title: "Confirm",
            message: `Are you sure you want to delete ${fileInfo.name}?`,
            okButtonText: "Yes",
            cancelButtonText: "No"
        };

        confirm(options).then((result: boolean) => {
            if (result) {
                this.set("isLoading", true);
                console.log("#fileId", fileInfo.id);
                this.driveHelper.deleteFile(fileInfo.id)
                .then(done => {
                    alert(done).then(d => {
                        if (done) {
                            this.onListFileFromParent();
                        } else {
                            this.set("isLoading", false);
                        }
                    });
                })
                .catch((a) => {
                    console.log(a);
                    this.set("isLoading", false);
                });
            }
        });
    }

    onFindFile() {
        this.set("isLoading", true);
        const name = isIOS && "ios-back-up-test.json" || "android-back-up-test.json";
        this.driveHelper.searchFiles({
            name
        })
        .then(file => {
            console.log(file);
            if (file.length) {
                applicationSetting.setString("FileId", file[0].id);
            }
            this.set("isLoading", false);
        })
        .catch((a) => {
            console.log(a);
            this.set("isLoading", false);
        });
    }

    onUpdateFile(fileInfo: FileInfo) {
        this.set("isLoading", true);
        const name = isIOS && "ios-back-up-test.json" || "android-back-up-test.json";
        const metadata: FileInfoContent = <FileInfoContent>{
            name,
            content: `
            {
                "name": "J. novas",
                "lastName": "Novas",
                "nameOfFile": ${name},
                "parentId: '${fileInfo.id}'
                "date": '${new Date()}',
            }`,
            description: "A test create a json file " + new Date(),
            mimeType: "application/json",
            parentId: fileInfo && fileInfo.parentId || null,
            id: fileInfo && fileInfo.id || null
        };

        this.driveHelper.updateFile(metadata)
        .then((done: boolean) => {
            console.log("#updateFile()", done);
            alert(done);
            this.set("isLoading", false);
        })
        .catch((a) => {
            console.log(a);
            this.set("isLoading", false);
        });
    }

    onCreateFolderEvent() {
        this.__actionOption("Create folder", null);
    }

    onCreateFolder(fileInfo: FileInfo, name: string) {
        this.set("isLoading", true);
        const folderMetadata: FileInfo = <FileInfo>{
            name: name || "config-folder",
            description: "A created folder",
            parentId: fileInfo && fileInfo.parentId || null
        };
        console.log(name);
        this.driveHelper.createFolder(folderMetadata)
        .then(folderId => {
            console.log("folderId.: ", folderId);
            alert(folderId).then(d => {
                if (folderId) {
                    this.onListFileFromParent();
                } else {
                    this.set("isLoading", false);
                }
            });
        })
        .catch((a) => {
            console.log(a);
            this.set("isLoading", false);
        });
    }

    onFindFolder() {
        this.set("isLoading", true);
        this.driveHelper.findFolder("config-folder")
        .then(foldersInfo => {
            console.log(foldersInfo);
            // applicationSetting.setString("FolderId", folderId);
            this.set("isLoading", false);
        })
        .catch((a) => {
            console.log(a);
            this.set("isLoading", false);
        });
    }

    onFindFileInFolder(fileInfo: FileInfo) {
        this.set("isLoading", true);
        const folderMetadata: FileInfo = <FileInfo>{
            parentId: fileInfo && fileInfo.id || null
        };
        this.driveHelper.searchFiles(folderMetadata)
        .then(filesInfo => {
            if (filesInfo.length) {
                let options = {
                    title: "Files found",
                    actions: filesInfo.map(a => a.name)
                };
        
                action(options).then((op) => {
                    this.__showOption(filesInfo.find(f => f.name === op));
                });
            } else {
                alert("No files found");
            }
            this.set("isLoading", false);
        })
        .catch((a) => {
            console.log(a);
            this.set("isLoading", false);
        });
    }

    onListFileFromParent() {
        this.set("isLoading", true);
        this.driveHelper.listFilesByParent()
        .then(filesInfo => {
            this.set("files", filesInfo);
            this.set("isLoading", false);
        })
        .catch((a) => {
            console.log(a);
            this.set("isLoading", false);
        });
    }

    __showOption(fileInfo: FileInfo) {
        const folderActions = ["Delete", "Create file", "Create folder", "List file"];
        const fileActions = ["Read content", "Delete", "Update content"];
        let actions = fileActions;

        if (fileInfo.mimeType === "application/vnd.google-apps.folder") {
            actions = folderActions;
        }
        let options = {
            title: `Action on ${fileInfo.name}`,
            message: "Choose action",
            cancelButtonText: "Cancel",
            actions
        };

        action(options).then((result) => {
            this.__actionOption(result, fileInfo);
        });
    }

    __actionOption(result: string, fileInfo: FileInfo) {
        if (result === "Delete") {
            this.onDeleteFile(fileInfo);
        }
        if (result === "Create file") {
            let options: PromptOptions = {
                title: result,
                message: "Enter your name",
                okButtonText: "OK",
                cancelButtonText: "Cancel",
                cancelable: false,
                inputType: inputType.text,
                capitalizationType: capitalizationType.sentences
            };
            
            prompt(options).then((result: PromptResult) => {
                if (result.result)
                    this.onCreateFile(fileInfo, result.text);
            });
        }
        if (result === "List file") {
            this.onFindFileInFolder(fileInfo);
        }
        if (result === "Read content") {
            this.onReadFile(fileInfo);
        }
        if (result === "Update content") {
            this.onUpdateFile(fileInfo);
        }
        if (result === "Create folder") {
            let options: PromptOptions = {
                title: result,
                message: "Enter your name",
                okButtonText: "OK",
                cancelButtonText: "Cancel",
                cancelable: false,
                inputType: inputType.text,
                capitalizationType: capitalizationType.sentences
            };
            
            prompt(options).then((result: PromptResult) => {
                if(result.result)
                    this.onCreateFolder(fileInfo, result.text);
            });
        }
    }

    isNotSignedInAndNotLoading(): boolean {
        return !this.get("isLoading") && !this.get("isSignedIn");
    }

    isSignedInAndNotLoading(): boolean {
        return !this.get("isLoading") && this.get("isSignedIn");
    }
}
