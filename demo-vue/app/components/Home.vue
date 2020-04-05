<template>
    <Page class="page">
        <ActionBar class="action-bar">
            <Label class="action-bar-title" text="Home"></Label>
        </ActionBar>

        <GridLayout rows="auto, *">
            <GridLayout rows="auto, 5, auto" columns="*,*" backgroundColor="#f0f0f0">
                <Button col="0" 
                    text="&#xf2f6;  Sign In" @tap="onInit" class="fas btn btn-primary"
                    :isEnabled= "isNotSignedInAndNotLoading"></Button>
                <Button col="1" text="&#xf2f5;  Sign out" 
                    @tap="onPressToDisconnect" class="fas btn btn-primary btn-ruby"
                    :isEnabled= "isSignedInAndNotLoading"></Button>
                
                <StackLayout row="1" col="0" colSpan="2" class="hr-light"></StackLayout>

                <Button row="2" col="0" text="&#xf477;  file" 
                    @tap="onCreateFileEvent" class="fas btn btn-primary btn-blue"
                    :isEnabled= "isSignedInAndNotLoading"></Button>
                <Button row="2" col="1" text="&#xf65e;  folder" 
                    @tap="onCreateFolderEvent" class="fas btn btn-primary btn-brown"
                    :isEnabled= "isSignedInAndNotLoading"></Button>
            </GridLayout>
            <ListView row="1" for="item in files" class="list-group" @itemTap="onAccionShow">
                <v-template>
                    <GridLayout rows="auto,auto,auto" columns="50, *, auto" class="list-group-item p-x-8">
                        <Label 
                            :text="item.mimeType == 'application/vnd.google-apps.folder' ? '&#xf07b;' :  '&#xf15c;'" 
                            col="0" rowSpan="3" class="fas icon  p-r-8"></Label>
                        <Label :text="item.name" col="1" class="h3 font-weight-bold"></Label>
                        <Label :text="item.mimeType" row="1" col="1" class="list-group-item-text body"></Label>
                        <Label :text="item.description" row="2" col="1" class="list-group-item-text body2"></Label>
                        <Label :text="item.createdTime" row="1" col="2" class="footnote"></Label>
                    </GridLayout>
                </v-template>
            </ListView>
            <ActivityIndicator
                color="#7845ad"
                row="1" 
                rowSpan="2"
                :busy=" isLoading "
                width="32" 
                height="32"></ActivityIndicator>
        </GridLayout>

    </Page>
</template>

<script>
    import { isIOS } from "tns-core-modules/platform";
    import { GoogleDriveHelper, SPACES, FileInfoContent, FileInfo, Config } from "nativescript-google-drive";
    import { confirm, action, alert, prompt, PromptResult, inputType, capitalizationType, PromptOptions } from "tns-core-modules/ui/dialogs";
    import { ItemEventData } from "tns-core-modules/ui/list-view";
    // @ts-ignore
    import * as  MyWorker from "nativescript-worker-loader!nativescript-google-drive/thread-worker";

    export default {
        data() {
            return {
                driveHelper: null,
                files: [],
                isLoading: true,
                isSignedIn: false
            }
        },
        created: function () {
            setTimeout(() => {
                this.onInit();
            }, 3000);
        },
        methods: {
            onInit() {
                const config = {
                    space: SPACES.APP_DATA_FOLDER,
                    worker: MyWorker
                };
                // iOS need this extra the clientID
                if (isIOS) {
                    const googleClientID = "680729366979-1bf7aoceaf52ijj7k8fmcbavbstvbbcm.apps.googleusercontent.com";
                    config.clientId = googleClientID;
                }

                GoogleDriveHelper.singInOnGoogleDrive(config)
                .then((helper) => {
                    this.driveHelper = helper;
                    this.isSignedIn=true;
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
            },
            onAccionShow(event) {
                const files = this.files;
                const index = event.index;
                const fileInfo = files[index];
                this.__showOption(fileInfo);
            },
            onPressToDisconnect() {
                let options = {
                    title: "Confirm",
                    message: "Are you sure you want disconnect the google account?",
                    okButtonText: "Yes",
                    cancelButtonText: "No"
                };

                confirm(options).then((result) => {
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
            },
            onCreateFileEvent() {
                this.__actionOption("Create file", null);
            },
            onCreateFile(fileInfo, name) {
                this.isLoading=true;
                const _name = isIOS && (name || "ios-back-up-test.json") || (name || "android-back-up-test.json");
                const metadata = {
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
            },
            onReadFile(fileInfo) {
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
            },
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
            },
            onDeleteFile(fileInfo) {
                let options = {
                    title: "Confirm",
                    message: `Are you sure you want to delete ${fileInfo.name}?`,
                    okButtonText: "Yes",
                    cancelButtonText: "No"
                };

                confirm(options).then((result) => {
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
            },
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
            },
            onUpdateFile(fileInfo) {
                this.isLoading=true;
                const name = isIOS && "ios-back-up-test.json" || "android-back-up-test.json";
                const metadata = {
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
                .then((done) => {
                    console.log("#updateFile()", done);
                    alert(done);
                    this.isLoading=false;
                })
                .catch((a) => {
                    console.log(a);
                    this.isLoading=false;
                });
            },
            onCreateFolderEvent() {
                this.__actionOption("Create folder", null);
            },
            onCreateFolder(fileInfo, name) {
                this.isLoading=true;
                const folderMetadata = {
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
            },
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
            },
            onFindFileInFolder(fileInfo) {
                this.isLoading=true;
                const folderMetadata = {
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
            },
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
            },
            __showOption(fileInfo) {
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
            },
            __actionOption(result, fileInfo) {
                if (result === "Delete") {
                    this.onDeleteFile(fileInfo);
                }
                if (result === "Create file") {
                    let options = {
                        title: result,
                        message: "Enter your name",
                        okButtonText: "OK",
                        cancelButtonText: "Cancel",
                        cancelable: false,
                        inputType: inputType.text,
                        capitalizationType: capitalizationType.sentences
                    };
                    
                    prompt(options).then((result) => {
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
                    let options = {
                        title: result,
                        message: "Enter your name",
                        okButtonText: "OK",
                        cancelButtonText: "Cancel",
                        cancelable: false,
                        inputType: inputType.text,
                        capitalizationType: capitalizationType.sentences
                    };
                    
                    prompt(options).then((result) => {
                        if(result.result)
                            this.onCreateFolder(fileInfo, result.text);
                    });
                }
            }
        },
        computed: {
            isNotSignedInAndNotLoading() {
                return !this.isLoading && !this.isSignedIn;
            },
            isSignedInAndNotLoading() {
                return !this.isLoading && this.isSignedIn;
            }
        }
    };
</script>

<style scoped lang="scss">
    // Start custom common variables
    @import '../app-variables';
    // End custom common variables

    // Custom styles
    .fa {
        color: $accent-dark;
    }

    .info {
        font-size: 20;
    }

    .fas {
        font-family: "Font Awesome 5 Free", "fa-solid-900";
        font-weight: 400;
    }

    .fas.icon {
        font-size: 32;
    }
</style>
