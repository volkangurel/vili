import React from 'react'
import { connect } from 'react-redux'
import { Link } from 'react-router'
import { Button } from 'react-bootstrap'
import _ from 'underscore'

import displayTime from '../../lib/displayTime'
import Table from '../../components/Table'
import Loading from '../../components/Loading'
import { activateNav } from '../../actions/app'
import { subPods, unsubPods, deletePod } from '../../actions/pods'

function mapStateToProps (state) {
  return {
    pods: state.pods.toJS()
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
    if (this.props.pods.isFetching) {
      return (
        <div>
          {header}
          <Loading />
        </div>
      )
    }

    const self = this
    const columns = [
      {title: 'Name', key: 'name'},
      {title: 'Deployment/Job', key: 'deployment-job'},
      {title: 'Node', key: 'node'},
      {title: 'Phase', key: 'phase'},
      {title: 'Ready', key: 'ready'},
      {title: 'Created', key: 'created'},
      {title: 'Actions', key: 'actions-short'}
    ]

    const rows = _.map(pods, function (pod, key) {
      if (!pod.object) {
        return
      }
      return {
        key: key,
        component: (
          <Row key={'row-' + key}
            env={self.props.params.env}
            pod={pod.object}
            dispatch={self.props.dispatch}
          />)
      }
    })
    const sortedRows = _.sortBy(rows, 'key')

    return (
      <div>
        {header}
        <Table columns={columns} rows={sortedRows} />
      </div>
    )
  }

}

class Row extends React.Component {

  get nameLink () {
    const { env, pod } = this.props
    return (
      <Link to={`/${env}/pods/${pod.metadata.name}`}>{pod.metadata.name}</Link>
    )
  }

  get deploymentJobLink () {
    const { env, pod } = this.props
    if (pod.metadata.labels.app) {
      return (
        <Link to={`/${env}/deployments/${pod.metadata.labels.app}`}>{pod.metadata.labels.app}</Link>
      )
    } else if (pod.metadata.labels.job) {
      return (
        <Link to={`/${env}/jobs/${pod.metadata.labels.job}`}>{pod.metadata.labels.job}</Link>
      )
    }
  }

  get nodeLink () {
    const { env, pod } = this.props
    return (
      <Link to={`/${env}/nodes/${pod.spec.nodeName}`}>{pod.spec.nodeName}</Link>
    )
  }

  deletePod = () => {
    this.props.dispatch(deletePod(this.props.env, this.props.pod.metadata.name))
  }

  render () {
    const { pod } = this.props
    const ready = pod.status.phase === 'Running' &&
      _.every(pod.status.containerStatuses, (cs) => cs.ready)
    return (<tr>
      <td data-column='name'>{this.nameLink}</td>
      <td data-column='deployment-job'>{this.deploymentJobLink}</td>
      <td data-column='node'>{this.nodeLink}</td>
      <td data-column='phase'>{pod.status.phase}</td>
      <td data-column='ready'>{ready ? String.fromCharCode('10003') : ''}</td>
      <td data-column='created_at'>{displayTime(new Date(pod.metadata.creationTimestamp))}</td>
      <td data-column='actions-short'>
        <Button onClick={this.deletePod} bsStyle='danger' bsSize='xs'>Delete</Button>
      </td>
    </tr>)
  }

}
