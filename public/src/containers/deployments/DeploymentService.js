import React from 'react'
import { connect } from 'react-redux'
import Loading from '../../components/Loading'
import { activateDeploymentTab } from '../../actions/app'
import { getDeployments } from '../../actions/deployments'

function mapStateToProps (state) {
  return {
    deployments: state.deployments.toJS()
  }
}

@connect(mapStateToProps)
export default class DeploymentService extends React.Component {
  constructor (props) {
    super(props)
    this.state = {}

    this.clickCreateService = this.clickCreateService.bind(this)
  }

  clickCreateService (event) {
    var self = this
    event.currentTarget.setAttribute('disabled', 'disabled')
    viliApi.services.create(this.props.params.env, this.props.params.app).then(function () {
      self.loadData()
    })
  }

  componentDidMount () {
    this.props.dispatch(activateDeploymentTab('service'))
    this.props.dispatch(getDeployments(this.props.params.env, this.props.params.deployment))
  }

  componentDidUpdate (prevProps) {
    if (this.props.params !== prevProps.params) {
      this.props.dispatch(getDeployments(this.props.params.env, this.props.params.deployment))
    }
  }

  render () {
    const deployments = this.props.deployments
    const deployment = (deployments.envs &&
      deployments.envs[this.props.params.env] &&
      deployments.envs[this.props.params.env][this.props.params.deployment])
    if (deployments.isFetching || !deployment) {
      return (<Loading />)
    }
    if (!deployment.service) {
      return (
        <div id='service'>
          <div className='alert alert-warning' role='alert'>No Service Defined</div>
          <div><button className='btn btn-success' onClick={this.clickCreateService}>Create Service</button></div>
        </div>
      )
    }
    return (
      <div id='service'>
        IP: {deployment.service.spec.clusterIP}
      </div>
    )
  }
}
