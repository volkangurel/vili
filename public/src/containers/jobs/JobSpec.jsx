import React from 'react'
import { connect } from 'react-redux'
import Loading from '../../components/Loading'
import { activateJobTab } from '../../actions/app'
import { getJobs } from '../../actions/jobs'

function mapStateToProps (state) {
  return {
    jobs: state.jobs.toJS()
  }
}

@connect(mapStateToProps)
export default class JobSpec extends React.Component {

  componentDidMount () {
    this.props.dispatch(activateJobTab('spec'))
    this.props.dispatch(getJobs(this.props.params.env, this.props.params.job))
  }

  componentDidUpdate (prevProps) {
    if (this.props.params !== prevProps.params) {
      this.props.dispatch(getJobs(this.props.params.env, this.props.params.job))
    }
  }

  render () {
    const jobs = this.props.jobs
    const job = (jobs.envs &&
      jobs.envs[this.props.params.env] &&
      jobs.envs[this.props.params.env][this.props.params.job])
    if (jobs.isFetching || !job) {
      return (<Loading />)
    }
    return (
      <div className='col-md-8'>
        <div id='source-yaml'>
          <pre><code>
            {job.podSpec}
          </code></pre>
        </div>
      </div>
    )
  }

}
