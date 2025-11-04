const fs = require('fs')
const path = require('path')

/**
 * @typedef DownloadSetting
 * @property {object} headers
 * @property {function} callback
 * @property {any} callbackParameter
 * */
/**
 * @function download
 * @param {string} url
 * @param {string} rowFilePath
 * @param {DownloadSetting} DownloadSetting
 * */
function download(
  url,
  rowFilePath,
  { headers = {}, callback = Function.prototype, callbackParameter = undefined } = {}
) {
  return new Promise((resolve, reject) => {
    // 濾掉尾巴的斜線和開頭的./
    const filePath = rowFilePath.replace(/^\.\//, '').replace(/\/$/, '')

    // 如果資料夾不存在會自動創建
    const dir = path.dirname(filePath)
    if (dir && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    const file = fs.createWriteStream(filePath)
    fetch(url, { headers })
      .then((res) => {
        if (!res.ok) {
          const fetchError = new Error(`Download failed: ${res.statusText} (status: ${res.status})`);
          callback(false, callbackParameter);
          return reject([null, fetchError]);
        }

        callback(true, callbackParameter)

        res.body.pipe(file)

        file.on('finish', () => resolve(true));

        file.on('error', (err) => {
          callback(false, callbackParameter)
          reject([null, err])
        })

        res.body.on('error', (err) => {
          callback(false, callbackParameter)
          reject([null, err])
        })
      })
      .catch((error) => {
        callback(false, callbackParameter)
        reject([null, error])
      })
  })
}

module.exports = download
