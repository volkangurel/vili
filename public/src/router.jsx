import React from 'react'
import { Router, Route, IndexRoute } from 'react-router'

import App from './containers/App'
import Home from './containers/Home'
import EnvironmentHome from './containers/EnvironmentHome'

import { MigrationsBase, Migrations, MigrationsSpec, MigrationsRuns, MigrationsRun } from './migrations'
import { DeploymentsList, DeploymentBase, Deployment, DeploymentSpec, DeploymentPods, DeploymentService, DeploymentRollouts } from './deployments'
import { PodsList, Pod } from './pods'
import { NodesList, Node } from './nodes'

class NotFoundPage extends React.Component {
  render () {
    return (
      <div>NOT FOUND</div>
    )
  }
}

export default function (history) {
  return (
    <Router history={history}>
      <Route path='/' component={App}>
        <IndexRoute component={Home} />
        <Route path='/:env' handler={Environment}>
          <IndexRoute handler={EnvironmentHome} />
          <Route path='migrations' handler={MigrationsBase}>
            <IndexRoute handler={Migrations} />
            <Route path='spec' handler={MigrationsSpec} />
            <Route path='runs' handler={MigrationsRuns} />
            <Route path='runs/:run' handler={MigrationsRun} />
          </Route>
          <Route path='deployments' handler={DeploymentsList} />
          <Route path='deployments/:deployment' handler={DeploymentBase}>
            <IndexRoute handler={Deployment} />
            <Route path='pods' handler={DeploymentPods} />
            <Route path='rollouts' handler={DeploymentRollouts} />
            <Route path='spec' handler={DeploymentSpec} />
            <Route path='service' handler={DeploymentService} />
          </Route>
          <Route path='pods' handler={PodsList} />
          <Route path='pods/:pod' handler={Pod} />
          <Route path='nodes' handler={NodesList} />
          <Route path='nodes/:node' handler={Node} />
          <Route path='*' component={NotFoundPage} />
        </Route>
      </Route>
    </Router>
  )
}
