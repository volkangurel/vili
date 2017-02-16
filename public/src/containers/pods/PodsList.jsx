import React from 'react'
import { connect } from 'react-redux'
import { Link } from 'react-router'
import _ from 'underscore'

import displayTime from '../../lib/displayTime'
import Table from '../../components/Table'
import Loading from '../../components/Loading'
import { activateNav } from '../../actions/app'
import { subPods, unsubPods, deletePod } from '../../actions/pods'

function mapStateToProps (state) {
  return {
    deploymentPods: state.deploymentPods.toJS()
  }
}

@connect(mapStateToProps)
export default class PodsList extends React.Component {

  subData = () => {
    this.props.dispatch(subPods(this.props.params.env))
  }

  unsubData = () => {
    this.props.dispatch(unsubPods(this.props.params.env))
  }

  componentDidMount () {
    this.props.dispatch(activateNav('pods'))
  }

  render () {
    const self = this
    const pods = (this.props.pods.envs &&
      this.props.pods.envs[this.props.params.env]) ||
      []
    const header = (
      <div className='view-header'>
        <ol className='breadcrumb'>
          <li><Link to={`/${this.props.params.env}`}>{this.props.params.env}</Link></li>
          <li className='active'>Pods</li>
        </ol>
      </div>
    )

    if (this.props.deployments.isFetching) {
      return (
        <div>
          {header}
          <Loading />
        </div>
      )
    }

    const columns = [
      {title: 'Name', key: 'name'},
      {title: 'Deployment', key: 'deployment'},
      {title: 'Node', key: 'node'},
      {title: 'Phase', key: 'phase'},
      {title: 'Ready', key: 'ready'},
      {title: 'Created', key: 'created'}
    ]

    const rows = _.map(pods, function (pod) {
      return {
        component: (
          <Row key={'row-' + pod.metadata.name}
            env={self.props.params.env}
            pod={pod}
          />)
      }
    })

    return (
      <div>
        {header}
        <Table columns={columns} rows={rows} />
      </div>
    )
  }

}

class Row extends React.Component {

  get nameLink () {
    const { env, pod } = this.props
    return (
      <Link to={`/${env}/deployments/${pod.metadata.name}`}>{pod.metadata.name}</Link>
    )
  }

  get deploymentLink () {
    const { env, pod } = this.props
    if (pod.metadata.labels && pod.metadata.labels.app) {
      return (
        <Link to={`/${env}/deployments/${pod.metadata.labels.app}`}>{pod.metadata.labels.app}</Link>
      )
    }
  }

  get nodeLink () {
    const { env, pod } = this.props
    if (pod.metadata.labels && pod.metadata.labels.app) {
      return (
        <Link to={`/${env}/deployments/${pod.metadata.labels.app}`}>{pod.metadata.labels.app}</Link>
      )
    }
  }

  render () {
    const { env, pod } = this.props
    const ready = pod.status.phase === 'Running' &&
      _.every(pod.status.containerStatuses, (cs) => cs.ready)
    return (<tr>
      <td data-column='name'>{this.nameLink}</td>
      <td data-column='deployment'>{this.deploymentLink}</td>
      <td data-column='node'>{this.nodeLink}</td>
      <td data-column='phase'>{pod.status.phase}</td>
      <td data-column='ready'>{ready ? String.fromCharCode('10003') : ''}</td>
      <td data-column='created_at'>{displayTime(new Date(pod.metadata.creationTimestamp))}</td>
    </tr>)
  }

}
