import React, { PropTypes } from 'react'
import { connect } from 'react-redux'
import { Link } from 'react-router'

import Loading from '../../components/Loading'
import PodLog from '../../components/PodLog'
import { activateNav } from '../../actions/app'
import { subPod, unsubPod, subPodLog, unsubPodLog } from '../../actions/pods'

function mapStateToProps (state, ownProps) {
  const pods = state.pods.toJS()
  const pod = (pods.envs &&
               pods.envs[ownProps.params.env] &&
               pods.envs[ownProps.params.env][ownProps.params.pod]) ||
              {}
  return {
    pod
  }
}

@connect(mapStateToProps)
export default class Pod extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func,
    params: PropTypes.object, // react router provides this
    location: PropTypes.object, // react router provides this
    pod: PropTypes.object
  }

  componentDidMount () {
    this.props.dispatch(activateNav('pods'))
    this.subData()
  }

  componentDidUpdate (prevProps) {
    if (this.props.params !== prevProps.params) {
      this.unsubData()
      this.subData()
    }
  }

  subData = () => {
    this.props.dispatch(subPod(this.props.params.env, this.props.params.pod))
    this.props.dispatch(subPodLog(this.props.params.env, this.props.params.pod))
  }

  unsubData = () => {
    this.props.dispatch(unsubPod(this.props.params.env, this.props.params.pod))
    this.props.dispatch(unsubPodLog(this.props.params.env, this.props.params.pod))
  }

  render () {
    var header = (
      <div className='view-header'>
        <ol className='breadcrumb'>
          <li><Link to={`/${this.props.params.env}`}>{this.props.params.env}</Link></li>
          <li><Link to={`/${this.props.params.env}/pods`}>Pods</Link></li>
          <li className='active'>{this.props.params.pod}</li>
        </ol>
      </div>
    )
    const { pod } = this.props
    if (!pod || !pod.object) {
      return (
        <div>
          {header}
          <Loading />
        </div>
      )
    }

    const metadata = [
      <dt key='title-ip'>IP</dt>,
      <dd key='data-ip'>{pod.object.status.podIP}</dd>,
      <dt key='title-phase'>Phase</dt>,
      <dd key='data-phase'>{pod.object.status.phase}</dd>,
      <dt key='title-node'>Node</dt>,
      (<dd key='data-node'>
        <Link to={`/${this.props.params.env}/nodes/${pod.object.spec.nodeName}`}>{pod.object.spec.nodeName}</Link>
      </dd>)
    ]
    if (pod.object.metadata.labels.app) {
      metadata.push(<dt key='title-deployment'>Deployment</dt>)
      metadata.push(<dd key='data-deployment'>
        <Link to={`/${this.props.params.env}/deployments/${pod.object.metadata.labels.app}`}>{pod.object.metadata.labels.app}</Link>
      </dd>)
    }
    if (pod.object.metadata.labels.job) {
      metadata.push(<dt key='title-job'>Job</dt>)
      metadata.push(<dd key='data-job'>
        <Link to={`/${this.props.params.env}/jobs/${pod.object.metadata.labels.job}`}>{pod.object.metadata.labels.job}</Link>
      </dd>)
    }
    if (pod.object.metadata.labels.deployedBy) {
      metadata.push(<dt key='title-deployedBy'>Deployed By</dt>)
      metadata.push(<dd key='data-deployedBy'>{pod.object.metadata.labels.deployedBy}</dd>)
    }
    return (
      <div>
        {header}
        <div>
          <h4>Metadata</h4>
          <dl className='dl-horizontal'>{metadata}</dl>
        </div>
        <PodLog log={pod.log} />
      </div>
    )
  }

}
