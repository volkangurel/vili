import * as Constants from '../constants'

export function getPods (env, name, qs) {
  return async function (dispatch, getState, api) {
    dispatch({ type: Constants.GET_PODS })
    const { results, error } = await api.pods.get(env, name, qs)

    if (error) {
      // TODO
      /* window.app.snackbar.makeDismissableToast({
         message: error.message,
         level: window.app.snackbar.Level.WARNING
         }) */
      return false
    }

    dispatch(setPods(env, name, results))
    return true
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

export function setPods (env, name, results) {
  var pods = {}
  if (name) {
    pods[name] = results
  } else {
    pods = results.pods
  }
  return {
    type: Constants.SET_PODS,
    payload: {
      env: env,
      pods: pods
    }
  }
}
