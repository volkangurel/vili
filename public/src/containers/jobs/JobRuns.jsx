import React from 'react'
import { connect } from 'react-redux'
import { Link } from 'react-router'
import _ from 'underscore'

import displayTime from '../../lib/displayTime'
import Table from '../../components/Table'
import { activateJobTab } from '../../actions/app'
import { getJobs } from '../../actions/jobs'
// import { subJobRuns, unsubJobRuns } from '../../actions/jobRuns'
// import { deletePod } from '../../actions/pods'

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
      {title: 'Start Time', key: 'starttime'},
      {title: 'Completion Time', key: 'completiontime'},
      {title: 'Status', key: 'status'},
      {title: 'Actions', key: 'actions'}
    ]

    const rows = _.map(sortedRuns, function (jobRun) {
      return {
        component: (
          <Row
            key={jobRun.metadata.name}
            jobRun={jobRun}
            env={self.props.params.env}
            job={self.props.params.job}
            dispatch={self.props.dispatch}
          />
        )
      }
    })
    return (<Table columns={columns} rows={rows} />)
  }
}

class Row extends React.Component {

  render () {
    const { env, job, jobRun} = this.props
    const tag = jobRun.spec.template.spec.containers[0].image.split(':')[1]
    const startTime = new Date(jobRun.status.startTime)
    const completionTime = new Date(jobRun.status.completionTime)
    var status = 'Running'
    _.each(jobRun.status.conditions, function (condition) {
      switch (condition.type) {
        case 'Complete':
          status = 'Complete'
          break
        case 'Failed':
          status = 'Failed'
          break
      }
    })
    return (
      <tr>
        <td data-column='run'><Link to={`/${env}/jobs/${job}/runs/${jobRun.metadata.name}`}>{jobRun.metadata.name}</Link></td>
        <td data-column='tag'>{tag}</td>
        <td data-column='starttime'>{displayTime(startTime)}</td>
        <td data-column='completiontime'>{displayTime(completionTime)}</td>
        <td data-column='status'>{status}</td>
        <td data-column='actions'>
          <button type='button' className='btn btn-xs btn-danger' onClick={this.deletePod}>Delete</button>
        </td>
      </tr>
    )
  }

  deletePod = () => {
    this.props.dispatch(deletePod(this.props.env, this.props.pod.metadata.name))
  }

}
