import React, { PropTypes } from 'react'
import { connect } from 'react-redux'
import { Link } from 'react-router'
import { Panel, ButtonToolbar, Button, Badge } from 'react-bootstrap'
import _ from 'underscore'

import displayTime from '../../lib/displayTime'
import Table from '../../components/Table'
import Loading from '../../components/Loading'
import { activateDeploymentTab } from '../../actions/app'
import { getDeployments, scaleDeployment } from '../../actions/deployments'
import { subDeploymentPods, unsubDeploymentPods } from '../../actions/deploymentPods'
import { deletePod } from '../../actions/pods'

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
    deployments,
    deployment,
    pods
  }
}

@connect(mapStateToProps)
export default class DeploymentDashboard extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func,
    params: PropTypes.object, // react router provides this
    location: PropTypes.object, // react router provides this
    deployments: PropTypes.object,
    deployment: PropTypes.object,
    pods: PropTypes.object
  }

  componentDidMount () {
    this.props.dispatch(activateDeploymentTab('dashboard'))
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

  scaleDeployment = () => {
    var replicas = prompt('Enter the number of replicas to scale to')
    if (!replicas) {
      return
    }
    replicas = parseInt(replicas)
    if (_.isNaN(replicas)) {
      return
    }
    this.props.dispatch(scaleDeployment(this.props.params.env, this.props.params.deployment, replicas))
  }

  renderHeader () {
    return (
      <div className='clearfix' style={{marginBottom: '10px'}}>
        <ButtonToolbar className='pull-right'>
          <Button bsStyle='success' bsSize='small' onClick={this.resumeDeployment}>Resume</Button>
          <Button bsStyle='warning' bsSize='small' onClick={this.pauseDeployment}>Pause</Button>
          <Button bsStyle='danger' bsSize='small' onClick={this.rollbackDeployment}>Rollback</Button>
          <Button bsStyle='info' bsSize='small' onClick={this.scaleDeployment}>Scale</Button>
        </ButtonToolbar>
      </div>
    )
  }

  renderPodPanels () {
    const { params, deployment, pods } = this.props
    return _.map(deployment.rolloutHistory, (replicaSet) => {
      const replicaSetPods = getReplicaSetPods(replicaSet, pods)
      if (replicaSetPods.length === 0 && replicaSet.metadata.name !== deployment.replicaSet.metadata.name) {
        return null
      }
      return (
        <RolloutPanel
          key={replicaSet.metadata.name}
          env={params.env}
          deployment={deployment}
          replicaSet={replicaSet}
          pods={replicaSetPods}
        />
      )
    })
  }

  renderHistoryTable () {
    const { deployment, pods } = this.props
    const columns = [
      {title: 'Revision', key: 'revision'},
      {title: 'Tag', key: 'tag'},
      {title: 'Time', key: 'time'},
      {title: 'Actions', key: 'actions'}
    ]

    const rows = _.map(deployment.rolloutHistory, (replicaSet) => {
      const replicaSetPods = getReplicaSetPods(replicaSet, pods)
      if (replicaSetPods.length > 0 || replicaSet.metadata.name === deployment.replicaSet.metadata.name) {
        return null
      }
      return {
        component: (
          <HistoryRow
            key={replicaSet.metadata.name}
            replicaSet={replicaSet}
          />
        )
      }
    })
    return (
      <div>
        <h4>Rollout History</h4>
        <Table columns={columns} rows={rows} />
      </div>
    )
  }

  render () {
    const { deployments, deployment } = this.props
    if (deployments.isFetching || !deployment) {
      return (<Loading />)
    }
    return (
      <div>
        {this.renderHeader()}
        {this.renderPodPanels()}
        {this.renderHistoryTable()}
      </div>
    )
  }

}

