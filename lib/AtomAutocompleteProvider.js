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
        line = line.trim().replace(/\"/gi, "");
        let list = null;
        if (line.indexOf("notebook:") >= 0) {
            list = this.data.evernote.notebooks
        } else if (line.indexOf("tags:") >= 0) {
            list = this.data.evernote.tags
        } else if (line.indexOf("board:") >= 0) {

        }
        return list.filter((item, index) => {
            return item.name.indexOf(origPrefix) >= 0
        }).map(function (item) {
            return {text: item.name, type: 'snippet', leftLabel: item.stack || '', rightLabel: 'Evernote'}
        })
    }

    getLine(editor, bufferPosition) {
        return editor.getTextInRange([[bufferPosition.row, 0], bufferPosition]);
    }

    onDidInsertSuggestion({editor, suggestion}) {
        console.log(suggestion)
    }
}
