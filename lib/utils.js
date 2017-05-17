let BufferedProcess = require("atom").BufferedProcess;
let fs = require('fs');
let join = require('path').join;
let child_process = require('child_process');
let iconv = require('iconv-lite');
const encoding = 'cp936';
const binaryEncoding = 'binary';


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

function exec(command) {
    //child_process.spawn  返回大文本
    child_process.exec(command, {encoding: binaryEncoding}, function (err, stdout, stderr) {
        console.log(iconv.decode(new Buffer(stdout, binaryEncoding), encoding), iconv.decode(new Buffer(stderr, binaryEncoding), encoding));
    });
}


function gitCmd(args, options, arg) {
    var color;
    if (options == null) {
        options = {
            env: process.env
        };
    }
    color = (arg != null ? arg : {}).color;
    return new Promise(function (resolve, reject) {
        var output, process, ref;
        output = '';
        if (color) {
            args = ['-c', 'color.ui=always'].concat(args);
        }
        process = new BufferedProcess({
            command: 'git',
            args: args,
            options: options,
            stdout: function (data) {
                return output += data.toString();
            },
            stderr: function (data) {
                return output += data.toString();
            },
            exit: function (code) {
                if (code === 0) {
                    return resolve(output);
                } else {
                    return reject(output);
                }
            }
        });
        return process.onWillThrowError(function (errorObject) {
            notifier.addError('Git is unable to locate the git command. Please ensure process.env.PATH can access git.');
            return reject("Couldn't find git");
        });
    });
}

function gitAdd(repo, filePath) {
    return gitCmd(['add', '--', filePath], {
        cwd: repo.getWorkingDirectory()
    }).then(function (output) {
        console.log("git add output:" + output);
        if (output !== false) {
            return sendSuccess("Added " + filePath);
        }
    }).catch(function (msg) {
        return sendError(msg);
    });
}

function gitCommit(repo, filePath) {
    return gitCmd(['commit', '--only', '-m', 'zflow commit', '--', filePath], {
        cwd: repo.getWorkingDirectory()
    }).then(function (data) {
        console.log(data);
        sendSuccess(data);
    }).catch(function (data) {
        sendError(data);
    });
}

function gitPush(repo, setUpstream) {
    return gitCmd([setUpstream ? 'push -u' : 'push'], {
        cwd: repo.getWorkingDirectory()
    }).then(data => {
        sendSuccess(data);
    }).catch(data => {
        sendError(data);
    });
}

function gitAddAndCommit(repo, filePath) {
    return gitAdd(repo, filePath).then(() => gitCommit(repo, filePath));
}
function gitAddAndCommitAndPush(repo, filePath) {
    return gitAdd(repo)
        .then(() => gitCommit(repo, filePath))
        .then(() => gitPush(repo));
}

function sendSuccess(message) {
    atom.notifications.addSuccess(message);
}

function sendError(message) {
    atom.notifications.addError(message);
}


module.exports.findFileSync = findFileSync;
module.exports.findFileNameSync = findFileNameSync;
module.exports.writeFile = writeFile;
module.exports.sendSuccess = sendSuccess;
module.exports.gitAddAndCommit = gitAddAndCommit;
module.exports.gitAddAndCommitAndPush = gitAddAndCommitAndPush;


