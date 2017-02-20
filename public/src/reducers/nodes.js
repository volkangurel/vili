import Immutable from 'immutable'
import * as Constants from '../constants'

const initialState = Immutable.fromJS({})

export default function (state = initialState, action) {
  const { env, event } = action.payload || {}
  switch (action.type) {
    case Constants.CLEAR_NODES:
      return state.deleteIn(['envs', env])
    case Constants.CHANGE_NODE:
      switch (event.type) {
        case 'INIT':
        case 'ADDED':
        case 'MODIFIED':
          return state.setIn(['envs', env, event.object.metadata.name], event.object)
        case 'DELETED':
          return state.deleteIn(['envs', env, event.object.metadata.name])
      }
      return state
    default:
      return state
  }
}
