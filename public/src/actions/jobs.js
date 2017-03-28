import { browserHistory } from 'react-router'

import * as Constants from '../constants'

export function getJobs (env, name, qs) {
  return async function (dispatch, getState, api) {
    dispatch({ type: Constants.GET_JOBS })
    const { results, error } = await api.jobs.get(env, name, qs)
    if (error) {
      return { error }
    }
    dispatch(setJobs(env, name, results))
    return { results }
  }
}

export function setJobs (env, name, results) {
  var jobs = {}
  if (name) {
    jobs[name] = results
  } else {
    jobs = results.jobs
  }
  return {
    type: Constants.SET_JOBS,
    payload: {
      env: env,
      jobs: jobs
    }
  }
}

export function runJob (env, name, tag, branch) {
  return async function (dispatch, getState, api) {
    const { results, error } = await api.runs.create(env, name, {
      tag: tag,
      branch: branch
    })
    if (error) {
      return { error }
    }
    browserHistory.push(`/${env}/jobs/${name}/runs/${results.job.metadata.name}`)
    return { results }
  }
}
