import Immutable from 'immutable'
import * as Constants from '../constants'

const initialState = Immutable.fromJS({})

export default function (state = initialState, action) {
  const { env, pod, event } = action.payload || {}
  switch (action.type) {
    case Constants.CLEAR_PODS:
      return state.deleteIn(['envs', env])
    case Constants.CHANGE_POD:
      switch (event.type) {
        case 'INIT':
        case 'ADDED':
        case 'MODIFIED':
          return state.setIn(['envs', env, event.object.metadata.name, 'object'], event.object)
        case 'DELETED':
          return state.deleteIn(['envs', env, event.object.metadata.name])
      }
      return state
    case Constants.CLEAR_POD_LOG:
      return state.setIn(['envs', env, pod, 'log'], Immutable.Stack())
    case Constants.ADD_POD_LOG:
      const log = state.getIn(['envs', env, pod, 'log']).push(action.payload.line)
      return state.setIn(['envs', env, pod, 'log'], log)
    default:
      return state
  }
}
