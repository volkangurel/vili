import Immutable from 'immutable'
import * as Constants from '../constants'
import _ from 'underscore'

const initialState = Immutable.fromJS({})

/*
{
isFetching: true,
didInvalidate: true,
lastUpdated: 123,
envs: {}
}
*/

export default function (state = initialState, action) {
  switch (action.type) {
    case Constants.GET_DEPLOYMENTS:
      return state.set('isFetching', true)
    case Constants.SET_DEPLOYMENTS:
      const updatedEnvs = {}
      updatedEnvs[action.payload.env] = action.payload.deployments
      const envs = state.get('envs') || Immutable.Map({})
      return state.set('envs', envs.mergeDeep(updatedEnvs))
                  .set('isFetching', false)
                  .set('lastUpdated', new Date())
    default:
      return state
  }
}
