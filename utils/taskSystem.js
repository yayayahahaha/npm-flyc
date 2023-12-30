// TODO:
// 0. 整理 TODO
// 1. 當前的這個taskSystem 執行的時候是mute 的還是verbose 的
// 2. reject 的時候的 retry? 像是把 reject 的項目放到task 的後面之類的, 然後還要計次
// 3. 區分警告訊息與正規訊息
// 4. log: 記錄中間失敗的過程、產生一個 hash 記錄每次的執行狀況等
// 5. 調整檢查參數那邊的 code 變得更優雅一些
// 6. 用套件處理 progress 的部分, 後續再透過參數決定要不要顯示
// 7. 每一個 job 如果可以有自己的 callback 的話, 看可不可以顯示巢狀的任務進度表? (e.g. download progress)
// 8. 如果傳入的是某個寫好的 instance, 加上像是 name, progress, total 什麼的話，應該也可以弄成巢狀的 progressbar?
// -> 在這種條件下，如果沒有傳這個 instance 的話，應該也可以做? 但 subprogress 就會是直接從 0% 跳成 100% 這樣

/*
需求
變成一個 instance, 可以放好預設值就不用動的那種
參數: {
  status: working, stop, idle
  mute
  log
  delay
  randomDelay

  eachCallback
  callback
  maxRetry
  mode: oneHugeJob / keepWorking
  pickRandom

  start
  stop
  updateConfig

  getWorkers

  worker: {
    status: working, stop, idle

    start
    stop
  }
}
*/
const cliProgress = require('cli-progress')

const isPositiveInt = (number) => /^[1-9]\d*$/.test(number)

const taskSample = (delay = 300) => {
  return () => new Promise((r) => setTimeout(r, delay))
}
const tempFailed = () => {
  let number = 3
  return () =>
    new Promise((resolve, reject) => {
      number--
      if (number > 0) return reject()
      return resolve()
    })
}

async function test() {
  const taskList = [tempFailed(), taskSample(true)]
  const task = new TaskSystem(taskList, 1, {
    randomDelay: 2000, // 隨機延遲，用於假裝人性化
    eachCallback: (f) => f, // 任務完成後的callback
    callback: (a) => a, // 每一次task做完後的callback
    retry: false, // task 失敗的話是否重試
    maxRetry: 123, // TODO 最大可重試次數
  })
  const result = await task.doPromise()

  console.log('result:', result)
}
false && test()

/**
 * @typedef TaskSystemSetting
 * @property {number} randomDelay - 隨機延遲，用於假裝人性化
 * @property {function} eachCallback - 任務完成後的callback
 * @property {function} callback - 每一次task做完後的callback
 * @property {number} retry - task 失敗的話是否重試
 * @property {number} maxRetry - TODO 最大可重試次數
 * */
/**
 * @function TaskSystem
 * @param {Array<function>} jobsArray
 * @param {number} taskNumber - this is some description
 * @param {TaskSystemSetting} TaskSystemSetting
 * */
