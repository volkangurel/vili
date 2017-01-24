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
export default class DeploymentSpec extends React.Component {

  render () {
    const deployments = this.props.deployments
    const deployment = (deployments.envs &&
      deployments.envs[this.props.params.env] &&
      deployments.envs[this.props.params.env][this.props.params.deployment])
    if (deployments.isFetching || !deployment) {
      return (<Loading />)
    }
    return (
      <div className='col-md-8'>
        <div id='source-yaml'>
          <pre><code>
            {deployment.deploymentSpec}
          </code></pre>
        </div>
      </div>
    )
  }

  componentDidMount () {
    this.props.dispatch(activateDeploymentTab('spec'))
    this.props.dispatch(getDeployments(this.props.params.env, this.props.params.deployment))
  }

  componentDidUpdate (prevProps) {
    if (this.props.params !== prevProps.params) {
      this.props.dispatch(getDeployments(this.props.params.env, this.props.params.deployment))
    }
  }

}
