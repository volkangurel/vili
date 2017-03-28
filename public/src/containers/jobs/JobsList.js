import React, { PropTypes } from 'react'
import { connect } from 'react-redux'
import { Button, ButtonToolbar } from 'react-bootstrap'
import { Link } from 'react-router'
import _ from 'underscore'

import displayTime from '../../lib/displayTime'
import Table from '../../components/Table'
import Loading from '../../components/Loading'
import { activateNav } from '../../actions/app'
// import { getJobs } from '../../actions/jobs'

class Row extends React.Component {
  static propTypes = {
    replicaSet: PropTypes.object,
    env: PropTypes.object,
    name: PropTypes.string
  }

  get tag () {
    if (this.props.replicaSet) {
      return this.props.replicaSet.spec.template.spec.containers[0].image.split(':')[1]
    }
  }

  get deployedAt () {
    if (this.props.replicaSet) {
      return displayTime(new Date(this.props.replicaSet.metadata.creationTimestamp))
    }
  }

  get replicas () {
    if (this.props.replicaSet) {
      return this.props.replicaSet.status.replicas + '/' + this.props.replicaSet.spec.replicas
    }
  }

  render () {
    return (
      <tr>
        <td data-column='name'>
          <Link to={`/${this.props.env.name}/jobs/${this.props.name}`}>{this.props.name}</Link>
        </td>
        <td data-column='tag'>{this.tag}</td>
        <td data-column='replicas'>{this.replicas}</td>
        <td data-column='deployed_at'>{this.deployedAt}</td>
      </tr>
    )
  }

}

function mapStateToProps (state) {
  return {
    jobs: state.jobs.toJS(),
    envs: state.envs
  }
}

@connect(mapStateToProps)
export default class JobsList extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func,
    jobs: PropTypes.object,
    envs: PropTypes.array,
    params: PropTypes.object, // react router provides this
    location: PropTypes.object // react router provides this
  }

  componentDidMount () {
    this.props.dispatch(activateNav('deployments'))
//    this.props.dispatch(getJobs(this.props.params.env))
  }

  componentDidUpdate (prevProps) {
    if (this.props.params !== prevProps.params) {
//      this.props.dispatch(getJobs(this.props.params.env))
    }
  }

  render () {
    const env = _.findWhere(this.props.envs, {name: this.props.params.env})

    const header = [(
      <ol key='breadcrumb' className='breadcrumb'>
        <li><Link to={`/${this.props.params.env}`}>{this.props.params.env}</Link></li>
        <li className='active'>Jobs</li>
      </ol>)]

    if (this.props.jobs.isFetching) {
      return (
        <div>
          <div className='view-header'>{header}</div>
          <Loading />
        </div>
      )
    }

    if (env.approval) {
      header.push(
        <ButtonToolbar key='toolbar' pullRight>
          <Button onClick={this.release} bsStyle='success' bsSize='small'>Release</Button>
        </ButtonToolbar>)
    }

    const columns = [
      {title: 'Name', key: 'name'},
      {title: 'Tag', key: 'tag'},
      {title: 'Replicas', key: 'replicas'},
      {title: 'Deployed', key: 'deployed_at'}
    ]

    var rows = _.map(
      env.jobs, function (jobName) {
        return {
          component: (
            <Row key={'row-' + jobName}
              env={env}
              name={jobName}
            />)
        }
      }
    )

    return (
      <div>
        <div className='view-header'>{header}</div>
        <Table columns={columns} rows={rows} />
      </div>
    )
  }

}
