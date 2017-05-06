'use babel';

export default class AtomAutocompleteProvider {

    constructor() {
        this.selector = '.source.gfm';
        this.disableForSelector = '.source.gfm .comment';
        this.inclusionPriority = 1;
        this.suggestionPriority = 99;
        this.filterSuggestions = true
    }

    async loadData(data) {
        this.data = await data
    }

    async getSuggestions({editor, bufferPosition, prefix: origPrefix}) {
        let line = this.getLine(editor, bufferPosition);
        let nline = line.trim().replace(/\"/gi, "");
        let list = null;
        let rightLabel = 'Evernote';
        if (nline.indexOf("notebook:") >= 0) {
            list = this.data.evernote.notebooks
        } else if (nline.indexOf("tags:") >= 0) {
            list = this.data.evernote.tags;

            rightLabel = 'Evernote Tag';
        } else if (nline.indexOf("board:") >= 0) {
            rightLabel = 'Trello Board';
            list = this.data.trello;
            // trello board 跟随 list
            if (line.lastIndexOf(" ") === line.length - 1) {
                let boardName = nline.split(":")[1];
                boardName = boardName.trim();
                if (boardName.length > 0) {
                    list = list.filter((item) => {
                        return item.name === boardName.trim()
                    });
                    list.length > 0 ? list = list.pop().lists : null;

                    rightLabel = 'Trello List';
                }
            }
        }
        if (!list) {
            return
        }

        return list.filter((item, index) => {
            if (origPrefix.trim() === ":") return true;

            return item.name.indexOf(origPrefix) >= 0
        }).map((item) => {
            return {text: item.name, type: 'snippet', leftLabel: item.stack || '', rightLabel: rightLabel}
        })
    }

    getLine(editor, bufferPosition) {
        return editor.getTextInRange([[bufferPosition.row, 0], bufferPosition]);
    }

    onDidInsertSuggestion({editor, suggestion}) {
        console.log(suggestion)
    }
}
