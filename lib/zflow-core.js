'use babel';

import Trello from "trello";
import Evernote from "evernote";
import converter from "./converter";
import yaml from "js-yaml";
import utils from "./utils";
import {GitRepository} from "atom";

//TODO:改变配置时动态处理
const trelloDevKey = atom.config.get("zflow.trelloDevKey");
const trelloToken = atom.config.get("zflow.trelloToken");
const trello = new Trello(trelloDevKey, trelloToken);

const evernoteUserIdConfig = "zflow.evernoteUserId";
const evernoteUserShardIdConfig = "zflow.evernoteUserShardId";
const evernoteToken = atom.config.get("zflow.evernoteToken");
const evernoteNoteStoreUrl = atom.config.get("zflow.evernoteNoteStoreUrl");
const githubBlogDirPath = atom.config.get('zflow.githubBlogDirPath');

const evernoteClient = new Evernote.Client({
    token: evernoteToken,
    sandbox: false,
    china: true
});

const regex = /^(-{3}(?:\n|\r)([\w\W]+?)(?:\n|\r)-{3})?([\w\W]*)*/; //匹配整篇文章的正则
const yamlRegex = /^(-{3}(?:\n|\r)([\w\W]+?)(?:\n|\r)-{3})?/; // 匹配yaml头的正则
const descRegex = /-{3}\s+desc:\s+([\w\W]+?)\s+-{3}\s+/;  // 匹配desc描述内容的正则
const realConfig = {
    file: {
        path: null,
        name: null
    },
    trello: {
        url: null,
        board: null,
        listId: null,
        cardName: null,
        cardDesc: "@desc"
    },
    evernote: {
        url: null,
        notebook: null,
        notebookId: null,
        title: null,
        tags: null
    },
    blog: {
        layout: "post",
        title: null,
        filename: null,
        category: null,
        description: "@desc"
    }
};

const viewConfig = {
    trello: {
        url: null,
        board: null,
        cardName: null,
        cardDesc: "@desc"
    },
    evernote: {
        url: null,
        notebook: null,
        title: null,
        tags: null
    },
    blog: {
        layout: "post",
        title: null,
        filename: null,
        category: null,
        description: "-\n-"
    }
};

export default class ZflowCore {
    constructor(trelloData) {
        this.trelloData = trelloData;
        this.noteStore = evernoteClient.getNoteStore(evernoteNoteStoreUrl);
        this.userStore = evernoteClient.getUserStore();
    }

    async loadProviderData(data) {
        this.providerData = await data;
    }

    initTmpl() {
        this.openNewTabPage()
    }

    // 生成模板，初始化配置信息
    generateTmpl() {
        var now = new Date();
        viewConfig.blog.filename = `${now.getYear()}-${now.getMonth() + 1}-${now.getDay()}-test`;
        let tmplStr = `---\r\n${yaml.dump(viewConfig, {lineWidth: 1000})}---\r\ndesc:\r\n\r\n---\r\n## 标题\r\n> 引用\r\n\r\n\r\n`;
        return this.yamlTextReplace(tmplStr)
    }

    async openNewTabPage() {
        await atom.workspace.open();
        let editor;
        if (editor = atom.workspace.getActiveTextEditor()) {
            //加载trello数据
            this.loadTrelloData();
            let text = this.generateTmpl();
            //生成初始模板数据
            editor.insertText(text);
            // 高亮语法
            editor.setGrammar(this.getGrammar());
            // 折叠
            this.foldHeadInfo(editor, this.getLines(text))
        }
    }

    //获取文本行数
    getLines(text) {
        return text.trim().match(/\n/gi).length;
    }

    foldHeadInfo(editor, lines) {
        for (let i = 0; i <= lines; i++) {
            editor.foldBufferRow(i)
        }
    }

