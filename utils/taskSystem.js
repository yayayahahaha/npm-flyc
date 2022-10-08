// TODO:
// 1. 當前的這個taskSystem 執行的時候是mute 的還是verbose 的
// 2. refect 的時候的 retry? 像是把 reject 的項目放到task 的後面之類的, 然後還要計次
// 3. 區分警告訊息與正規訊息
// 4. log: 記錄中間失敗的過程、產生一個 hash 記錄每次的執行狀況等
// 5. 調整檢查參數那邊的 code 變得更優雅一些

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

function TaskSystem(jobsArray = [], taskNumber = 5, setting = {}) {
  // // 任務列表, 會是一個 function array
  this.jobsArray = []
  if (!Array.isArray(jobsArray)) console.log('jobsArray 僅接受 Array, 將使用空陣列')
  else this.jobsArray = [...jobsArray]

  // 總共要起幾個task 去執行佇列, 預設值是 5
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

  this.doPromise = () => {
    return new Promise((resolveOfDoPromise) => {
      if (this.jobsArray.length === 0) {
        console.log('warning: 傳入的jobs 陣列為空')
        resolveOfDoPromise(this.resultArray)
        return
      }

      console.log(`要執行的任務共有 ${this.jobsArray.length} 個`)
      console.log(`分給 ${this.taskNumber} 個task 去執行`)
      console.log(`每個task 約負責 ${Math.ceil(this.jobsArray.length / this.taskNumber)} 項任務`)

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
  // 如果是值，這裡目前沒做Object 或Array 的深度複製
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
  }

  this.finishedJobs++

  _showOutput.call(this, jobReault)

  this.eachCallback(jobReault)
  this.resultArray.push(jobReault)

  setTimeout(() => _doJobs.call(this, resolveOfDoPromise), Math.round(Math.random() * this.randomDelay))
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

    console.log(`${settingKey} 僅能為${type}, 將使用 ${defaultSetting[settingKey]}`, this.setting[settingKey])
  })
}

function _showOutput(jobReault) {
  // 秀給console 的文字
  const status = jobReault.status ? 'success' : 'failed'
  const of = `${this.finishedJobs} / ${this.totalJobsNumber}`
  let persent = (parseInt(this.finishedJobs, 10) * 100) / parseInt(this.totalJobsNumber, 10)

  persent = Math.round(persent * Math.pow(10, 2)) / 100
  persent = `${persent.toFixed(2)}%`

  process.stdout.clearLine()
  process.stdout.cursorTo(0)
  process.stdout.write(`${of}, ${persent}, ${status}`)
}

module.exports = TaskSystem
