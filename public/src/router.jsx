import React from 'react'
import { Router, Route, IndexRoute } from 'react-router'

import App from './containers/App'
import Home from './containers/Home'
import Environment from './containers/Environment'
import EnvironmentHome from './containers/EnvironmentHome'
// migrations
import MigrationsBase from './containers/migrations/MigrationsBase'
import Migrations from './containers/migrations/Migrations'
import MigrationsSpec from './containers/migrations/MigrationsSpec'
import MigrationsRuns from './containers/migrations/MigrationsRuns'
import MigrationsRun from './containers/migrations/MigrationsRun'
// deployments
import DeploymentsList from './containers/deployments/DeploymentsList'
import DeploymentBase from './containers/deployments/DeploymentBase'
import Deployment from './containers/deployments/Deployment'
import DeploymentSpec from './containers/deployments/DeploymentSpec'
import DeploymentPods from './containers/deployments/DeploymentPods'
import DeploymentService from './containers/deployments/DeploymentService'
import DeploymentRollouts from './containers/deployments/DeploymentRollouts'
// pods
import { PodsList, Pod } from './pods'
// nodes
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
        <Route path='/:env' component={Environment}>
          <IndexRoute component={EnvironmentHome} />
          <Route path='migrations' component={MigrationsBase}>
            <IndexRoute component={Migrations} />
            <Route path='spec' component={MigrationsSpec} />
            <Route path='runs' component={MigrationsRuns} />
            <Route path='runs/:run' component={MigrationsRun} />
          </Route>
          <Route path='deployments' component={DeploymentsList} />
          <Route path='deployments/:deployment' component={DeploymentBase}>
            <IndexRoute component={Deployment} />
            <Route path='rollouts' component={DeploymentRollouts} />
            <Route path='pods' component={DeploymentPods} />
            <Route path='service' component={DeploymentService} />
            <Route path='spec' component={DeploymentSpec} />
          </Route>
          <Route path='pods' component={PodsList} />
          <Route path='pods/:pod' component={Pod} />
          <Route path='nodes' component={NodesList} />
          <Route path='nodes/:node' component={Node} />
        </Route>
        <Route path='*' component={NotFoundPage} />
      </Route>
    </Router>
  )
}
