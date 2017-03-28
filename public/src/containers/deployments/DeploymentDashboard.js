import React, { PropTypes } from 'react'
import { connect } from 'react-redux'
import { Link } from 'react-router'
import { Panel, Button } from 'react-bootstrap'
import _ from 'underscore'

import displayTime from '../../lib/displayTime'
import Table from '../../components/Table'
import Loading from '../../components/Loading'
import { activateDeploymentTab } from '../../actions/app'
import { getDeployments } from '../../actions/deployments'
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

  renderPodPanels () {
    const { params, deployment, pods } = this.props
    return _.map(deployment.rolloutHistory, (replicaSet) => {
      return (
        <RolloutPanel
          key={replicaSet.metadata.name}
          env={params.env}
          deployment={deployment}
          replicaSet={replicaSet}
          pods={pods}
        />
      )
    })
  }

  renderHistoryTable () {
    const { deployment } = this.props
    const deploymentRevision = deployment.replicaSet.metadata.annotations['deployment.kubernetes.io/revision']
    const columns = [
      {title: 'Revision', key: 'revision'},
      {title: 'Tag', key: 'tag'},
      {title: 'Time', key: 'time'},
      {title: 'Replicas', key: 'replicas'},
      {title: 'Actions', key: 'actions'}
    ]

    const rows = _.map(deployment.rolloutHistory, (replicaSet) => {
      return {
        component: (
          <HistoryRow
            key={revision}
            revision={revision}
            tag={replicaSet.spec.template.spec.containers[0].image.split(':')[1]}
            time={new Date(replicaSet.metadata.creationTimestamp)}
            replicas={replicaSet.status.replicas}
            deploymentRevision={deploymentRevision}
            env={this.props.params.env}
            deployment={this.props.params.deployment}
          />
        )
      }
    })
    return (<Table columns={columns} rows={rows} />)
  }

  render () {
    const { deployments, deployment } = this.props
    if (deployments.isFetching || !deployment) {
      return (<Loading />)
    }
    return (
      <div>
        {this.renderPodPanels()}
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

  rollback = (event) => {
    const self = this
    event.target.setAttribute('disabled', 'disabled')
    // TODO send action
    viliApi.rollouts.create(this.props.env, this.props.deployment, {
      tag: this.props.data.tag,
      branch: this.props.data.branch,
      trigger: false
    }).then(function (deployment) {
      router.transitionTo(`/${self.props.env}/apps/${self.props.app}/deployments/${deployment.id}`)
    })
  }

  deletePod = (event, pod) => {
    event.target.setAttribute('disabled', 'disabled')
    this.props.dispatch(deletePod(this.props.env, pod))
  }

  renderReplicaSetTable () {
    return null
    const { deployment, replicaSet } = this.props
    const { readyReplicas, replicas } = replicaSet.status
    const revision = replicaSet.metadata.annotations['deployment.kubernetes.io/revision']
    const tag = replicaSet.spec.template.spec.containers[0].image.split(':')[1]
    const time = displayTime(new Date(replicaSet.metadata.creationTimestamp))
    const replicasStatus = `${readyReplicas || 0}/${replicas}`
    const actions = []
    if (replicaSet.metadata.name !== deployment.replicaSet.metadata.name) {
      actions.push(
        <Button bsStyle='danger' bsSize='xs' onClick={this.rollback}>Rollback</Button>
      )
    }
    const columns = [
      {title: 'Revision', key: 'revision'},
      {title: 'Tag', key: 'tag'},
      {title: 'Time', key: 'time'},
      {title: 'Replicas', key: 'replicasStatus'},
      {title: 'Actions', key: 'actions'}
    ]
    const rows = [
      {
        revision,
        tag,
        time,
        replicasStatus,
        actions
      }
    ]
    return (<Table columns={columns} rows={rows} fill />)
  }

  renderPodsTable () {
    const self = this
    const { env, replicaSet, pods } = this.props
    const generateName = replicaSet.metadata.name + '-'
    const replicaSetPods = _.filter(pods, (pod) => {
      return pod.metadata.generateName === generateName
    })
    if (replicaSetPods.length === 0) {
      return null
    }

    const columns = [
      {title: 'Name', key: 'name'},
      {title: 'Host', key: 'host'},
      {title: 'Phase', key: 'phase'},
      {title: 'Ready', key: 'ready'},
      {title: 'Pod IP', key: 'pod_ip'},
      {title: 'Created', key: 'created'},
      {title: 'Actions', key: 'actions'}
    ]

    const rows = _.map(replicaSetPods, (pod) => {
      const ready = pod.status.phase === 'Running' &&
                    _.every(pod.status.containerStatuses, (cs) => cs.ready)

      const nameLink = (<Link to={`/${env}/pods/${pod.metadata.name}`}>{pod.metadata.name}</Link>)
      const hostLink = (<Link to={`/${env}/nodes/${pod.spec.nodeName}`}>{pod.spec.nodeName}</Link>)
      var actions = (
        <Button
          onClick={(event) => self.deletePod(event, pod.metadata.name)}
          bsStyle='danger'
          bsSize='xs'
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
    const { env, deployment, replicaSet } = this.props
    //    const revision = replicaSet.metadata.annotations['deployment.kubernetes.io/revision']
    const revision = replicaSet.metadata.annotations['deployment.kubernetes.io/revision']
    const tag = replicaSet.spec.template.spec.containers[0].image.split(':')[1]
    const time = new Date(replicaSet.metadata.creationTimestamp)

    var bsStyle = ''
    if (replicaSet.metadata.name === deployment.replicaSet.metadata.name) {
      bsStyle = 'success'
    } else if (replicaSet.status.replicas > 0) {
      bsStyle = 'warning'
    }

    return (
      <Panel
        key={replicaSet.metadata.name}
        header={<strong>{replicaSet.metadata.name}</strong>}
        bsStyle={bsStyle}
      >
        {this.renderReplicaSetTable()}
        {this.renderPodsTable()}
      </Panel>
    )


    return (
      <tr className={className}>
        <td data-column='revision'><Link to={`/${env}/deployments/${deployment}/rollouts/${revision}`}>{revision}</Link></td>
        <td data-column='tag'>{tag}</td>
        <td data-column='time'>{displayTime(time)}</td>
        <td data-column='replicas'>{replicas}</td>
        <td data-column='actions'>
          <button type='button' className='btn btn-xs btn-danger' onClick={this.rollback}>Rollback</button>
        </td>
      </tr>
    )
  }
}
