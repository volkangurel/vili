import Immutable from 'immutable'
import * as Constants from '../constants'

const initialState = Immutable.fromJS({})

export default function (state = initialState, action) {
  const { env, job, event } = action.payload || {}
  switch (action.type) {
    case Constants.CLEAR_JOB_RUNS:
      return state.deleteIn(['envs', env, job])
    case Constants.CHANGE_JOB_RUN:
      switch (event.type) {
        case 'INIT':
        case 'ADDED':
        case 'MODIFIED':
          return state.setIn(['envs', env, job, event.object.metadata.name], event.object)
        case 'DELETED':
          return state.deleteIn(['envs', env, job, event.object.metadata.name])
      }
      return state
    default:
      return state
  }
}
