/* global prompt */
import * as Constants from '../constants'

// environments
export function showCreateEnvModal () {
  return {
    type: Constants.SHOW_CREATE_ENV_MODAL
  }
}

export function hideCreateEnvModal () {
  return {
    type: Constants.HIDE_CREATE_ENV_MODAL
  }
}

export function deleteEnvironment (env) {
  return async function (dispatch, getState, api) {
    var envName = prompt('Are you sure you wish to delete this environment? Enter the environment name to confirm')
    if (envName !== env) {
      return
    }
    const { results, error } = await api.environments.delete(envName)
    if (error) { // TODO snackbar
                 /* window.app.snackbar.makeDismissableToast({
                    message: error.message,
                    level: window.app.snackbar.Level.WARNING
                    }) */
      return
    }
    window.app.snackbar.makeDismissableToast({
      message: 'Environment deleted',
      level: window.app.snackbar.Level.INFO
    })
    // window.location.reload()
    // TODO trigger refresh of environments
  }
}
