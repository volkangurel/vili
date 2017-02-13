/* global prompt */
import React from 'react'
import { connect } from 'react-redux'
import { Button, ButtonToolbar } from 'react-bootstrap'
import { Link } from 'react-router'
import _ from 'underscore'
import displayTime from '../../lib/displayTime'
import Table from '../../components/Table'
import { activateDeploymentTab } from '../../actions/app'
import { scaleDeployment } from '../../actions/deployments'
import { subDeploymentPods, unsubDeploymentPods } from '../../actions/deploymentPods'
import { deletePod } from '../../actions/pods'

function mapStateToProps (state) {
  return {
    deploymentPods: state.deploymentPods.toJS()
  }
}

@connect(mapStateToProps)
export default class DeploymentPods extends React.Component {

  subData = () => {
    this.props.dispatch(subDeploymentPods(this.props.params.env, this.props.params.deployment))
  }

  unsubData = () => {
    this.props.dispatch(unsubDeploymentPods(this.props.params.env, this.props.params.deployment))
  }

  scale = () => {
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

  deletePod = (pod) => {
    this.props.dispatch(deletePod(this.props.params.env, pod))
  }

  componentDidMount () {
    this.props.dispatch(activateDeploymentTab('pods'))
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

  render () {
    const deploymentPods = this.props.deploymentPods
    const pods = (deploymentPods.envs &&
      deploymentPods.envs[this.props.params.env] &&
      deploymentPods.envs[this.props.params.env][this.props.params.deployment]) ||
      []
    var self = this
    var columns = _.union([
      {title: 'Name', key: 'name'},
      {title: 'Host', key: 'host'},
      {title: 'Phase', key: 'phase'},
      {title: 'Ready', key: 'ready'},
      {title: 'Pod IP', key: 'pod_ip'},
      {title: 'Created', key: 'created'},
      {title: 'Actions', key: 'actions'}
    ])

    var rows = _.map(pods, function (pod) {
      var ready = pod.status.phase === 'Running' &&
                _.every(pod.status.containerStatuses, function (cs) {
                  return cs.ready
                })

      const nameLink = (<Link to={`/${self.props.params.env}/pods/${pod.metadata.name}`}>{pod.metadata.name}</Link>)
      const hostLink = (<Link to={`/${self.props.params.env}/nodes/${pod.spec.nodeName}`}>{pod.spec.nodeName}</Link>)
      var actions = (
        <Button onClick={self.deletePod.bind(self, pod.metadata.name)} bsStyle='danger' bsSize='xs'>Delete</Button>
      )
      return {
        name: nameLink,
        host: hostLink,
        // deployment: deploymentLink,
        phase: pod.status.phase,
        ready: ready ? String.fromCharCode('10003') : '',
        pod_ip: pod.status.podIP,
        created: displayTime(new Date(pod.metadata.creationTimestamp)),
        actions: actions
      }
    })

    return (
      <div>
        <ButtonToolbar className='pull-right'>
          <Button onClick={this.scale} bsStyle='success' bsSize='small'>Scale</Button>
        </ButtonToolbar>
        <Table columns={columns} rows={rows} />
      </div>
    )
  }

}
