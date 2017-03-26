import React from 'react'
import { connect } from 'react-redux'
import { Link } from 'react-router'
import { Alert, ButtonGroup, Button } from 'react-bootstrap'
import _ from 'underscore'
import moment from 'moment'
import 'moment-duration-format'

import displayTime from '../../lib/displayTime'
import Table from '../../components/Table'
import Loading from '../../components/Loading'
import { activateDeploymentTab } from '../../actions/app'
import { getDeployments } from '../../actions/deployments'
import { getDeploymentPods } from '../../actions/deploymentPods'

// const rolloutStrategies = [
//   'RollingUpdate',
//   'Recreate'
// ]

function mapStateToProps (state) {
  return {
    deployments: state.deployments.toJS(),
    deploymentPods: state.deploymentPods.toJS()
  }
}

@connect(mapStateToProps)
export default class DeploymentRollout extends React.Component {

  loadData = () => {
    this.props.dispatch(getDeploymentPods(this.props.params.env, this.props.params.deployment))
  }

  get deployment () {
    return (this.props.deployments.envs &&
      this.props.deployments.envs[this.props.params.env] &&
      this.props.deployments.envs[this.props.params.env][this.props.params.deployment])
  }

  render () {
    const self = this
    const deployment = this.deployment
    if (!this.deployment) {
      return (<Loading />)
    }

    const fromRollout = _.find(deployment.rolloutHistory, function (rollout) {
      return rollout.metadata.annotations['deployment.kubernetes.io/revision'] === self.props.location.query.from
    })
    const toRollout = _.find(deployment.rolloutHistory, function (rollout) {
      return rollout.metadata.annotations['deployment.kubernetes.io/revision'] === self.props.params.rollout
    })

    const deploymentPods = this.props.deploymentPods
    const pods = (deploymentPods.envs &&
      deploymentPods.envs[this.props.params.env] &&
      deploymentPods.envs[this.props.params.env][this.props.params.deployment]) ||
      []

    var fromPods
    if (fromRollout) {
      fromPods = _.filter(pods, function (pod) {
        return pod.metadata.generateName === (fromRollout.metadata.name + '-')
      })
    }

    const toPods = _.filter(pods, function (pod) {
      return pod.metadata.generateName === (toRollout.metadata.name + '-')
    })

    console.log(fromPods)
    console.log(toPods)

    return (
      <div className='rollout'>
        <DeploymentHeader
          env={this.props.params.env}
          deployment={this.props.params.deployment}
          rollout={this.props.params.rollout}
        />
        <div className='row'>
          <RolloutPods
            title='From'
            env={this.props.params.env}
            deployment={deployment}
            rollout={this.props.params.rollout}
            pods={fromPods}
          />
          <RolloutPods
            title='To'
            env={this.props.params.env}
            deployment={deployment}
            rollout={this.props.params.rollout}
            pods={toPods}
          />
        </div>
        <Logs />
      </div>
    )
  }

  componentDidMount () {
    this.props.dispatch(activateDeploymentTab('rollouts'))
    this.props.dispatch(getDeployments(this.props.params.env, this.props.params.deployment))
    this.loadData()
    this.dataInterval = setInterval(this.loadData, 3000)
  }

  componentDidUpdate (prevProps) {
    if (this.props.params !== prevProps.params) {
      this.props.dispatch(getDeployments(this.props.params.env, this.props.params.deployment))
      this.loadData()
    }
  }

}

class DeploymentHeader extends React.Component {
  constructor (props) {
    super(props)

    this.pause = this.pause.bind(this)
    this.resume = this.resume.bind(this)
    this.rollback = this.rollback.bind(this)
  }

