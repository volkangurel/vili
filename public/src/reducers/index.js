import { reducer as uiReducer } from 'redux-ui'
import { routerReducer } from 'react-router-redux'

import app from './app'
import env from './env'
// import users from '../components/users/reducers'

const reducers = {
  ui: uiReducer,
  routing: routerReducer,
  app: app,
  env: env
}

export default reducers
