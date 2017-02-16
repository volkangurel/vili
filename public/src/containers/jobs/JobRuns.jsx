import React from 'react'
import { connect } from 'react-redux'
import { Link } from 'react-router'
import _ from 'underscore'

import displayTime from '../../lib/displayTime'
import Table from '../../components/Table'
import { activateJobTab } from '../../actions/app'
import { subJobRuns, unsubJobRuns } from '../../actions/jobRuns'

function mapStateToProps (state) {
  return {
    jobRuns: state.jobRuns.toJS()
  }
}

@connect(mapStateToProps)
export default class JobRuns extends React.Component {

  subData = () => {
    this.props.dispatch(subJobRuns(this.props.params.env, this.props.params.job))
  }

  unsubData = () => {
    this.props.dispatch(unsubJobRuns(this.props.params.env, this.props.params.job))
  }

  componentDidMount () {
    this.props.dispatch(activateJobTab('runs'))
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
    const self = this
    const jobRuns = this.props.jobRuns
    const runs = (jobRuns.envs &&
      jobRuns.envs[this.props.params.env] &&
      jobRuns.envs[this.props.params.env][this.props.params.job]) ||
      []
    const sortedRuns = _.sortBy(runs, (x) => -(new Date(x.metadata.creationTimestamp)))
    const columns = [
      {title: 'Run', key: 'run'},
      {title: 'Tag', key: 'tag'},
      {title: 'Time', key: 'time'},
      {title: 'Status', key: 'status'},
      {title: 'Actions', key: 'actions'}
    ]

    const rows = _.map(sortedRuns, function (pod) {
      return {
        component: (
          <Row
            key={pod.metadata.name}
            pod={pod}
            env={self.props.params.env}
            job={self.props.params.job}
          />
        )
      }
    })
    return (<Table columns={columns} rows={rows} />)
  }
}

class Row extends React.Component {

  render () {
    const { pod, env } = this.props
    const tag = pod.spec.containers[0].image.split(':')[1]
    const time = new Date(pod.metadata.creationTimestamp)
    return (
      <tr>
        <td data-column='pod'><Link to={`/${env}/pods/${pod.metadata.name}`}>{pod.metadata.name}</Link></td>
        <td data-column='tag'>{tag}</td>
        <td data-column='time'>{displayTime(time)}</td>
        <td data-column='phase'>{pod.status.phase}</td>
        <td data-column='actions'>
          <button type='button' className='btn btn-xs btn-danger' onClick={this.deletePod}>Delete</button>
        </td>
      </tr>
    )
  }

  deletePod = () => {
    // TODO
    console.log('deleting')
  }

}
