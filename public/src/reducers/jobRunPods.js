import Immutable from 'immutable'
import * as Constants from '../constants'

const initialState = Immutable.fromJS({})

export default function (state = initialState, action) {
  const { env, run, event } = action.payload || {}
  switch (action.type) {
    case Constants.CLEAR_JOB_RUN_PODS:
      return state.deleteIn(['envs', env, run])
    case Constants.CHANGE_JOB_RUN_POD:
      switch (event.type) {
        case 'INIT':
        case 'ADDED':
        case 'MODIFIED':
          return state.setIn(['envs', env, run, event.object.metadata.name], event.object)
        case 'DELETED':
          return state.deleteIn(['envs', env, run, event.object.metadata.name])
      }
      return state
    default:
      return state
  }
}
