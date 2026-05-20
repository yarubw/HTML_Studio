const { v4: uuidv4 } = require('uuid');

/** @type {Map<string, { id: string, status: string, apkUrl: string|null, error: string|null, appName: string }>} */
const jobs = new Map();

const STATUS = {
  QUEUED: 'queued',
  BUILDING: 'building',
  SUCCESS: 'success',
  FAILED: 'failed'
};

function createJob(appName) {
  const id = uuidv4();
  const job = {
    id,
    status: STATUS.QUEUED,
    apkUrl: null,
    error: null,
    appName
  };
  jobs.set(id, job);
  return job;
}

function getJob(jobId) {
  return jobs.get(jobId) || null;
}

function updateJob(jobId, patch) {
  const job = jobs.get(jobId);
  if (!job) return null;
  Object.assign(job, patch);
  return job;
}

module.exports = {
  jobs,
  STATUS,
  createJob,
  getJob,
  updateJob
};
