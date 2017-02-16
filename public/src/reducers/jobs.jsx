import Immutable from 'immutable'
import * as Constants from '../constants'

const initialState = Immutable.fromJS({})

export default function (state = initialState, action) {
  switch (action.type) {
    case Constants.GET_JOBS:
      return state.set('isFetching', true)
    case Constants.SET_JOBS:
      const updatedEnvs = {}
      updatedEnvs[action.payload.env] = action.payload.jobs
      const envs = state.get('envs') || Immutable.Map({})
      return state.set('envs', envs.mergeDeep(updatedEnvs))
                  .set('isFetching', false)
                  .set('lastUpdated', new Date())
    default:
      return state
  }
}