    loadTrelloData() {
        if (this.trelloData.board) {
            realConfig.trello.board = `${this.trelloData.board.name} ${this.trelloData.list.name}`;
            realConfig.trello.listId = this.trelloData.list.id;
            realConfig.trello.cardName = this.trelloData.input
        }
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

    triggerFileSave() {
        const event = new CustomEvent("core:save", {bubbles: true, cancelable: true});
        let activeElement = (document.activeElement === document.body) ? atom.views.getView(atom.workspace) : document.activeElement;
        activeElement.dispatchEvent(event);
    }

    /**
     * git操作当前编辑文件
     */
    triggerGitSave() {
        let editor = atom.workspace.getActiveTextEditor();
        let filePath = editor.getPath();
        let repo = GitRepository.open(filePath);

        utils.gitAddAndCommit(repo, filePath);

    }

    fileSaveCallback(event) {
        if (event.path) {
            this.doAllOpt()
        }
    }

    isSave() {
        let editor = atom.workspace.getActiveTextEditor();
        return !(editor.getPath() === undefined);
    }

    async doAllOpt() {
        if (this.isSave()) {
            await this.triggerGitSave();
            console.log("1. triggerGitSave success!");

            await this.sendToTrello();
            console.log("2. sendToTrello success!");

            await this.sendToEvernote();
            console.log("3. sendToEvernote success!");

            let path = await this.saveToGithubBlog();
            console.log("4. saveToGithubBlog success!" + path);

            await this.triggerPushGithubBlog(path);
            console.log("5. triggerPushGithubBlog success!")
        } else {
            let editor = atom.workspace.getActiveTextEditor();
            editor.onDidSave(this.fileSaveCallback);
            this.triggerFileSave();
        }
    }

    async triggerPushGithubBlog(filePath) {
        let repo = GitRepository.open(filePath);
        utils.gitAddAndCommitAndPush(repo, filePath);
    }

    async saveToGithubBlog() {
        let editor;
        if (editor = atom.workspace.getActiveTextEditor()) {
            let text = editor.getText();
            this.view2realConfig(text);

            let path = githubBlogDirPath + "/_posts/" + realConfig.blog.category + "/" + realConfig.blog.filename + ".md";
            let cTmpl = {
                layout: realConfig.blog.layout,
                title: realConfig.blog.title,
                category: realConfig.blog.category,
                description: realConfig.blog.description
            };
            let header = `---\r\n${yaml.dump(cTmpl, {lineWidth: 1000})}---\r\n`;

            let subText = text.replace(yamlRegex, "");
            subText = "---\r\n" + subText;
            subText = subText.replace(descRegex, "");

            await utils.writeFile(path, header + subText);

            utils.sendSuccess("write to blog dir sendSuccess!");

            return path;
        }
    }

    // 根据解析的内容发送生成trello card
    async sendToTrello() {
        let editor;
        if (editor = atom.workspace.getActiveTextEditor()) {
            let text = editor.getText();

            this.view2realConfig(text);

            let name = realConfig.trello.cardName;
            let description = realConfig.trello.cardDesc;
            let listId = realConfig.trello.listId;
            let url = realConfig.trello.url;
            if (url) {
                // 更新数据
                let cardId = this.getCardIdByUrl(url);
                this.updateTrello(cardId, name, description, listId);

                utils.sendSuccess("update to trello sendSuccess!")
            } else {
                let card = await trello.addCard(name, description, listId);
                //写入card信息
                viewConfig.trello.url = card.shortUrl;
                this.rewriteText(editor, text);
                utils.sendSuccess("send to trello sendSuccess!")
            }
        }
    }

    rewriteText(editor, text) {
        let configText = `---\r\n${yaml.dump(viewConfig, {lineWidth: 1000})}---`;
        configText = this.yamlTextReplace(configText);
        text = text.replace(yamlRegex, configText);
        editor.setText(text);
        this.foldHeadInfo(editor, this.getLines(configText))
    }

    yamlTextReplace(yamlText) {
        yamlText = yamlText.replace(/>-\n\s+/gi, ""); // 替换由于字符串过程json转yaml时出现的`>-`
        yamlText = yamlText.replace(/null/gi, "");
        return yamlText
    }

    view2realConfig(text) {
        let tmpConfig = this.parseTmplText(text);
        this.deepCopy(viewConfig, tmpConfig);
        this.deepCopy(realConfig, viewConfig);

        // 处理特有属性值
        let board = realConfig.trello.board;
        let boardList = board.trim().split(/\s+/g);
        let boardName = boardList[0];
        let listName = boardList[1];

        let blist = this.providerData
            .trello.find(item => item.name === boardName)
            .lists.find(item => item.name === listName);
        realConfig.trello.listId = blist.id;

        let notebookName = realConfig.evernote.notebook;
        let notebook = this.providerData.evernote
            .notebooks.find(item => item.name === notebookName.trim());
        realConfig.evernote.notebookId = notebook.guid;

        let desc = realConfig.trello.cardDesc;

        if (desc === "@desc") {
            let mtexts = text.match(descRegex);
            if (mtexts.length === 2) {
                realConfig.trello.cardDesc = mtexts[1];
            }
        }
        // 无法在blog页面友好显示，不通过该方式处理
        // let blogDesc = realConfig.blog.description;
        // if (blogDesc === "@desc") {
        //     let mtexts = text.match(descRegex);
        //     if (mtexts.length === 2) {
        //         realConfig.blog.description = converter.toHtml(mtexts[1]);
        //     }
        // }

        let editor = atom.workspace.getActiveTextEditor();
        realConfig.file.path = editor.getPath();
        realConfig.file.name = editor.getTitle();
    }

    deepCopy(dest, orig) {
        for (let p in orig) {
            if (dest.hasOwnProperty(p)) {
                let val = orig[p];
                if (typeof val === 'object') {
                    this.deepCopy(dest[p], orig[p])
                } else {
                    dest[p] = val;
                }
            }
        }
    }

    // 读取解析模板，组装成对象

    parseTmplText(text) {
        //[\s\S]+?  多一个问号，表示非贪婪模式
        let match;
        while (match = regex.exec(text)) {
            let configJSON = match[2];
            let configObj = yaml.safeLoad(configJSON);
            return configObj
        }
        return null
    }

    // 发送到印象笔记
    async sendToEvernote() {
        let editor;
        if (editor = atom.workspace.getActiveTextEditor()) {
            let text = editor.getText();

            this.view2realConfig(text);

            let content = this.process2Evernote(text);
            content = converter.toEnml(content);
            content = content.replace("class=\"lang-javascript\"", "");
            content = content.replace("class=\"lang-java\"", "");

            let title = realConfig.evernote.title;
            let notebookId = realConfig.evernote.notebookId;
            let tagNames = realConfig.evernote.tags;
            tagNames = tagNames ? tagNames.split(",") : null;

            let evernoteUrl = realConfig.evernote.url;
            if (!evernoteUrl) {
                // 新增
                let note = await this.createNote(title, notebookId, content, tagNames);
                viewConfig.evernote.url = await this.buildEvernoteUrl(note.guid);
                this.rewriteText(editor, text);
                await this.addEvernoteUrlToTrelloComment();

                utils.sendSuccess("send to evernote sendSuccess!")
            } else {
                //更新
                let guid = this.getNoteGuIdByUrl(evernoteUrl);
                await this.updateNoteContent(guid, title, content, tagNames, notebookId);
                utils.sendSuccess("update to evernote sendSuccess!")
            }
        }
    }

    async addEvernoteUrlToTrelloComment() {
        let evernoteUrl = realConfig.evernote.url;
        if (evernoteUrl) {
            let cardId = this.getCardIdByUrl(realConfig.trello.url);
            let filePath = "file:///" + realConfig.file.path;
            let comment = `[印象笔记](${evernoteUrl})\r\n[本地文件](${filePath})`;
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

    async loadAutocompleteProviderData() {
        let layouts = [];
        let categories = [];

        if (githubBlogDirPath) {
            let layoutNames = utils.findFileNameSync(githubBlogDirPath + "/_layouts");
            layouts = layoutNames.map(item => {
                return {name: item.substring(0, item.indexOf("."))}
            });
            let categoryNames = utils.findFileNameSync(githubBlogDirPath + "/_posts");
            categories = categoryNames.map(item => {
                return {name: item}
            });
        }

        let boards = await this.getBoardsByCurrentUser();
        for (var board of boards) {
            let lists = await this.getListsOnBoard(board.id);
            board.lists = lists;
        }
        let notebooks = await this.noteStore.listNotebooks();
        let tags = await this.noteStore.listTags();


        return {
            trello: boards,
            evernote: {notebooks: notebooks, tags: tags},
            file: {layouts: layouts, categories: categories}
        }
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


    process2Evernote(text) {
        //发送到evernote的不需要头信息，只要把地址记录下来即可
        let subText = text.replace(yamlRegex, "");
        subText = "---\r\n" + subText;
        subText = subText.replace(descRegex, "");
        let trelloUrl = `- [Trello Url](${realConfig.trello.url})\r\n`;
        let trelloId = this.getIdByUrl(realConfig.trello.url);
        let trelloApp = `- [Trello App](trello://x-callback-url/showCard?x-source=AtomPlugin&id=${trelloId})\r\n`;
        let localFile = `- [${realConfig.file.name}](file:///${realConfig.file.path})`;
        return trelloUrl + trelloApp + "---\r\n" + subText;
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

    async updateTrello(cardId, name, description, listId) {
        let query = trello.createQuery();
        query.name = name;
        query.desc = description;
        query.idList = listId;
        let res = await trello.makeRequest('put', '/1/cards/' + cardId, query);
    }
}
