import * as Constants from '../constants'

export function getDeploymentPods (env, name, qs) {
  return async function (dispatch, getState, api) {
    dispatch({ type: Constants.GET_DEPLOYMENT_PODS })
    const { results, error } = await api.pods.get(env, { labelSelector: 'app=' + name })

    if (error) {
      // TODO
      /* window.app.snackbar.makeDismissableToast({
         message: error.message,
         level: window.app.snackbar.Level.WARNING
         }) */
      return false
    }

    dispatch(setDeploymentPods(env, name, results))
    return true
  }
}

export function setDeploymentPods (env, name, results) {
  return {
    type: Constants.SET_DEPLOYMENT_PODS,
    payload: {
      env: env,
      deployment: name,
      pods: results.items
    }
  }
}
