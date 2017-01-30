import * as Constants from '../constants'

export function getDeployments (env, name, qs) {
  return async function (dispatch, getState, api) {
    dispatch({ type: Constants.GET_DEPLOYMENTS })
    const { results, error } = await api.deployments.get(env, name, qs)

    if (error) {
      // TODO
      /* window.app.snackbar.makeDismissableToast({
         message: error.message,
         level: window.app.snackbar.Level.WARNING
         }) */
      return false
    }

    dispatch(setDeployments(env, name, results))
    return true
  }
}

export function scaleDeployment (env, name, replicas) {
  return async function (dispatch, getState, api) {
    const { error } = await api.deployments.scale(env, name, replicas)

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

export function setDeployments (env, name, results) {
  var deployments = {}
  if (name) {
    deployments[name] = results
  } else {
    deployments = results.deployments
  }
  return {
    type: Constants.SET_DEPLOYMENTS,
    payload: {
      env: env,
      deployments: deployments
    }
  }
}