@connect()
class RolloutPanel extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func,
    env: PropTypes.string,
    deployment: PropTypes.object,
    replicaSet: PropTypes.object,
    pods: PropTypes.object
  }

  deletePod = (event, pod) => {
    event.target.setAttribute('disabled', 'disabled')
    this.props.dispatch(deletePod(this.props.env, pod))
  }

  renderReplicaSetMetadata () {
    const { replicaSet } = this.props
    const tag = replicaSet.spec.template.spec.containers[0].image.split(':')[1]
    const time = displayTime(new Date(replicaSet.metadata.creationTimestamp))
    return (
      <div>
        <dl>
          <dt>Tag</dt><dd>{tag}</dd>
          <dt>Time</dt><dd>{time}</dd>
        </dl>
      </div>
    )
  }

  renderPodsTable () {
    const self = this
    const { env, pods } = this.props
    if (pods.length === 0) {
      return null
    }
    const columns = [
      {title: 'Pod', key: 'name'},
      {title: 'Host', key: 'host'},
      {title: 'Phase', key: 'phase'},
      {title: 'Ready', key: 'ready'},
      {title: 'Pod IP', key: 'pod_ip'},
      {title: 'Created', key: 'created'},
      {title: 'Actions', key: 'actions'}
    ]

    const rows = _.map(pods, (pod) => {
      const ready = pod.status.phase === 'Running' &&
                    _.every(pod.status.containerStatuses, (cs) => cs.ready)

      const nameLink = (<Link to={`/${env}/pods/${pod.metadata.name}`}>{pod.metadata.name}</Link>)
      const hostLink = (<Link to={`/${env}/nodes/${pod.spec.nodeName}`}>{pod.spec.nodeName}</Link>)
      var actions = (
        <Button
          bsStyle='danger'
          bsSize='xs'
          onClick={(event) => self.deletePod(event, pod.metadata.name)}
        >
          Delete
        </Button>
      )
      return {
        name: nameLink,
        host: hostLink,
        phase: pod.status.phase,
        ready: ready ? String.fromCharCode('10003') : '',
        pod_ip: pod.status.podIP,
        created: displayTime(new Date(pod.metadata.creationTimestamp)),
        actions
      }
    })

    return (<Table columns={columns} rows={rows} fill />)
  }

  render () {
    const { deployment, replicaSet, pods } = this.props
    const revision = replicaSet.metadata.annotations['deployment.kubernetes.io/revision']
    var bsStyle = ''
    if (replicaSet.metadata.name === deployment.replicaSet.metadata.name) {
      bsStyle = 'success'
    } else {
      bsStyle = 'warning'
    }

    const header = (
      <div>
        <strong>{revision}</strong>
        <Badge bsStyle={bsStyle} pullRight>{pods.length}/{replicaSet.status.replicas}</Badge>
      </div>
    )
    return (
      <Panel
        key={replicaSet.metadata.name}
        header={header}
        bsStyle={bsStyle}
      >
        {this.renderReplicaSetMetadata()}
        {this.renderPodsTable()}
      </Panel>
    )
  }
}

class HistoryRow extends React.Component {
  static propTypes = {
    replicaSet: PropTypes.object
  }

  rollbackTo = (event) => {
    const { env, deployment, revision } = this.props
    event.target.setAttribute('disabled', 'disabled')
    /* this.props.dispatch(rollbackDeployment(env, deployment, revision))*/

    // TODO send action
    /* viliApi.rollouts.create(this.props.env, this.props.deployment, {
     *   tag: this.props.data.tag,
     *   branch: this.props.data.branch,
     *   trigger: false
     * }).then(function (deployment) {
     *   router.transitionTo(`/${self.props.env}/apps/${self.props.app}/deployments/${deployment.id}`)
     * })*/
  }

  render () {
    const { replicaSet } = this.props
    const revision = replicaSet.metadata.annotations['deployment.kubernetes.io/revision']
    const tag = replicaSet.spec.template.spec.containers[0].image.split(':')[1]
    const time = displayTime(new Date(replicaSet.metadata.creationTimestamp))
    return (
      <tr>
        <td data-column='revision'>{revision}</td>
        <td data-column='tag'>{tag}</td>
        <td data-column='time'>{time}</td>
        <td data-column='actions'>
          <Button bsStyle='warning' bsSize='xs' onClick={this.rollbackTo}>Rollback To</Button>
        </td>
      </tr>
    )
  }
}

function getReplicaSetPods (replicaSet, pods) {
  const generateName = replicaSet.metadata.name + '-'
  return _.filter(pods, (pod) => {
    return pod.metadata.generateName === generateName
  })
}
