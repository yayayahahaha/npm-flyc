// TODO:
// 當前的這個taskSystem 執行的時候是mute 的還是verbose 的


/*
(async function() {
    var sourceArray = [],
        task_object = null,
        result = null;

    var promoise_no_delay = function() {
            return Promise.resolve('promoise_no_delay');
        },
        promise_with_delay = function() {
            return new Promise(function(resolve, reject) {
                setTimeout(function() {
                    resolve('promise_with_delay')
                }, 300);
            })
        },
        promise_failed_no_delay = function() {
            return Promise.reject('promise_failed_no_delay');
        },
        promise_failed_with_delay = function() {
            return new Promise(function(resolve, reject) {
                setTimeout(function() {
                    reject('promise_failed_with_delay');
                }, 300);
            })
        },
        promise_in_then_case = function() {
            return new Promise(function(resolve, reject) {
                resolve('promise_in_then_case');
            }).then(function(response) {
                return response;
            });
        },
        promise_in_catch_case = function() {
            return new Promise(function(resolve, reject) {
                reject('promise_in_catch_case');
            }).then(function(response) {
                return response;
            }).catch(function(error) {
                throw error;
            });
        },
        simple_string = 'simple_string';

    sourceArray = [promise_in_catch_case, promise_in_then_case, promise_with_delay, promoise_no_delay, simple_string, promise_failed_no_delay, promise_failed_with_delay];

    task_object = new TaskSystem(sourceArray, 3, {
        callback: function(result) {
            console.log(result);
        },
        eachCallback: function() {
            console.log(' works!');
        },
        randomDelay: undefined
    });
    result = await task_object.doPromise();
})();
*/


function TaskSystem(
    jobsArray = [],
    taskNumber = 5,
    setting = {
        eachCallback: Function.prototype,
        callback: Function.prototype,
        randomDelay: 2000
    }) {

    // 任務列表
    this.jobsArray = (jobsArray instanceof Array) ? [...jobsArray] : (() => {
        console.log('jobsArray 僅接受 Array, 將使用空陣列');
        return [];
    })();

    // 總共要起幾個task 去執行佇列
    this.taskNumber = typeof taskNumber === 'number' ?
        taskNumber > 0 && taskNumber % 1 === 0 ?
        taskNumber :
        null :
        null;
    if (this.taskNumber === null) {
        console.log('taskNumber 僅可為正整數, 將使用 5');
        this.taskNumber = 5;
    }

    this.setting = {
        randomDelay: 2000,
        eachCallback: Function.prototype,
        callback: Function.prototype
    };
    Object.keys(this.setting).forEach((settingKey) => {
        switch (settingKey) {
            // 隨機延遲，用於假裝人性化
            case 'randomDelay':
                var randomDelay = setting[settingKey];
                this.setting.randomDelay = typeof randomDelay === 'number' ?
                    randomDelay >= 0 ?
                    randomDelay :
                    (function() {
                        console.log('randomDelay 參數不接受負數, 將使用 0 ');
                        return 0;
                    })() :
                    2000;

                break;

                // 任務完成後的callback
            case 'callback':
                var callback = setting[settingKey];
                this.callback = typeof callback === 'undefined' ?
                    Function.prototype :
                    typeof callback === 'function' ?
                    callback :
                    null;
                if (this.callback === null) {
                    console.log('callback 僅能為function, 將使用空function');
                    this.callback = Function.prototype;
                }
                break;
            case 'eachCallback':
                var eachCallback = setting[settingKey];
                this.eachCallback = typeof eachCallback === 'undefined' ?
                    Function.prototype :
                    typeof eachCallback === 'function' ?
                    eachCallback :
                    null;
                if (this.eachCallback === null) {
                    console.log('eachCallback 僅能為function, 將使用空function');
                    this.eachCallback = Function.prototype;
                }
                break;
            default:
                console.log(`無法識別的setting 參數: ${settingKey}`);
                break;
        }
    });

    this.resultArray = []; // 任務結果回傳列表

    this.workingTasksNumber = 0; // 當前還沒結束的task 數量
    this.totalJobsNumber = this.jobsArray.length; // 總任務數量
    this.finishedJobs = 0; // 完成的任務數量

    this._doJobs = async function(resolve) {
        var job = null,
            jobReault = null,
            lastOne = false;

        // 佇列裡已無工作的時候
        if (this.jobsArray.length === 0) {
            this.workingTasksNumber--;

            // 檢查現在還有沒有沒停止的task
            if (this.workingTasksNumber === 0) {
                console.log(''); // 換行用
                this.callback(this.resultArray);

                // doPromise 的resolve
                resolve(this.resultArray);
            }
            return;
        }

        // 從任務列表裡取出任務
        job = this.jobsArray.splice(0, 1)[0];

        // 判斷取出的任務是function 還是純粹的值
        // 如果是值，這裡目前沒做Object 或Array 的深度複製
        jobReault = typeof job === 'function' ? job() : job;

        // 這裡的catch 得要外面的Promise 用throw 丟值過來才會被觸發
        // 有點小麻煩就是了
        jobReault = await Promise.resolve(jobReault).then((result) => {
            return {
                status: 1,
                data: result,
                meta: job
            }
        }).catch((error) => {
            return {
                status: 0,
                data: error,
                meta: job
            }
        });

        // 秀給console 的文字
        this.finishedJobs++;
        var status = jobReault.status ? 'success' : 'failed',
            of = `${ this.finishedJobs } / ${ this.totalJobsNumber }`,
            persent = parseInt(this.finishedJobs, 10) * 100 / parseInt(this.totalJobsNumber, 10);

        persent = Math.round(persent * Math.pow(10, 2)) / 100;
        persent = `${ persent.toFixed(2) }%`;

        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        process.stdout.write(`${of}, ${persent}, ${status}`);

        this.eachCallback(jobReault);
        this.resultArray.push(jobReault);

        setTimeout(() => {
            this._doJobs(resolve);
        }, Math.round(Math.random() * this.setting.randomDelay));
    }

    this.doPromise = () => {
        return new Promise((resolve, reject) => {
            if (this.jobsArray.length === 0) {
                console.log('warning: 傳入的jobs 陣列為空');
                resolve(this.resultArray);
                return;
            }

            console.log(`要執行的任務共有 ${ this.jobsArray.length } 個`);
            console.log(`分給 ${ this.taskNumber } 個task 去執行`);
            console.log(`每個task 約負責 ${ Math.ceil(this.jobsArray.length / this.taskNumber) } 項任務`);
            this.workingTasksNumber = this.taskNumber;
            for (var i = 0; i < this.taskNumber; i++) {
                this._doJobs(resolve);
            }
        })
    }
}

export {
    TaskSystem
};