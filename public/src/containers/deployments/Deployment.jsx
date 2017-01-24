import React from 'react'
import { connect } from 'react-redux'
import _ from 'underscore'

import displayTime from '../../lib/displayTime'
import router from '../../router'
import Table from '../../components/Table'
import Loading from '../../components/Loading'
import { activateDeploymentTab } from '../../actions/app'
import { getDeployments } from '../../actions/deployments'

class Row extends React.Component {
  constructor (props) {
    super(props)
    this.deployTag = this.deployTag.bind(this)
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
          <button type='button' className='btn btn-xs btn-primary' onClick={this.deployTag}>Deploy</button>
        </td>
      </tr>
    )
  }

  deployTag (event) {
    var self = this
    event.target.setAttribute('disabled', 'disabled')
    // TODO send action
    viliApi.rollouts.create(this.props.env, this.props.deployment, {
      tag: this.props.data.tag,
      branch: this.props.data.branch,
      trigger: false
    }).then(function (deployment) {
      router.transitionTo(`/${self.props.env}/apps/${self.props.app}/deployments/${deployment.id}`)
    })
  }

}

function mapStateToProps (state) {
  return {
    app: state.app.toJS(),
    deployments: state.deployments.toJS()
  }
}

@connect(mapStateToProps)
export default class Deployment extends React.Component {

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
    const deployments = this.props.deployments
    const deployment = (deployments.envs &&
      deployments.envs[this.props.params.env] &&
      deployments.envs[this.props.params.env][this.props.params.deployment])
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
