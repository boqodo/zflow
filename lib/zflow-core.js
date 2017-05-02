'use babel';

import Trello from "trello";
import Evernote from "evernote";
import converter from "./converter";
import yaml from "js-yaml";

//TODO:改变配置时动态处理
const trello = new Trello(atom.config.get("zflow.trelloDevKey"), atom.config.get("zflow.trelloToken"));
const regex = /^(-{3}(?:\n|\r)([\w\W]+?)(?:\n|\r)-{3})?([\w\W]*)*/;
const evernoteUserIdConfig = "zflow.evernoteUserId";
const evernoteUserShardIdConfig = "zflow.evernoteUserShardId";

const evernoteClient = new Evernote.Client({
    token: atom.config.get("zflow.evernoteToken"),
    sandbox: false,
    china: true
});

var config = {
    file: {
        path: "",
        name: ""
    },
    trello: {
        url: "",
        board: "",
        listId: "",
        cardName: "",
        cardDesc: "@desc",
    },
    evernote: {
        url: "",
        notebook: "",
        title: "",
        tags: ","
    },
    blog: {}
};

export default class ZflowCore {
    constructor(trelloData) {
        this.trelloData = trelloData;
        this.noteStore = evernoteClient.getNoteStore(atom.config.get("zflow.evernoteNoteStoreUrl"));
        this.userStore = evernoteClient.getUserStore()
    }

    initTmpl() {
        this.openNewTabPage()
    }

    // 生成模板，初始化配置信息
    generateTmpl() {
        return `---\r\n${yaml.dump(config)}---\r\ndesc:\r\n\r\n---\r\n## 标题\r\n> 引用\r\n\r\n\r\n`
    }

    async openNewTabPage() {
        await atom.workspace.open();
        let editor;
        if (editor = atom.workspace.getActiveTextEditor()) {
            //加载trello数据
            this.loadTrelloData();
            //生成初始模板数据
            editor.insertText(this.generateTmpl());
            // 高亮语法
            editor.setGrammar(this.getGrammar());
            // 折叠
            foldHeadInfo(editor)
        }
    }

    foldHeadInfo(editor) {
        editor.foldBufferRow(1)
    }

    loadTrelloData() {
        config.trello.board = `${this.trelloData.borad.name} ${this.trelloData.list.name}`;
        config.trello.listId = this.trelloData.list.id;
        config.trello.cardName = this.trelloData.input
    }

    getGrammar() {
        let grammars = atom.grammars.getGrammars();
        for (var i = 0; i < grammars.length; i++) {
            let grammar = grammars[i];
            if (grammar.name === "GitHub Markdown") {
                return grammar
            }
        }
        return null
    }

    // 根据解析的内容发送生成trello card
    async sendToTrello() {
        let editor;
        if (editor = atom.workspace.getActiveTextEditor()) {
            let text = editor.getText();
            let tmpConfig = this.parseTmplText(text);
            if (tmpConfig) {
                config = tmpConfig
            }
            let name = config.trello.cardName;
            let description = config.trello.cardDesc;
            let listId = config.trello.listId;
            let url = config.trello.url;
            if (url) {
                // 更新数据
                let cardId = this.getCardIdByUrl(url);
                await trello.updateCard(cardId, "name", name);
                await trello.updateCard(cardId, "desc", description);

                atom.notifications.addSuccess("update to trello success!")
            } else {
                let card = await trello.addCard(name, description, listId);
                //写入card信息
                config.trello.url = card.shortUrl;
                this.rewriteText(editor, text);
                atom.notifications.addSuccess("send to trello success!")
            }
        }
    }

    rewriteText(editor, text) {
        let configText = `---\r\n${yaml.dump(config)}---`;
        configText = configText.replace(/>-\n\s+/gi, ""); // 替换由于字符串过程json转yaml时出现的`>-`
        text = text.replace(/^(-{3}(?:\n|\r)([\w\W]+?)(?:\n|\r)-{3})?/, configText);
        editor.setText(text);
        foldHeadInfo(editor)
    }

    // 读取解析模板，组装成对象

    parseTmplText(text) {
        //[\s\S]+?  多一个问号，表示非贪婪模式
        let match;
        while (match = regex.exec(text)) {
            let configJSON = match[2];
            return yaml.safeLoad(configJSON)
        }
        return null
    }

    // 发送到印象笔记
    async sendToEvernote() {
        let editor;
        if (editor = atom.workspace.getActiveTextEditor()) {
            let text = editor.getText();
            let tmpConfig = this.parseTmplText(text);
            if (tmpConfig) {
                config = tmpConfig
            }

            let content = converter.toEnml(text);
            content = content.replace("class=\"lang-javascript\"", "");
            let title = config.evernote.title;
            let notebookGuid = null;
            let tagNames = config.evernote.tags;
            tagNames = tagNames.split(",");

            let evernoteUrl = config.evernote.url;
            if (!evernoteUrl) {
                // 新增
                let note = await this.createNote(title, notebookGuid, content, tagNames);
                config.evernote.url = await this.buildEvernoteUrl(note.guid);
                this.rewriteText(editor, text);
                await this.addEvernoteUrlToTrelloComment();

                atom.notifications.addSuccess("send to evernote success!")
            } else {
                //更新
                let guid = this.getNoteGuIdByUrl(evernoteUrl);
                await this.updateNoteContent(guid, title, content, tagNames, notebookGuid);
                atom.notifications.addSuccess("update to evernote success!")
            }
        }
    }

