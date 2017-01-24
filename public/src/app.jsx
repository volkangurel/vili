import React from 'react'
import ReactDOM from 'react/lib/ReactDOM'
import { Provider } from 'react-redux'
import { browserHistory } from 'react-router'
import { syncHistoryWithStore } from 'react-router-redux'

import configureStore from './store'
import router from './router'
import initFirebase from './lib/firebase'

import './less/app.less'

window.addEventListener('DOMContentLoaded', () => {
  let initialState = {}
  if (window.appConfig) {
    initialState.user = window.appConfig.user
    initialState.defaultEnv = window.appConfig.defaultEnv
    initialState.envs = window.appConfig.envs
    initialState.firebase = initFirebase(window.appConfig.firebase)
  }

  const store = configureStore(initialState)
  const history = syncHistoryWithStore(browserHistory, store)

  ReactDOM.render(
    <Provider store={store}>
      {router(history)}
    </Provider>, document.getElementById('app'))
})
