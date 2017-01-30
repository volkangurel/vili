/* global prompt */
import React, { PropTypes } from 'react'
import { connect } from 'react-redux'
import { Button, ButtonToolbar } from 'react-bootstrap'
import { Link } from 'react-router'
import _ from 'underscore'

import displayTime from '../../lib/displayTime'
import Table from '../../components/Table'
import Loading from '../../components/Loading'
import { activateNav } from '../../actions/app'
import { getDeployments } from '../../actions/deployments'

class Row extends React.Component {

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
    return (<tr>
      <td data-column='name'>
        <Link to={`/${this.props.env.name}/deployments/${this.props.name}`}>{this.props.name}</Link>
      </td>
      <td data-column='tag'>{this.tag}</td>
      <td data-column='replicas'>{this.replicas}</td>
      <td data-column='deployed_at'>{this.deployedAt}</td>
    </tr>)
  }

}

function mapStateToProps (state) {
  return {
    deployments: state.deployments.toJS(),
    envs: state.envs
  }
}

@connect(mapStateToProps)
export default class DeploymentsList extends React.Component {
  static propTypes = {
    deployments: PropTypes.object,
    envs: PropTypes.array,
    params: PropTypes.object, // react router provides this
    location: PropTypes.object // react router provides this
  }

  constructor (props) {
    super(props)

    this.release = this.release.bind(this)
  }

  release () {
    var url = prompt('Please enter the release url')
    if (!url) {
      return
    }
    var self = this
    var env = _.findWhere(window.appconfig.envs, {name: this.props.params.env})
    _.each(env.deployments, function (deploymentName) {
      var replicaSet = self.state.apps.replicaSets[deploymentName]
      if (!replicaSet) {
        return
      }
      var row = self.refs['row-' + deploymentName]
      if (row && row.state.tag && !row.state.approval) {
        var deployment = replicaSet.metadata.name
        var tag = replicaSet.spec.template.spec.containers[0].image.split(':')[1]
        viliApi.releases.create(deployment, tag, {
          url: url
        })
      }
    })
  }

  componentDidMount () {
    this.props.dispatch(activateNav('deployments'))
    this.props.dispatch(getDeployments(this.props.params.env))
  }

  componentDidUpdate (prevProps) {
    if (this.props.params !== prevProps.params) {
      this.props.dispatch(getDeployments(this.props.params.env))
    }
  }

  render () {
    const self = this
    const env = _.findWhere(this.props.envs, {name: this.props.params.env})

    const header = [(
      <ol key='breadcrumb' className='breadcrumb'>
        <li><Link to={`/${this.props.params.env}`}>{this.props.params.env}</Link></li>
        <li className='active'>Deployments</li>
      </ol>)]

    if (this.props.deployments.isFetching) {
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
      env.deployments, function (deploymentName) {
        const deployment = (self.props.deployments.envs &&
          self.props.deployments.envs[self.props.params.env] &&
          self.props.deployments.envs[self.props.params.env][deploymentName])
        return {
          component: (
            <Row key={'row-' + deploymentName}
              env={env}
              name={deploymentName}
              replicaSet={deployment && deployment.replicaSet}
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
