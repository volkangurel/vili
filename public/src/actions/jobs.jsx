import * as Constants from '../constants'

export function getJobs (env, name, qs) {
  return async function (dispatch, getState, api) {
    dispatch({ type: Constants.GET_JOBS })
    const { results, error } = await api.jobs.get(env, name, qs)

    if (error) {
      // TODO
      /* window.app.snackbar.makeDismissableToast({
         message: error.message,
         level: window.app.snackbar.Level.WARNING
         }) */
      return false
    }

    dispatch(setJobs(env, name, results))
    return true
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
