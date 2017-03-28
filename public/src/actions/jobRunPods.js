import * as Constants from '../constants'

const subscriptions = {}

export function subJobRunPods (env, name, qs) {
  return async function (dispatch, getState, api) {
    if (!subscriptions[env]) {
      subscriptions[env] = {}
    }
    if (!subscriptions[env][name]) {
      dispatch({
        type: Constants.CLEAR_JOB_RUN_PODS,
        payload: {
          env: env,
          run: name
        }
      })
      const ws = api.pods.watch(function (data) {
        dispatch(changeJobRunPod(env, name, data))
      }, env, { labelSelector: 'run=' + name })
      subscriptions[env][name] = ws
    }
    return true
  }
}

export function unsubJobRunPods (env, name, qs) {
  if (subscriptions[env] && subscriptions[env][name]) {
    const ws = subscriptions[env][name]
    ws.close()
    delete subscriptions[env][name]
  }
  return {
    type: Constants.CLEAR_JOB_RUN_PODS,
    payload: {
      env: env,
      run: name
    }
  }
}

export function changeJobRunPod (env, name, event) {
  return {
    type: Constants.CHANGE_JOB_RUN_POD,
    payload: {
      env: env,
      run: name,
      event: event
    }
  }
}