  render () {
    var banner = null
    var buttons = null
    switch (this.props.state) {
      case 'new':
        buttons = [
          <Button bsStyle='success' onClick={this.deploy} disabled={this.state.disabled}>Deploy</Button>
        ]
        break
      case 'running':
        buttons = [
          <Button bsStyle='warning' onClick={this.pause} disabled={this.state.disabled}>Pause</Button>
        ]
        break
      case 'pausing':
        buttons = [
          <Button bsStyle='warning' disabled>Pausing...</Button>,
          <Button bsStyle='warning' onClick={this.pause} disabled={this.state.disabled}>Force Pause</Button>
        ]
        break
      case 'paused':
        buttons = [
          <Button bsStyle='success' onClick={this.deploy} disabled={this.state.disabled}>Resume</Button>,
          <Button bsStyle='danger' onClick={this.rollback} disabled={this.state.disabled}>Rollback</Button>
        ]
        break
      case 'rollingback':
        buttons = [
          <Button bsStyle='danger' disabled>Rolling Back...</Button>
        ]
        break
      case 'rolledback':
        banner = (<Alert bsStyle='danger'>Rolled back</Alert>)
        break
      case 'completed':
        banner = (<Alert bsStyle='success'>Deployment complete</Alert>)
        break
    }

    return (
      <div className='deployment-header'>
        {banner}
        <div className='row'>
          <div className='col-md-offset-8 col-md-4'>
            <ButtonGroup className='pull-right'>
              {buttons}
            </ButtonGroup>
          </div>
          <div className='col-md-2'>
            <Clock />
          </div>
        </div>
      </div>
    )
  }

  resume () {
    this.setState({disabled: true})
    viliApi.deployments.resume(this.props.env, this.props.app, this.props.deployment)
  }

  pause () {
    this.setState({disabled: true})
    viliApi.deployments.pause(this.props.env, this.props.app, this.props.deployment)
  }

  rollback () {
    this.setState({disabled: true})
    viliApi.deployments.rollback(this.props.env, this.props.app, this.props.deployment)
  }

}

class Clock extends React.Component {
  render () {
    return (
      <div className='deploy-clock'>
        {moment.duration(this.props.val || 0).format('m[m]:ss[s]')}
      </div>
    )
  }
}

class RolloutPods extends React.Component {

  render () {
    var self = this
    var columns = [
      {title: 'Name', key: 'name'},
      {title: 'Created', key: 'created'},
      {title: 'Phase', key: 'phase'},
      {title: 'Ready', key: 'ready'},
      {title: 'Host', key: 'host'}
    ]

    /*
    const podsMap = {}
    const originalKeys = _.map(this.props.pods, function(pod) {
      podsMap[pod.name] = pod
      return pod.name
    })
    const fromKeys = _.map(this.state.fromPods, function(pod) {
      podsMap[pod.name] = pod
      fromKeys.push(pod.name)
    })

    var allKeys = _.union(originalKeys, fromKeys)
 */

    const desiredReplicas = parseInt(this.props.deployment.replicaSet.metadata.annotations['deployment.kubernetes.io/desired-replicas'])
    var readyCount = 0

    const rows = _.map(this.props.pods, function (pod) {
      const ready = pod.status.phase === 'Running' &&
        _.every(pod.status.containerStatuses, function (cs) {
          return cs.ready
        })
      if (ready) {
        readyCount += 1
      }
      return {
        name: (<Link to={`/${self.props.env}/pods/${pod.metadata.name}`}>{pod.metadata.name}</Link>),
        created: displayTime(new Date(pod.metadata.creationTimestamp)),
        phase: pod.status.phase,
        ready: ready ? String.fromCharCode('10003') : '',
        host: (<Link to={`/${self.props.env}/nodes/${pod.spec.nodeName}`}>{pod.spec.nodeName}</Link>)
      }
    })

    if (this.props.title === 'From') {
      for (var i = rows.length; i < desiredReplicas; i++) {
        rows.push({
          _className: 'text-muted',
          name: '-',
          phase: 'Deleted'
        })
      }
    }

    return (
      <div className='col-md-6'>
        <h3>{`${this.props.title} Pods (${readyCount}/${desiredReplicas})`}</h3>
        <Table columns={columns} rows={rows} />
      </div>
    )
  }
}

class Logs extends React.Component {

  render () {
    const columns = [
      {title: 'Time', key: 'time'},
      {title: 'Message', key: 'message'}
    ]

    const rows = _.map(this.props.log, function (item) {
      return {
        time: moment(new Date(item.time)).format('YYYY-MM-DD HH:mm:ss'),
        message: item.msg
      }
    })
    rows.reverse()
    return (
      <div className='logs'>
        <h3>Log</h3>
        <Table columns={columns} rows={rows} />
      </div>
    )
  }
}
