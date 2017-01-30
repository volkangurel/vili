import React from 'react'
import { connect } from 'react-redux'
import { Link } from 'react-router'
import _ from 'underscore'

import displayTime from '../../lib/displayTime'
import Table from '../../components/Table'
import Loading from '../../components/Loading'
import { activateDeploymentTab } from '../../actions/app'
import { getDeployments } from '../../actions/deployments'

function mapStateToProps (state) {
  return {
    deployments: state.deployments.toJS()
  }
}

@connect(mapStateToProps)
export default class DeploymentRollouts extends React.Component {

  get deployment () {
    return (this.props.deployments.envs &&
      this.props.deployments.envs[this.props.params.env] &&
      this.props.deployments.envs[this.props.params.env][this.props.params.deployment])
  }

  getRolloutRow (deployment, replicaSet) {
    const deploymentRevision = deployment.replicaSet.metadata.annotations['deployment.kubernetes.io/revision']
    const revision = replicaSet.metadata.annotations['deployment.kubernetes.io/revision']
    return {
      component: (
        <Row
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
  }

  render () {
    const self = this
    if (this.props.deployments.isFetching || !this.deployment) {
      return (<Loading />)
    }

    const columns = [
      {title: 'Revision', key: 'revision'},
      {title: 'Tag', key: 'tag'},
      {title: 'Time', key: 'time'},
      {title: 'Replicas', key: 'replicas'},
      {title: 'Actions', key: 'actions'}
    ]

    const rows = _.map(this.deployment.rolloutHistory, function (replicaSet) {
      return self.getRolloutRow(self.deployment, replicaSet)
    })
    return (<Table columns={columns} rows={rows} />)
  }

  componentDidMount () {
    this.props.dispatch(activateDeploymentTab('rollouts'))
    this.props.dispatch(getDeployments(this.props.params.env, this.props.params.deployment))
  }

  componentDidUpdate (prevProps) {
    if (this.props.params !== prevProps.params) {
      this.props.dispatch(getDeployments(this.props.params.env, this.props.params.deployment))
    }
  }

}

class Row extends React.Component {
  constructor (props) {
    super(props)
    this.rollback = this.rollback.bind(this)
  }

  render () {
    const { revision, tag, time, replicas, deploymentRevision, env, deployment } = this.props
    var className = ''
    if (revision === deploymentRevision) {
      className = 'success'
    } else if (replicas > 0) {
      className = 'warning'
    }
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

  rollback (event) {
    var self = this
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

}
