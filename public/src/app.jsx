import React from 'react'
import ReactDOM from 'react/lib/ReactDOM'
import { Provider } from 'react-redux'
import { browserHistory } from 'react-router'
import { syncHistoryWithStore } from 'react-router-redux'

import configureStore from './store'
import router from './router'
import style from './less/app.less'
style.use()

window.addEventListener('DOMContentLoaded', () => {
  // const store = configureStore({ session: window.appConfig.user })
  const store = configureStore({})
  const history = syncHistoryWithStore(browserHistory, store)

  ReactDOM.render(
    <Provider store={store}>
      {router(history)}
    </Provider>, document.body)
})
