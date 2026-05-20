const { processBuildJob } = require('./buildWorker');
const { updateJob, STATUS } = require('./jobs');

/** @type {Array<{ job: object, zipBuffer: Buffer, iconBuffer: Buffer, iconMime: string, config: object }>} */
const pending = [];
let busy = false;

function enqueueBuild(job, zipBuffer, iconBuffer, iconMime, config) {
  pending.push({ job, zipBuffer, iconBuffer, iconMime, config });
  drainQueue();
}

async function drainQueue() {
  if (busy) return;
  busy = true;

  while (pending.length) {
    const item = pending.shift();
    try {
      await processBuildJob(item.job, item.zipBuffer, item.iconBuffer, item.iconMime, item.config);
    } catch (err) {
      updateJob(item.job.id, {
        status: STATUS.FAILED,
        error: err.message || String(err)
      });
    }
  }

  busy = false;
}

module.exports = { enqueueBuild };
