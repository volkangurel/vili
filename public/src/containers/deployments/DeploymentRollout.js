import React, { PropTypes } from 'react'
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
import { subDeploymentPods, unsubDeploymentPods } from '../../actions/deploymentPods'

// const rolloutStrategies = [
//   'RollingUpdate',
//   'Recreate'
// ]

function mapStateToProps (state, ownProps) {
  const deployments = state.deployments.toJS()
  const deployment = deployments.envs &&
                     deployments.envs[ownProps.params.env] &&
                     deployments.envs[ownProps.params.env][ownProps.params.deployment]

  const deploymentPods = state.deploymentPods.toJS()
  const pods = (deploymentPods.envs &&
                deploymentPods.envs[ownProps.params.env] &&
                deploymentPods.envs[ownProps.params.env][ownProps.params.deployment]) ||
               {}

  return {
    deployment,
    pods
  }
}

@connect(mapStateToProps)
export default class DeploymentRollout extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func,
    params: PropTypes.object, // react router provides this
    location: PropTypes.object, // react router provides this
    deployment: PropTypes.object,
    pods: PropTypes.object
  }

  componentDidMount () {
    this.props.dispatch(activateDeploymentTab('rollouts'))
    this.subData()
  }

  componentDidUpdate (prevProps) {
    if (this.props.params !== prevProps.params) {
      this.unsubData()
      this.subData()
    }
  }

  componentWillUnmount () {
    this.unsubData()
  }

  subData = () => {
    const { params } = this.props
    this.props.dispatch(getDeployments(params.env, params.deployment))
    this.props.dispatch(subDeploymentPods(params.env, params.deployment))
  }

  unsubData = () => {
    const { params } = this.props
    this.props.dispatch(unsubDeploymentPods(params.env, params.deployment))
  }

  render () {
    const { params, deployment, pods } = this.props
    if (!deployment) {
      return (<Loading />)
    }
    const desiredReplicas = parseInt(deployment.replicaSet.metadata.annotations['deployment.kubernetes.io/desired-replicas'])

    const toRollout = _.find(deployment.rolloutHistory, function (rollout) {
      return rollout.metadata.annotations['deployment.kubernetes.io/revision'] === params.rollout
    })
    if (!toRollout) {
      return (<Loading />)
    }
    const { fromRevision } = toRollout.metadata.labels

    const fromRollout = fromRevision && _.find(deployment.rolloutHistory, function (rollout) {
      return rollout.metadata.annotations['deployment.kubernetes.io/revision'] === fromRevision
    })

    var fromPods
    if (fromRollout) {
      fromPods = _.filter(pods, function (pod) {
        return pod.metadata.generateName === (fromRollout.metadata.name + '-')
      })
    }

    const toPods = _.filter(pods, function (pod) {
      return pod.metadata.generateName === (toRollout.metadata.name + '-')
    })

    return (
      <div className='rollout'>
        <DeploymentHeader
          env={params.env}
          deployment={params.deployment}
          rollout={params.rollout}
        />
        <div className='row'>
          <RolloutPods
            title='From'
            desiredReplicas={desiredReplicas}
            env={params.env}
            deployment={deployment}
            pods={fromPods}
          />
          <RolloutPods
            title='To'
            desiredReplicas={desiredReplicas}
            env={params.env}
            deployment={deployment}
            pods={toPods}
          />
        </div>
        <Logs />
      </div>
    )
  }
}

class DeploymentHeader extends React.Component {
  resume = () => {
    this.setState({disabled: true})
    viliApi.deployments.resume(this.props.env, this.props.app, this.props.deployment)
  }

  pause = () => {
    this.setState({disabled: true})
    viliApi.deployments.pause(this.props.env, this.props.app, this.props.deployment)
  }

  rollback = () => {
    this.setState({disabled: true})
    viliApi.deployments.rollback(this.props.env, this.props.app, this.props.deployment)
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
        </div>
      </div>
    )
  }
}

class RolloutPods extends React.Component {
  static propTypes = {
    title: PropTypes.string,
    env: PropTypes.string,
    desiredReplicas: PropTypes.number,
    pods: PropTypes.array
  }

  render () {
    const { title, env, desiredReplicas } = this.props
    const columns = [
      {title: 'Name', key: 'name'},
      {title: 'Created', key: 'created'},
      {title: 'Phase', key: 'phase'}
    ]

    if (title === 'To') {
      columns.push({title: 'Ready', key: 'ready'})
      columns.push({title: 'Host', key: 'host'})
    }

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
        name: (<Link to={`/${env}/pods/${pod.metadata.name}`}>{pod.metadata.name}</Link>),
        created: displayTime(new Date(pod.metadata.creationTimestamp)),
        phase: pod.status.phase,
        ready: ready ? String.fromCharCode('10003') : '',
        host: (<Link to={`/${env}/nodes/${pod.spec.nodeName}`}>{pod.spec.nodeName}</Link>)
      }
    })

    if (title === 'From') {
      for (var i = rows.length; i < desiredReplicas; i++) {
        rows.push({
          _className: 'text-muted',
          name: '-',
          phase: 'Deleted'
        })
      }
    }

    return (
      <div className={title === 'From' ? 'col-md-4' : 'col-md-8'}>
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
