import * as Constants from '../constants'

const podsSubscriptions = {}
const podSubscriptions = {}
const podLogSubscriptions = {}

export function subPods (env) {
  return async function (dispatch, getState, api) {
    if (!podsSubscriptions[env]) {
      dispatch({
        type: Constants.CLEAR_PODS,
        payload: {
          env: env
        }
      })
      const ws = api.pods.watch(function (data) {
        dispatch(changePod(env, data))
      }, env)
      podsSubscriptions[env] = ws
    }
    return true
  }
}

export function unsubPods (env) {
  if (podsSubscriptions[env] && podsSubscriptions[env]) {
    const ws = podsSubscriptions[env]
    ws.close()
    delete podsSubscriptions[env]
  }
  return {
    type: Constants.CLEAR_PODS,
    payload: {
      env: env
    }
  }
}

export function subPod (env, name) {
  return async function (dispatch, getState, api) {
    if (!podSubscriptions[env]) {
      podSubscriptions[env] = {}
    }
    if (!podSubscriptions[env][name]) {
      const ws = api.pods.watch(function (data) {
        dispatch(changePod(env, data))
      }, env, name)
      podSubscriptions[env][name] = ws
    }
    return true
  }
}

export function unsubPod (env, name) {
  if (podSubscriptions[env] && podSubscriptions[env][name]) {
    const ws = podSubscriptions[env][name]
    ws.close()
    delete podSubscriptions[env][name]
  }
  return {
    type: Constants.IGNORE
  }
}

export function subPodLog (env, name) {
  return async function (dispatch, getState, api) {
    if (!podLogSubscriptions[env]) {
      podLogSubscriptions[env] = {}
    }
    if (!podLogSubscriptions[env][name]) {
      dispatch({
        type: Constants.CLEAR_POD_LOG,
        payload: {
          env: env,
          pod: name
        }
      })
      const ws = api.pods.watchLog(function (data) {
        dispatch(addPodLog(env, name, data.object))
      }, env, name)
      podLogSubscriptions[env][name] = ws
    }
    return true
  }
}

export function unsubPodLog (env, name) {
  if (podLogSubscriptions[env] && podLogSubscriptions[env][name]) {
    const ws = podLogSubscriptions[env][name]
    ws.close()
    delete podLogSubscriptions[env][name]
  }
  return {
    type: Constants.CLEAR_POD_LOG,
    payload: {
      env: env,
      pod: name
    }
  }
}

export function changePod (env, event) {
  return {
    type: Constants.CHANGE_POD,
    payload: {
      env: env,
      event: event
    }
  }
}

export function deletePod (env, name) {
  return async function (dispatch, getState, api) {
    const { error } = await api.pods.del(env, name)

    if (error) {
      // TODO
      /* window.app.snackbar.makeDismissableToast({
         message: error.message,
         level: window.app.snackbar.Level.WARNING
         }) */
      return false
    }
    return true
  }
}

export function addPodLog (env, name, line) {
  return {
    type: Constants.ADD_POD_LOG,
    payload: {
      env: env,
      pod: name,
      line: line
    }
  }
}
