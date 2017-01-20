import Immutable from 'immutable'
import * as Constants from '../constants'

const initialState = Immutable.fromJS({
  showCreateModal: false
})

export default function (state = initialState, action) {
  switch (action.type) {
    case Constants.SHOW_CREATE_ENV_MODAL:
      return state.set('showCreateModal', true)
    case Constants.HIDE_CREATE_ENV_MODAL:
      return state.set('showCreateModal', false)
    default:
      return state
  }
}
