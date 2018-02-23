import * as vscode from 'vscode';

import { execCmd } from './elmUtils';

global['XMLHttpRequest'] = require('xmlhttprequest').XMLHttpRequest;
const elm = require('../src-elm/PackageManager');
const request = require('request');



let oc: vscode.OutputChannel = vscode.window.createOutputChannel('Elm Package');

interface ElmPackageInfo {
    name: string,
    summary: string,
    versions: string[]
}

interface ElmPackageQuickPickItem extends vscode.QuickPickItem {
    elmPackageInfo: ElmPackageInfo;
}

class ElmPackageManager {
    private elmWorker: any;

    constructor() {
        this.elmWorker = elm.PackageManager.worker();
    }

    private onlineAvailableElmPackages(): Promise<ElmPackageInfo[]> {
        return new Promise((resolve, reject) => {
            console.log(this.elmWorker);

            this.elmWorker.ports.getPackageListFailedCmd.subscribe(() => {
                reject('Failed to get list of packages from `http://package.elm-lang.org`');
            });

            this.elmWorker.ports.showPackageListCmd.subscribe((data) => {
                const workspaceFolder = data[0];
                const elmPackages = data[1];
                if (workspaceFolder == vscode.workspace.rootPath) {
                    resolve(elmPackages);
                }
            });

            this.elmWorker.ports.getPackageListSub.send(vscode.workspace.rootPath);
        });
    }

    public browsePackage(): Promise<void> {
        const quickPickPackageOptions: vscode.QuickPickOptions = {
            matchOnDescription: true,
            matchOnDetail: true,
            placeHolder: 'Choose a package',
        };
        const quickPickVersionOptions: vscode.QuickPickOptions = {
            matchOnDescription: false,
            placeHolder: 'Choose a version, or press <esc> to browse the latest',
        };

        return this.onlineAvailableElmPackages()
            .then((packages: ElmPackageInfo[]): ElmPackageQuickPickItem[] => packages.map(item => {
                return { label: item.name, description: item.summary, elmPackageInfo: item };
            }))
            .then(packages =>
                vscode.window.showQuickPick(packages, quickPickPackageOptions),
        )
            .then(selectedPackage => {
                if (selectedPackage === undefined) {
                    return; // no package
                }
                return vscode.window
                    .showQuickPick(
                        transformToPackageVersionQuickPickItems(selectedPackage),
                        quickPickVersionOptions,
                )
                    .then(selectedVersion => {
                        oc.show(vscode.ViewColumn.Three);
                        let uri = selectedVersion
                            ? vscode.Uri.parse(
                                'http://package.elm-lang.org/packages/' +
                                selectedPackage.label +
                                '/' +
                                selectedVersion.label,
                            )
                            : vscode.Uri.parse(
                                'http://package.elm-lang.org/packages/' +
                                selectedPackage.label +
                                '/latest',
                            );
                        vscode.commands.executeCommand('vscode.open', uri, 3);
                    });
            });
    }

}

function transformToPackageVersionQuickPickItems(
    selectedPackage: ElmPackageQuickPickItem,
): vscode.QuickPickItem[] {
    return selectedPackage.elmPackageInfo.versions.map(version => {
        return { label: version, description: null };
    });
}

// function runInstallPackage(): Thenable<void> {
//     const quickPickOptions: vscode.QuickPickOptions = {
//         matchOnDescription: true,
//         placeHolder:
//             'Choose a package, or press <esc> to install all packages in elm-package.json',
//     };

//     return getJSON()
//         .then(transformToQuickPickItems)
//         .then(items => vscode.window.showQuickPick(items, quickPickOptions))
//         .then(value => {
//             const packageName = value ? value.label : '';
//             oc.show(vscode.ViewColumn.Three);

//             return execCmd(`elm-package install ${packageName} --yes`, {
//                 onStdout: data => oc.append(data),
//                 onStderr: data => oc.append(data),
//                 showMessageOnError: true,
//             }).then(() => { });
//         });
// }


// function getJSON(): Promise<any[]> {
//     return new Promise((resolve, reject) => {
//         request('http://package.elm-lang.org/all-packages', (err, _, body) => {
//             if (err) {
//                 reject(err);
//             } else {
//                 let json;
//                 try {
//                     json = JSON.parse(body);
//                 } catch (e) {
//                     reject(e);
//                 }
//                 resolve(json);
//             }
//         });
//     });
// }

function transformToQuickPickItems(json: any[]): vscode.QuickPickItem[] {
    return json.map(item => ({ label: item.name, description: "", detail: item.summary }));
}

export function activatePackage(): vscode.Disposable[] {
    var elmPackageManager = new ElmPackageManager();

    return [
        // vscode.commands.registerCommand('elm.installPackage', runInstallPackage),
        //vscode.commands.registerCommand('elm.uninstallPackage', runUninstallPackage),
        vscode.commands.registerCommand('elm.browsePackage', () => {
            return elmPackageManager.browsePackage();
        }),
    ];
}
