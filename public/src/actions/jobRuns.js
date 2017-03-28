import * as Constants from '../constants'

const subscriptions = {}

export function subJobRuns (env, name, qs) {
  return async function (dispatch, getState, api) {
    if (!subscriptions[env]) {
      subscriptions[env] = {}
    }
    if (!subscriptions[env][name]) {
      dispatch({
        type: Constants.CLEAR_JOB_RUNS,
        payload: {
          env: env,
          job: name
        }
      })
      const ws = api.runs.watch(function (data) {
        dispatch(changeJobRun(env, name, data))
      }, env, name)
      subscriptions[env][name] = ws
    }
    return true
  }
}

export function unsubJobRuns (env, name, qs) {
  if (subscriptions[env] && subscriptions[env][name]) {
    const ws = subscriptions[env][name]
    ws.close()
    delete subscriptions[env][name]
  }
  return {
    type: Constants.CLEAR_JOB_RUNS,
    payload: {
      env: env,
      job: name
    }
  }
}

export function changeJobRun (env, name, event) {
  return {
    type: Constants.CHANGE_JOB_RUN,
    payload: {
      env: env,
      job: name,
      event: event
    }
  }
}

export function deleteJobRun (env, name) {
  return async function (dispatch, getState, api) {
    const { error } = await api.runs.del(env, name)
    if (error) {
      return { error }
    }
    return {}
  }
}
