let fs = require('fs');
let join = require('path').join;

/**
 *
 * @param startPath  起始目录文件夹路径
 * @returns {Array}
 */
function findFileSync(startPath, isRecur) {
    let result = [];

    function finder(path) {
        let files = fs.readdirSync(path);
        files.forEach((val, index) => {
            let fPath = join(path, val);
            let stats = fs.statSync(fPath);
            if (stats.isDirectory()) {
                if (isRecur) {
                    finder(fPath);
                } else {
                    result.push(fPath);
                }
            }
            if (stats.isFile()) result.push(fPath);
        });

    }

    finder(startPath);
    return result;
}

function findFileNameSync(startPath, isRecur) {
    let result = [];

    function finder(path) {
        let files = fs.readdirSync(path);
        files.forEach((val, index) => {
            let fPath = join(path, val);
            let stats = fs.statSync(fPath);
            if (stats.isDirectory()) {
                if (isRecur) {
                    finder(fPath);
                } else {
                    result.push(val);
                }
            }
            if (stats.isFile()) result.push(val);
        });

    }

    finder(startPath);
    return result;
}

function writeFile(path, content) {
    return fs.writeFile(path, content);
}

module.exports.findFileSync = findFileSync;
module.exports.findFileNameSync = findFileNameSync;
module.exports.writeFile = writeFile;
