// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import {window, workspace, commands, Disposable, ExtensionContext, StatusBarAlignment, StatusBarItem, TextDocument} from 'vscode';
import fs = require('fs');
import cp = require('child_process');

type FileAccess = "+R" | "-R";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(ctx: ExtensionContext) { 

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "read-only-indicator" is now active!'); 

	// create a new read only indicator
    let readOnlyIndicator = new ReadOnlyIndicator();
    let controller = new ReadOnlyIndicatorController(readOnlyIndicator);

    // add to a list of disposables which are disposed when this extension
    // is deactivated again.
    ctx.subscriptions.push(controller);
    ctx.subscriptions.push(readOnlyIndicator);
    
    function updateFileAccess(newFileAccess: FileAccess) {
        
        // Windows only
        if (process.platform != "win32") {
            window.showInformationMessage('This command is only supported in Windows');
            return;
        }
        
        if (!window.activeTextEditor) {
            window.showInformationMessage('Open a file first to update it attributes');
            return;
        }
        
        if (window.activeTextEditor.document.uri.scheme == "untitled") {
            window.showInformationMessage('Save the file first to update it attributes');
            return;
        }
        
        let isReadOnly: Boolean = readOnlyIndicator.isReadOnly(window.activeTextEditor.document);
        let activeFileAcess: FileAccess = isReadOnly ? "+R" : "-R";

        if (newFileAccess == activeFileAcess) {
            let activeFileAcessDescription: String;
            activeFileAcessDescription = isReadOnly ? "Read-only" : "Writeable";
            window.showInformationMessage('The file is already ' + activeFileAcessDescription);
            return;
        }  
        
        const spawn = require('child_process').spawn;
        const ls = spawn('attrib', [newFileAccess, window.activeTextEditor.document.fileName]);

        ls.stdout.on('data', (data) => {
            console.log(`stdout: ${data}`);
        });

        ls.stderr.on('data', (data) => {
            console.log(`stderr: ${data}`);
            window.showErrorMessage(`Some error occured: ${data}`);
        });

        ls.on('close', (code) => {
            console.log(`child process exited with code ${code}`);
            readOnlyIndicator.updateReadOnly();
        });  
    }
    
    commands.registerCommand('readOnly.makeWriteable', () => {        
        updateFileAccess("-R");
    });
    
    commands.registerCommand('readOnly.makeReadOnly', () => {        
        updateFileAccess("+R");
    });    
}

export class ReadOnlyIndicator {

    private statusBarItem: StatusBarItem;

    dispose() {
        this.hideReadOnly();
    }

    public updateReadOnly() {

        // Create as needed
        if (!this.statusBarItem) {
            this.statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left);
        } 

        // Get the current text editor
        let editor = window.activeTextEditor;
        if (!editor) {
            this.statusBarItem.hide();
            return;
        }

        let doc = editor.document;

        // Only update status if an MD file
        if (!doc.isUntitled) {
            let readOnly = this.isReadOnly(doc);

            // Update the status bar
            this.statusBarItem.text = !readOnly ? '$(pencil) [RW]' : '$(circle-slash) [RO]';
			this.statusBarItem.tooltip = !readOnly ? 'The file is writeable' : 'The file is read only';
            this.statusBarItem.show();
        } else {
            this.statusBarItem.hide();
        }
    }
	
	public isReadOnly(doc: TextDocument): Boolean {
		let filePath = doc.fileName;
		try {
				fs.accessSync(filePath, fs.W_OK);
				return false;
			} catch (error) {
				return true;
			}
	}
    
    public hideReadOnly() {
        if (this.statusBarItem) {
            this.statusBarItem.dispose();
        }
    }
}

class ReadOnlyIndicatorController {

    private readOnlyIndicator: ReadOnlyIndicator;
    private disposable: Disposable;

    constructor(wordCounter: ReadOnlyIndicator) {
        this.readOnlyIndicator = wordCounter;
        this.readOnlyIndicator.updateReadOnly();

        // subscribe to selection change and editor activation events
        let subscriptions: Disposable[] = [];
        window.onDidChangeTextEditorSelection(this.onEvent, this, subscriptions);
        window.onDidChangeActiveTextEditor(this.onEvent, this, subscriptions);

        // create a combined disposable from both event subscriptions
        this.disposable = Disposable.from(...subscriptions);
    }

    dispose() {
        this.disposable.dispose();
    }

    private onEvent() {
        this.readOnlyIndicator.updateReadOnly();
    }
}