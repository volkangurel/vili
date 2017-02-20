import * as Constants from '../constants'

export function getNodes (env, name, qs) {
  return async function (dispatch, getState, api) {
    dispatch({ type: Constants.GET_NODES })
    const { results, error } = await api.nodes.get(env, name, qs)

    if (error) {
      // TODO
      /* window.app.snackbar.makeDismissableToast({
         message: error.message,
         level: window.app.snackbar.Level.WARNING
         }) */
      return false
    }

    dispatch(setNodes(env, name, results))
    return true
  }
}

export function setNodes (env, name, results) {
  var nodes = {}
  if (name) {
    nodes[name] = results
  } else {
    nodes = results.nodes
  }
  return {
    type: Constants.SET_NODES,
    payload: {
      env: env,
      nodes: nodes
    }
  }
}

export function setNodeSchedulable (env, name, status) {
  return async function (dispatch, getState, api) {
    const { error } = await api.nodes.setSchedulable(env, name, status)

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
