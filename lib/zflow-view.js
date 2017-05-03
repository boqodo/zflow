'use babel';
import SelectListView from "atom-select-list";
import {TextEditorView} from "atom-space-pen-views";
import ZflowCore from "./zflow-core";

export default class ZflowView {

    constructor(serializedState) {
        this.trelloData = {};
        this.zflowCore = new ZflowCore(this.trelloData);

        this.element = document.createElement('div');
        this.element.classList.add('zflow');

        this.inputView = new TextEditorView({
            mini: true,
            softTab: false,
            placeholderText: 'input file name',
        });

        this.selectListView = new SelectListView({
            items: [],
            filterKeyForItem: (item) => item.name,
            elementForItem: ({name, displayName}) => {
                const li = document.createElement('li');
                li.classList.add('board');
                li.textContent = name;
                li.dataset.name = name;
                return li
            },
            didConfirmSelection: (itemObj) => {
                console.log(itemObj);
                if (itemObj.hasOwnProperty("idBoard")) {
                    this.hide();
                    console.log("create card");
                    this.showInput(itemObj);
                    this.trelloData.list = itemObj;
                } else {
                    this.loadList(itemObj);
                    this.trelloData.board = itemObj;
                }
            },
            didCancelSelection: () => {
                this.hide()
            }

        });

        this.selectListView.element.classList.add('zflow-list');

        this.element.appendChild(this.selectListView.element)
    }

    async loadList(borad) {
        let boardId = borad.id;
        let lists = await this.zflowCore.getListsOnBoard(boardId);
        console.log(lists);
        await this.selectListView.update({items: lists})
    }

    // Returns an object that can be retrieved when package is activated
    serialize() {
    }

    async destroy() {
        await this.selectListView.destroy()
    }

    toggle() {
        if (this.panel && this.panel.isVisible()) {
            this.hide();
            return Promise.resolve()
        } else {
            return this.show()
        }
    }

    async showInput(itemObj) {
        this.inputView.bind("keydown", (event) => {
            if (event.keyCode == 13) {
                let text = this.inputView.getText();
                this.hide();
                // 重置视图
                console.log("itemObj:" + itemObj);
                this.trelloData.input = text;
                this.zflowCore.initTmpl()
            }
        });
        this.element.removeChild(this.selectListView.element);
        this.element.appendChild(this.inputView.element);
        this.show();
    }

    async show() {
        if (!this.panel) {
            this.panel = atom.workspace.addModalPanel({item: this.element})
        }

        if (!this.preserveLastSearch) {
            this.selectListView.reset()
        } else {
            this.selectListView.refs.queryEditor.selectAll()
        }


        let boards = await this.zflowCore.getBoardsByCurrentUser();
        await this.selectListView.update({items: boards});

        this.activeElement = (document.activeElement === document.body) ? atom.views.getView(atom.workspace) : document.activeElement;
        this.previouslyFocusedElement = document.activeElement;
        this.panel.show();
        this.selectListView.focus()
    }

    hide() {
        this.panel.hide();
        if (this.previouslyFocusedElement) {
            this.previouslyFocusedElement.focus();
            this.previouslyFocusedElement = null
        }
    }

    async update(props) {
        if (props.hasOwnProperty('preserveLastSearch')) {
            this.preserveLastSearch = props.preserveLastSearch
        }

        if (props.hasOwnProperty('useAlternateScoring')) {
            this.useAlternateScoring = props.useAlternateScoring;
            if (this.useAlternateScoring) {
                await this.selectListView.update({
                    filter: (items, query) => {
                        return query ? fuzzaldrinPlus.filter(items, query, {key: 'displayName'}) : items
                    }
                })
            } else {
                await this.selectListView.update({filter: null})
            }
        }
    }
}
