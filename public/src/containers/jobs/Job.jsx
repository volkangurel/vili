import React from 'react'
import { connect } from 'react-redux'
import { Button, Label } from 'react-bootstrap'
import _ from 'underscore'

import displayTime from '../../lib/displayTime'
import Table from '../../components/Table'
import Loading from '../../components/Loading'
import { activateJobTab } from '../../actions/app'
import { getJobs, runJob } from '../../actions/jobs'

function mapStateToProps (state) {
  return {
    app: state.app.toJS(),
    jobs: state.jobs.toJS()
  }
}

@connect(mapStateToProps)
export default class Job extends React.Component {

  componentDidMount () {
    this.props.dispatch(activateJobTab('home'))
    this.props.dispatch(getJobs(this.props.params.env, this.props.params.job))
  }

  componentDidUpdate (prevProps) {
    if (this.props.params !== prevProps.params) {
      this.props.dispatch(getJobs(this.props.params.env, this.props.params.job))
    }
  }

  render () {
    const self = this
    const jobs = this.props.jobs
    const job = (jobs.envs &&
      jobs.envs[this.props.params.env] &&
      jobs.envs[this.props.params.env][this.props.params.job])
    if (jobs.isFetching || !job) {
      return (<Loading />)
    }

    const tagJobRuns = {}
    _.each(job.jobList.items, function (job) {
      const tag = job.spec.template.spec.containers[0].image.split(':')[1]
      if (!tagJobRuns[tag]) {
        tagJobRuns[tag] = []
      }
      tagJobRuns[tag].push(job)
    })

    const columns = [
      {title: 'Tag', key: 'tag'},
      {title: 'Branch', key: 'branch'},
      {title: 'Revision', key: 'revision'},
      {title: 'Build Time', key: 'buildtime'},
      {title: 'Run Times', key: 'runtimes'},
      {title: 'Actions', key: 'actions'}
    ]

    var rows = _.map(job.repository, function (data) {
      return {
        component: (
          <Row key={data.tag}
            data={data}
            jobRuns={tagJobRuns[data.tag] || []}
            env={self.props.params.env}
            job={self.props.params.job}
            dispatch={self.props.dispatch}
          />),
        time: (new Date(data.lastModified)).getTime()
      }
    })

    rows = _.sortBy(rows, function (row) {
      return -row.time
    })

    return (<Table columns={columns} rows={rows} />)
  }

}

class Row extends React.Component {

  render () {
    const { data, jobRuns } = this.props
    var date = new Date(data.lastModified)
    const runTimes = _.map(jobRuns, function (job) {
      var bsStyle = 'default'
      _.each(job.status.conditions, function (condition) {
        switch (condition.type) {
          case 'Complete':
            bsStyle = 'success'
            break
          case 'Failed':
            bsStyle = 'danger'
            break
        }
      })
      return (
        <div key={job.metadata.name}>
          <Label bsStyle={bsStyle}>
            {displayTime(new Date(job.metadata.creationTimestamp))}
          </Label>
        </div>
      )
    })
    return (<tr>
      <td data-column='tag'>{data.tag}</td>
      <td data-column='branch'>{data.branch}</td>
      <td data-column='revision'>{data.revision || 'unknown'}</td>
      <td data-column='buildtime'>{displayTime(date)}</td>
      <td data-column='runtimes'>{runTimes}</td>
      <td data-column='actions'>
        <Button onClick={this.runTag} bsStyle='primary' bsSize='xs'>Run</Button>
      </td>
    </tr>)
  }

  runTag = (event) => {
    event.target.setAttribute('disabled', 'disabled')
    const { dispatch, env, job, data } = this.props
    dispatch(runJob(env, job, data.tag, data.branch))
  }
}
