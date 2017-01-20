import Immutable from 'immutable'

const initialState = Immutable.fromJS({})

export default function (state = initialState, action) {
  switch (action.type) {
    default:
      return state
  }
}
