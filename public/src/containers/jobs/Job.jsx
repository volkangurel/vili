import React from 'react'
import { connect } from 'react-redux'
import _ from 'underscore'

import displayTime from '../../lib/displayTime'
import router from '../../router'
import Table from '../../components/Table'
import Loading from '../../components/Loading'
import { activateJobTab } from '../../actions/app'
import { getJobs } from '../../actions/jobs'

class Row extends React.Component {

  render () {
    var data = this.props.data
    var date = new Date(data.lastModified)

    return (<tr>
      <td data-column='tag'>{data.tag}</td>
      <td data-column='branch'>{data.branch}</td>
      <td data-column='revision'>{data.revision || 'unknown'}</td>
      <td data-column='buildtime'>{displayTime(date)}</td>
      <td data-column='actions'>
        <button type='button' className='btn btn-xs btn-primary' onClick={this.runTag}>Run</button>
      </td>
    </tr>)
  }

  runTag = () => {
    var self = this
    event.target.setAttribute('disabled', 'disabled')
    // TODO send action
    viliApi.runs.create(this.props.env.name, this.props.job, {
      tag: this.props.data.tag,
      branch: this.props.data.branch,
      trigger: false
    }).then(function (run) {
      router.transitionTo(`/${self.props.env.name}/jobs/${self.props.job}/runs/${run.id}`)
    })
  }
}

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

    const columns = [
      {title: 'Tag', key: 'tag'},
      {title: 'Branch', key: 'branch'},
      {title: 'Revision', key: 'revision'},
      {title: 'Build Time', key: 'buildtime'},
      {title: 'Actions', key: 'actions'}
    ]

    var rows = _.map(job.repository, function (data) {
      var date = new Date(data.lastModified)
      return {
        component: (
          <Row key={data.tag}
            data={data}
            env={self.props.params.env}
            job={self.props.params.job}
          />),
        time: date.getTime()
      }
    })

    rows = _.sortBy(rows, function (row) {
      return -row.time
    })

    return (<Table columns={columns} rows={rows} />)
  }

}
