'use babel';

import ZflowView from "./zflow-view";
import AtomAutocompleteProvider from "./AtomAutocompleteProvider";
import {CompositeDisposable} from "atom";


export default {

    // 配置初始化
    config: {
        trelloDevKey: {
            title: "Trello Developer Key",
            description: "get key at https://trello.com/1/appKey/generate",
            type: "string",
            "default": ""
        },
        trelloToken: {
            title: "Trello Token",
            description: "Add developer key and you will be redirected to get your token. Paste below.",
            type: "string",
            "default": ""
        },
        evernoteNoteStoreUrl: {
            title: "Evernote noteStoreUrl",
            description: "evernote noteStoreUrl",
            type: "string",
            "default": ""
        },
        evernoteToken: {
            title: "Evernote Token",
            description: "evernote token",
            type: "string",
            "default": ""
        },
        githubBlogDirPath: {
            title: "Github Blog Dir path",
            description: "github blog dir path",
            type: "string",
            "default": ""
        }
    },
    zflowView: null,
    zflowCore: null,
    modalPanel: null,
    subscriptions: null,
    provider: null,


    activate(state) {
        this.zflowView = new ZflowView(state.zflowViewState);
        this.zflowCore = this.zflowView.zflowCore;
        this.provider = new AtomAutocompleteProvider();
        this.zflowCore.loadProviderData(this.zflowCore.loadAutocompleteProviderData());
        this.provider.loadData(this.zflowCore.loadAutocompleteProviderData());

        // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
        this.subscriptions = new CompositeDisposable();

        // Register command that toggles this view
        this.subscriptions.add(atom.commands.add('atom-workspace', {
            'zflow:toggle': () => this.zflowView.toggle(),
            'zflow:trello': () => this.zflowCore.sendToTrello(),
            'zflow:evernote': () => this.zflowCore.sendToEvernote(),
            'zflow:init': () => this.zflowCore.initTmpl(),
            'zflow:backend': () => this.backend(),
            'zflow:doAllOpt': () => this.zflowCore.doAllOpt()
        }));
        atom.notifications.addSuccess("plugin load sendSuccess!")
        //return this.zflowView.show()
    },
    backend(){

    },

    async deactivate () {
        this.subscriptions.dispose();
        await this.zflowView.destroy()
    },

    getProvider() {
        return this.provider
    },

    serialize() {
        return {
            zflowViewState: this.zflowView.serialize()
        };
    }
};
