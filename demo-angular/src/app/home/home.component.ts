import { Component, OnInit, AfterViewInit,  } from "@angular/core";
import { isIOS } from "tns-core-modules/platform";
import { GoogleDriveHelper, SPACES, FileInfoContent, FileInfo, Config } from "nativescript-google-drive";
import { confirm, action, alert, prompt, PromptResult, inputType, capitalizationType, PromptOptions } from "tns-core-modules/ui/dialogs";
import { ItemEventData } from "tns-core-modules/ui/list-view";
// @ts-ignore
import * as  MyWorker from "nativescript-worker-loader!nativescript-google-drive/thread-worker";

@Component({
    selector: "ns-home",
    moduleId: module.id,
    templateUrl: "./home.component.html"
})
export class HomeComponent implements OnInit, AfterViewInit {
    
    private driveHelper: GoogleDriveHelper;
    files: Array<FileInfo> = [];
    isLoading = true;
    isSignedIn = false;
    
    constructor() { }

    ngOnInit(): void {
    }

    ngAfterViewInit(): void {
        this.onInit();
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
            this.isSignedIn=true;
            this.isLoading=false;
            this.onListFileFromParent();
        })
        .catch((err) => {
            console.log(err);
            this.isLoading=false;
            this.isSignedIn=false;
            setTimeout(() => {
                alert(err);
            }, 100);
        });
    }

    onAccionShow(event: ItemEventData) {
        const files = <Array<FileInfo>>this.files;
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
                this.isLoading=true;
                this.driveHelper.signOut()
                .then(done => {
                    console.log("done.: ", done);
                    if (done) {
                        this.isLoading=false;
                        this.isSignedIn=false;
                        this.files.length = 0;
                    }
                })
                .catch(err => {
                    console.log(err);
                    this.isLoading=false;
                });
            }
        });
    }

    onCreateFileEvent() {
        this.__actionOption("Create file", null);
    }

    onCreateFile(fileInfo: FileInfo, name: string) {
        this.isLoading=true;
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
                    this.isLoading=false;
                }
            });
        })
        .catch((a) => {
            console.log(a);
            this.isLoading=false;
        });
    }

    onReadFile(fileInfo: FileInfo) {
        this.isLoading=true;
        console.log("#fileId", fileInfo.id);
        this.driveHelper.readFileContent(fileInfo.id)
        .then(file => {
            alert(file);
            this.isLoading=false;
        })
        .catch((a) => {
            console.log(a);
            this.isLoading=false;
        });
    }

    onDownloadFile(fileId) {
        this.isLoading=true;
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
                this.isLoading=false;
            })
            .catch((a) => {
                console.log(a);
                this.isLoading=false;
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
                this.isLoading=true;
                console.log("#fileId", fileInfo.id);
                this.driveHelper.deleteFile(fileInfo.id)
                .then(done => {
                    alert(done).then(d => {
                        if (done) {
                            this.onListFileFromParent();
                        } else {
                            this.isLoading=false;
                        }
                    });
                })
                .catch((a) => {
                    console.log(a);
                    this.isLoading=false;
                });
            }
        });
    }

    onFindFile() {
        this.isLoading=true;
        const name = isIOS && "ios-back-up-test.json" || "android-back-up-test.json";
        this.driveHelper.searchFiles({
            name
        })
        .then(file => {
            console.log(file);
            this.isLoading=false;
        })
        .catch((a) => {
            console.log(a);
            this.isLoading=false;
        });
    }

    onUpdateFile(fileInfo: FileInfo) {
        this.isLoading=true;
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
            this.isLoading=false;
        })
        .catch((a) => {
            console.log(a);
            this.isLoading=false;
        });
    }

    onCreateFolderEvent() {
        this.__actionOption("Create folder", null);
    }

    onCreateFolder(fileInfo: FileInfo, name: string) {
        this.isLoading=true;
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
                    this.isLoading=false;
                }
            });
        })
        .catch((a) => {
            console.log(a);
            this.isLoading=false;
        });
    }

    onFindFolder() {
        this.isLoading=true;
        this.driveHelper.findFolder("config-folder")
        .then(foldersInfo => {
            console.log(foldersInfo);
            this.isLoading=false;
        })
        .catch((a) => {
            console.log(a);
            this.isLoading=false;
        });
    }

    onFindFileInFolder(fileInfo: FileInfo) {
        this.isLoading=true;
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
            this.isLoading=false;
        })
        .catch((a) => {
            console.log(a);
            this.isLoading=false;
        });
    }

    onListFileFromParent() {
        this.isLoading=true;
        this.driveHelper.listFilesByParent()
        .then(filesInfo => {
            this.files=filesInfo;
            this.isLoading=false;
        })
        .catch((a) => {
            console.log(a);
            this.isLoading=false;
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
        return !this.isLoading && !this.isSignedIn;
    }

    isSignedInAndNotLoading(): boolean {
        return !this.isLoading && this.isSignedIn;
    }
}
