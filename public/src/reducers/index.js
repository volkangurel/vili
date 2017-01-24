import { reducer as uiReducer } from 'redux-ui'
import { routerReducer } from 'react-router-redux'

import app from './app'
import deployments from './deployments'

function hardcodedValueReducer (state = null, action) {
  return state
}

const reducers = {
  ui: uiReducer,
  routing: routerReducer,
  user: hardcodedValueReducer,
  defaultEnv: hardcodedValueReducer,
  envs: hardcodedValueReducer,
  firebase: hardcodedValueReducer,
  app: app,
  deployments: deployments
}

export default reducers
