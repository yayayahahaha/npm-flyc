function download(url, filePath, {
    headers = {},
    callback = Function.prototype,
    callbackParameter = undefined
} = {}) {
    return new Promise(async (resolve, reject) => {
        // 濾掉尾巴的斜線
        if (/\/$/.test(filePath)) {
            filePath = filePath.slice(0, filePath.length - 1);
        }
        // 濾掉開頭的./
        if (/^\.\//.test(filePath)) {
            filePath = filePath.slice(2, filePath.length);
        }

        // 如果資料夾不存在會自動創建的系統
        var paths = filePath.split('/'),
            createdDirectory = [];
        for (var i = 0; i < paths.length - 1; i++) {
            createdDirectory.push(paths[i]);
            var checkedDirectory = createdDirectory.join('/');
            !fs.existsSync(checkedDirectory) && fs.mkdirSync(checkedDirectory);
        }

        var file = fs.createWriteStream(filePath);
        axios({
            method: 'get',
            url: url,
            responseType: 'stream',
            headers: headers
        }).then(({
            data
        }) => {
            callback(true, callbackParameter);
            data.pipe(file);
            file.on('finish', () => {
                resolve(true);
            });
        }).catch((error) => {
            console.log(error);
            callback(false, callbackParameter);
            reject([null, error]);
        });
    });
}

module.exports = download;