function TaskSystem(jobsArray = [], taskNumber = 5, setting = {}) {
  // // 任務列表, 會是一個 function array
  this.jobsArray = []
  if (!Array.isArray(jobsArray)) console.log('jobsArray 僅接受 Array, 將使用空陣列')
  else this.jobsArray = [...jobsArray]

  // 總共要起幾個 task 去執行佇列, 預設值是 5
  this.taskNumber = 5
  if (!isPositiveInt(taskNumber)) console.log('taskNumber 僅可為正整數, 將使用 5')
  else this.taskNumber = taskNumber

  const defaultSetting = {
    randomDelay: 2000, // 隨機延遲，用於假裝人性化
    eachCallback: Function.prototype, // 任務完成後的callback
    callback: Function.prototype, // 每一次task做完後的callback
    retry: false, // task 失敗的話是否重試
    maxRetry: 3, // TODO 最大可重試次數
  }
  this.setting = Object.assign({}, defaultSetting, setting)

  _checkParams.call(this, defaultSetting)

  this.resultArray = [] // 任務結果回傳列表

  this.workingTasksNumber = 0 // 當前還沒結束的task 數量
  this.totalJobsNumber = this.jobsArray.length // 總任務數量
  this.finishedJobs = 0 // 完成的任務數量
  this.progressbar = new cliProgress.MultiBar({
    clearOnComplete: false,
    hideCursor: true,
    barCompleteChar: '\u2588', // TODO 不知道可不可以作用
    barIncompleteChar: '\u2591', // TODO 不知道可不可以作用
    format: '{jobname} {bar} {percentage}% {value}/{total}',
  }) // 進度條
  this.mainProgressbar = this.progressbar.create(this.totalJobsNumber, 0) // 主進度條
  this.mainProgressbar.update(0, { jobname: 'TODO put jobname here' })

  this.doPromise = () => {
    // TODO 這裡會有互相遮蓋的問題，看要怎麼處理會比較好看
    console.log('')
    // process.stdout.cursorTo(0)
    // process.stdout.clearLine()

    return new Promise((resolveOfDoPromise) => {
      if (this.jobsArray.length === 0) {
        console.log('warning: 傳入的jobs 陣列為空') // TODO 這句好像也可以不用加
        resolveOfDoPromise(this.resultArray)
        return
      }

      console.log(`Total jobs count: ${this.jobsArray.length}`)
      console.log(`Task count: ${this.taskNumber}`)
      console.log(
        `Each task takes about ${Math.ceil(this.jobsArray.length / this.taskNumber)} jobs.`
      )

      this.workingTasksNumber = this.taskNumber

      for (var i = 0; i < this.taskNumber; i++) {
        _doJobs.call(this, resolveOfDoPromise)
      }
    })
  }
}

async function _doJobs(resolveOfDoPromise) {
  // 佇列裡已無工作的時候
  if (this.jobsArray.length === 0) {
    this.workingTasksNumber--

    // 檢查現在還有沒有沒停止的task
    if (this.workingTasksNumber === 0) {
      console.log('') // 換行用
      this.progressbar.stop()
      this.callback(this.resultArray)

      // doPromise 的resolve
      resolveOfDoPromise(this.resultArray)
    }
    return
  }

  // 從任務列表裡取出任務
  const job = this.jobsArray.splice(0, 1)[0]
  const meta = job

  // 判斷取出的任務是function 還是純粹的值
  // TODO 如果是值，這裡目前沒做Object 或Array 的深度複製
  let jobReault = typeof job === 'function' ? job() : job

  // 這裡的catch 得要外面的Promise 用throw 丟值過來才會被觸發
  // 有點小麻煩就是了
  jobReault = await Promise.resolve(jobReault)
    .then((data) => ({ status: 1, data, meta }))
    .catch((data) => ({ status: 0, data, meta }))

  if (!jobReault.status && this.retry) {
    console.log('')
    console.log('job 失敗! 將重新嘗試')
    this.totalJobsNumber++
    this.jobsArray.push(job)

    // 設定 progressbar 的 total
    this.mainProgressbar.setTotal(this.totalJobsNumber)
  }

  this.finishedJobs++
  this.mainProgressbar.increment()

  this.eachCallback(jobReault)
  this.resultArray.push(jobReault)

  setTimeout(
    () => _doJobs.call(this, resolveOfDoPromise),
    Math.round(Math.random() * this.randomDelay)
  )
}

function _checkParams(defaultSetting) {
  const keyMap = {
    retry: {
      type: Boolean,
      pass: () => true,
    },
    maxRetry: {
      type: '正整數',
      pass: (value) => isPositiveInt(value),
    },
    randomDelay: {
      type: '數字',
      pass: (value) => !isNaN(value),
    },
    callback: {
      type: '函式',
      pass: (value) => typeof value === 'function',
    },
    eachCallback: {
      type: '函式',
      pass: (value) => typeof value === 'function',
    },
  }

  Object.keys(defaultSetting).forEach((settingKey) => {
    const { pass, type } = keyMap[settingKey]
    this[settingKey] = this.setting[settingKey]

    if (pass(this[settingKey])) return
    this[settingKey] = defaultSetting[settingKey]

    console.log(
      `${settingKey} 僅能為${type}, 將使用 ${defaultSetting[settingKey]}`,
      this.setting[settingKey]
    )
  })
}

module.exports = TaskSystem
