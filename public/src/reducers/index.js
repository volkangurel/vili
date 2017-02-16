import { reducer as uiReducer } from 'redux-ui'
import { routerReducer } from 'react-router-redux'

import app from './app'
import deployments from './deployments'
import deploymentPods from './deploymentPods'
import jobs from './jobs'
import jobRuns from './jobRuns'

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
  deployments: deployments,
  deploymentPods: deploymentPods,
  jobs: jobs,
  jobRuns: jobRuns
}

export default reducers