    async addEvernoteUrlToTrelloComment() {
        let evernoteUrl = config.evernote.url;
        if (evernoteUrl) {
            let cardId = this.getCardIdByUrl(config.trello.url);
            let comment = `[印象笔记](${evernoteUrl})`;
            let res = await trello.addCommentToCard(cardId, comment);
            console.log(res)
        }
    }


    async buildEvernoteUrl(noteId) {
        //https://app.yinxiang.com/shard/s6/notestore
        //https://app.yinxiang.com/shard/s6/nl/156766/568a6d0b-4d01-4b9c-a9cf-f41c10d88145
        let evernoteUserId = atom.config.get(evernoteUserIdConfig);
        let evernoteUserShardId = atom.config.get(evernoteUserShardIdConfig);
        if (!evernoteUserId) {
            let user = await this.userStore.getUser();
            evernoteUserId = user.id;
            evernoteUserShardId = user.shardId;
            atom.config.set(evernoteUserIdConfig, evernoteUserId);
            atom.config.set(evernoteUserShardIdConfig, evernoteUserShardId)
        }
        let urlTmpl = `https://app.yinxiang.com/shard/${evernoteUserShardId}/nl/${evernoteUserId}/${noteId}`;
        return urlTmpl
    }

    // 更新印象笔记
    async updateToEvernote() {
        let editor;
        if (editor = atom.workspace.getActiveTextEditor()) {
            let text = editor.getText();
            let tmpConfig = this.parseTmplText(text);
            if (tmpConfig) {
                config = tmpConfig
            }
            let content = converter.toEnml(text);
            content = content.replace("class=\"lang-javascript\"", "");
            let guid = this.getNoteGuIdByUrl(config.evernote.url);
            let title = config.evernote.title;
            let notebookGuid = null;
            let tagNames = config.evernote.tags;
            await this.updateNoteContent(guid, title, content, tagNames, notebookGuid)
        }
    }

    async loadAutocompleteProviderData() {
        let boards = await this.getBoardsByCurrentUser();
        for (var board of boards) {
            let lists = await this.getListsOnBoard(board.id);
            board.lists = lists;
        }
        let notebooks = await this.noteStore.listNotebooks();
        let tags = await this.noteStore.listTags();
        return {trello: boards, evernote: {notebooks: notebooks, tags: tags}}
    }


    getCardIdByUrl(url) {
        return this.getIdByUrl(url)
    }

    getIdByUrl(url) {
        if (url.endsWith("/")) {
            let posL = url.lastIndexOf("/");
            let posL2 = url.lastIndexOf("/", posL - 1);
            return url.substring(posL2 + 1, url.length - 1)
        } else {
            let pos = url.lastIndexOf("/");
            return url.substring(pos + 1)
        }
    }

    getNoteGuIdByUrl(url) {
        return this.getIdByUrl(url)
    }


    markdown2html() {
        var child_process = require('child_process');
        var iconv = require('iconv-lite');
        var encoding = 'cp936';
        var binaryEncoding = 'binary';
        //child_process.spawn  返回大文本
        child_process.exec('D:\\devenv\\python\\python-3.6.1-embed-win32\\python.exe D:\\devenv\\python\\python-3.6.1-embed-win32\\markdown2.py "D:\\devenv\\python\\python-3.6.1-embed-win32\\Spring MyBatis.md"', {encoding: binaryEncoding}, function (err, stdout, stderr) {
            console.log(iconv.decode(new Buffer(stdout, binaryEncoding), encoding), iconv.decode(new Buffer(stderr, binaryEncoding), encoding));
        });

    }

    // evernote 方法
    getNoteContent(noteGuid) {
        return this.noteStore.getNoteContent(noteGuid);
    }

    updateNoteContent(guid, title, content, tagNames, notebookGuid) {
        return this.noteStore.updateNote({
            guid,
            title,
            content,
            tagNames,
            notebookGuid
        });
    }

    createNotebook(title) {
        return this.noteStore.createNotebook({
            name: title
        });
    }

    createNote(title, notebookGuid, content, tagNames) {
        return this.noteStore.createNote({
            title,
            notebookGuid,
            content,
            tagNames
        });
    }

    // 包装trello方法
    getListsOnBoard(boardId) {
        return trello.getListsOnBoard(boardId)
    }

    async getBoardsByCurrentUser() {
        let member = await trello.getMember("me");
        return trello.getBoards(member.id)
    }
}
