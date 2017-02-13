import Immutable from 'immutable'
import * as Constants from '../constants'

const initialState = Immutable.fromJS({})

export default function (state = initialState, action) {
  const { env, deployment, event } = action.payload || {}
  switch (action.type) {
    case Constants.CLEAR_DEPLOYMENT_PODS:
      return state.deleteIn(['envs', env, deployment])
    case Constants.CHANGE_DEPLOYMENT_POD:
      switch (event.type) {
        case 'INIT':
        case 'ADDED':
        case 'MODIFIED':
          return state.setIn(['envs', env, deployment, event.object.metadata.name], event.object)
        case 'DELETED':
          return state.deleteIn(['envs', env, deployment, event.object.metadata.name])
      }
      return state
    default:
      return state
  }
}
