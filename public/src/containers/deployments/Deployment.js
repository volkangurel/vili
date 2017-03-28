import React, { PropTypes } from 'react'
import { connect } from 'react-redux'
import { Button } from 'react-bootstrap'
import _ from 'underscore'

import displayTime from '../../lib/displayTime'
import Table from '../../components/Table'
import Loading from '../../components/Loading'
import { activateDeploymentTab } from '../../actions/app'
import { getDeployments, deployTag } from '../../actions/deployments'

function mapStateToProps (state, ownProps) {
  const deployments = state.deployments.toJS()
  const deployment = (deployments.envs &&
                      deployments.envs[ownProps.params.env] &&
                      deployments.envs[ownProps.params.env][ownProps.params.deployment])
  return {
    deployments,
    deployment
  }
}

@connect(mapStateToProps)
export default class Deployment extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func,
    params: PropTypes.object, // react router provides this
    location: PropTypes.object, // react router provides this
    deployments: PropTypes.object,
    deployment: PropTypes.object
  }

  componentDidMount () {
    this.props.dispatch(activateDeploymentTab('home'))
    this.props.dispatch(getDeployments(this.props.params.env, this.props.params.deployment))
  }

  componentDidUpdate (prevProps) {
    if (this.props.params !== prevProps.params) {
      this.props.dispatch(getDeployments(this.props.params.env, this.props.params.deployment))
    }
  }

  render () {
    const self = this
    const { deployments, deployment } = this.props
    if (deployments.isFetching || !deployment) {
      return (<Loading />)
    }

    const columns = [
      {title: 'Tag', key: 'tag'},
      {title: 'Branch', key: 'branch'},
      {title: 'Revision', key: 'revision'},
      {title: 'Build Time', key: 'buildtime'},
      {title: 'Deployed', key: 'deployed_at'},
      {title: 'Actions', key: 'actions'}
    ]
    var currentTag
    if (!deployment.replicaSet || deployment.replicaSet.status === 'Failure') {
      currentTag = null
    } else {
      currentTag = deployment.replicaSet.spec.template.spec.containers[0].image.split(':')[1]
    }
    const deployedAt = deployment.replicaSet ? displayTime(new Date(deployment.replicaSet.metadata.creationTimestamp)) : ''

    var rows = _.map(deployment.repository, function (data) {
      const date = new Date(data.lastModified)
      const deployed = data.tag === currentTag
      return {
        component: (
          <Row key={data.tag}
            data={data}
            currentTag={currentTag}
            deployedAt={deployed ? deployedAt : ''}
            env={self.props.params.env}
            deployment={self.props.params.deployment}
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

@connect()
class Row extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func,
    env: PropTypes.string,
    deployment: PropTypes.string,
    data: PropTypes.object,
    deployedAt: PropTypes.string
  }

  deployTag = (event) => {
    event.target.setAttribute('disabled', 'disabled')
    const { dispatch, env, deployment, data } = this.props
    dispatch(deployTag(env, deployment, data.tag, data.branch))
    /*
     * // TODO send action
     * viliApi.rollouts.create(this.props.env, this.props.deployment, {
     *   tag: this.props.data.tag,
     *   branch: this.props.data.branch,
     *   trigger: false
     * }).then(function (deployment) {
     *   router.transitionTo(`/${self.props.env}/apps/${self.props.app}/deployments/${deployment.id}`)
     * })*/
  }

  render () {
    const { data, deployedAt } = this.props
    var className = ''
    if (deployedAt) {
      className = 'success'
    }
    var date = new Date(data.lastModified)
    return (
      <tr className={className}>
        <td data-column='tag'>{data.tag}</td>
        <td data-column='branch'>{data.branch}</td>
        <td data-column='revision'>{data.revision || 'unknown'}</td>
        <td data-column='buildtime'>{displayTime(date)}</td>
        <td data-column='deployed_at'>{deployedAt}</td>
        <td data-column='actions'>
          <Button onClick={this.deployTag} bsStyle='primary' bsSize='xs'>Deploy</Button>
        </td>
      </tr>
    )
  }

}
