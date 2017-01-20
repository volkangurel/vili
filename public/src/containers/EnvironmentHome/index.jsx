import React, { PropTypes } from 'react'
import { connect } from 'react-redux'
import { Link } from 'react-router'

function mapStateToProps (state) {
  return {
    envs: state.envs.toJS()
  }
}

@connect(mapStateToProps)
export class EnvironmentHome extends React.Component {
  static propTypes = {
    params: PropTypes.object
  };

  render () {
    return (
      <div>
        <div className='view-header'>
          <ol className='breadcrumb'>
            <li className='active'>{this.props.params.env}</li>
          </ol>
        </div>
        <ul className='nav nav-pills nav-stacked'>
          <li><Link to={`/${this.props.params.env}/migrations`}>Migrations</Link></li>
          <li><Link to={`/${this.props.params.env}/deployments`}>Deployments</Link></li>
          <li><Link to={`/${this.props.params.env}/configmaps`}>Config Maps</Link></li>
          <li><Link to={`/${this.props.params.env}/pods`}>Pods</Link></li>
          <li><Link to={`/${this.props.params.env}/nodes`}>Nodes</Link></li>
        </ul>
      </div>
    )
  }
}
