import { browserHistory } from 'react-router'

import * as Constants from '../constants'

export function getDeployments (env, name, qs) {
  return async function (dispatch, getState, api) {
    dispatch({ type: Constants.GET_DEPLOYMENTS })
    const { results, error } = await api.deployments.get(env, name, qs)
    if (error) {
      return { error }
    }
    dispatch(setDeployments(env, name, results))
    return { results }
  }
}

export function scaleDeployment (env, name, replicas) {
  return async function (dispatch, getState, api) {
    const { results, error } = await api.deployments.scale(env, name, replicas)
    if (error) {
      return { error }
    }
    return { results }
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

export function deployTag (env, name, tag, branch) {
  return async function (dispatch, getState, api) {
    const { results, error } = await api.rollouts.create(env, name, {
      tag: tag,
      branch: branch
    })
    if (error) {
      return { error }
    }
    const rolloutId = results.toDeployment.metadata.annotations['deployment.kubernetes.io/revision']
    browserHistory.push(`/${env}/deployments/${name}/rollouts/${rolloutId}`)
    return { results }
  }
}
