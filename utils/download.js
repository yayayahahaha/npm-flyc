const fs = require('fs')
const axios = require('axios')

// TODO 避免單純使用 headers, 要傳入整個 axios condif 做 assign 之類的
// TODO 直接不使用 axios、使用 fetch ?
// TODO 如果資料夾不存在的話就創建的那個系統其實有內建..

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

    // 如果資料夾不存在會自動創建的系統
    const paths = filePath.split('/')
    const createdDirectory = []

    for (let i = 0; i < paths.length - 1; i++) {
      createdDirectory.push(paths[i])
      const checkedDirectory = createdDirectory.join('/')

      !fs.existsSync(checkedDirectory) && fs.mkdirSync(checkedDirectory)
    }

    const file = fs.createWriteStream(filePath)
    const axiosSetting = {
      method: 'get',
      url,
      responseType: 'stream',
      headers,
    }
    axios(axiosSetting)
      .then(({ data /* 這個是 axios 的 data */ }) => {
        callback(true, callbackParameter)
        data.pipe(file)

        file.on('finish', () => resolve(true))
      })
      .catch((error) => {
        callback(false, callbackParameter)
        reject([null, error])
      })
  })
}

module.exports = download
