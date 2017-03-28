import * as Constants from '../constants'

const subscriptions = {}

export function subDeploymentPods (env, name, qs) {
  return async function (dispatch, getState, api) {
    if (!subscriptions[env]) {
      subscriptions[env] = {}
    }
    if (!subscriptions[env][name]) {
      dispatch({
        type: Constants.CLEAR_DEPLOYMENT_PODS,
        payload: {
          env: env,
          deployment: name
        }
      })
      const ws = api.pods.watch(function (data) {
        dispatch(changeDeploymentPod(env, name, data))
      }, env, { labelSelector: 'app=' + name })
      subscriptions[env][name] = ws
    }
    return true
  }
}

export function unsubDeploymentPods (env, name, qs) {
  if (subscriptions[env] && subscriptions[env][name]) {
    const ws = subscriptions[env][name]
    ws.close()
    delete subscriptions[env][name]
  }
  return {
    type: Constants.CLEAR_DEPLOYMENT_PODS,
    payload: {
      env: env,
      deployment: name
    }
  }
}

export function changeDeploymentPod (env, name, event) {
  return {
    type: Constants.CHANGE_DEPLOYMENT_POD,
    payload: {
      env: env,
      deployment: name,
      event: event
    }
  }
}
