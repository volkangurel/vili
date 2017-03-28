import React, { PropTypes } from 'react'
import { connect } from 'react-redux'
import { Alert } from 'react-bootstrap'
import _ from 'underscore'

import displayTime from '../../lib/displayTime'
import JobRunPod from '../../components/JobRunPod'
import { activateJobTab } from '../../actions/app'
import { subJobRuns, unsubJobRuns } from '../../actions/jobRuns'
import { subJobRunPods, unsubJobRunPods } from '../../actions/jobRunPods'

function mapStateToProps (state, ownProps) {
  const { env, job, run } = ownProps.params
  const jobRuns = state.jobRuns.toJS()
  const jobRun = (jobRuns.envs &&
                  jobRuns.envs[env] &&
                  jobRuns.envs[env][job] &&
                  jobRuns.envs[env][job][run])
  const jobRunPods = state.jobRunPods.toJS()
  const pods = (jobRunPods.envs &&
                jobRunPods.envs[env] &&
                jobRunPods.envs[env][run])
  return {
    jobRun,
    pods
  }
}

@connect(mapStateToProps)
export default class JobRun extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func,
    params: PropTypes.object, // react router provides this
    location: PropTypes.object, // react router provides this
    jobRun: PropTypes.object,
    pods: PropTypes.object
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

  subData = () => {
    const { params } = this.props
    this.props.dispatch(subJobRuns(params.env, params.job))
    this.props.dispatch(subJobRunPods(params.env, params.run))
  }

  unsubData = () => {
    const { params } = this.props
    this.props.dispatch(unsubJobRuns(params.env, params.job))
    this.props.dispatch(unsubJobRunPods(params.env, params.run))
  }

  get status () {
    const { jobRun } = this.props
    if (!jobRun) {
      return null
    }
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
    return status
  }

  renderBanner () {
    var banner = null
    switch (this.status) {
      case 'Failed':
        banner = (<Alert bsStyle='danger'>Failed</Alert>)
        break
      case 'Complete':
        banner = (<Alert bsStyle='success'>Complete</Alert>)
        break
    }
    return banner
  }

  renderMetadata () {
    const { jobRun } = this.props
    if (!jobRun) {
      return null
    }
    const tag = jobRun.spec.template.spec.containers[0].image.split(':')[1]
    const startTime = displayTime(new Date(jobRun.status.startTime))
    const completionTime = displayTime(new Date(jobRun.status.completionTime))
    const metadata = [
      <dt key='title-tag'>Tag</dt>,
      <dd key='data-tag'>{tag}</dd>,
      <dt key='title-start-time'>Start Time</dt>,
      <dd key='data-start-time'>{startTime}</dd>,
      <dt key='title-completion-time'>Completion Time</dt>,
      <dd key='data-completion-time'>{completionTime}</dd>
    ]
    return metadata
  }

  render () {
    const { params, jobRun, pods } = this.props
    if (!jobRun) {
      return null
    }
    const podLogs = _.map(pods, (pod, podName) => {
      return <JobRunPod env={params.env} podName={podName} />
    })
    if (podLogs.length > 0) {
      podLogs.splice(0, 0, (<h3>Pods</h3>))
    }
    return (
      <div>
        <div>
          {this.renderBanner()}
          <dl className='dl-horizontal'>{this.renderMetadata()}</dl>
        </div>
        {podLogs}
      </div>
    )
  }
}
