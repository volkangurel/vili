import Immutable from 'immutable'
import * as Constants from '../constants'

const initialState = Immutable.fromJS({})

export default function (state = initialState, action) {
  switch (action.type) {
    case Constants.GET_DEPLOYMENTS:
      return state.set('isFetching', true)
    case Constants.SET_DEPLOYMENTS:
      return state.setIn(['envs', action.payload.env], action.payload.deployments)
                  .set('isFetching', false)
                  .set('lastUpdated', new Date())
    default:
      return state
  }
}
