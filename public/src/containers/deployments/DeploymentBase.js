import React, { PropTypes } from 'react'
import { connect } from 'react-redux'
import { Link } from 'react-router'
import _ from 'underscore'

import { activateNav } from '../../actions/app'

const tabs = {
  'home': 'Home',
  'dashboard': 'Dashboard',
  'spec': 'Spec',
  // deprecated TODO remove
  'rollouts': 'Rollouts',
  'pods': 'Pods',
  'service': 'Service'
}

function mapStateToProps (state) {
  return {
    app: state.app.toJS()
  }
}

@connect(mapStateToProps)
export default class DeploymentBase extends React.Component {
  static propTypes = {
    params: PropTypes.object, // react router provides this
    location: PropTypes.object, // react router provides this
    dispatch: PropTypes.func,
    app: PropTypes.object
  }

  componentDidMount () {
    this.props.dispatch(activateNav('deployments', this.props.params.deployment))
  }

  componentDidUpdate (prevProps) {
    if (this.props.params.deployment !== prevProps.params.deployment) {
      this.props.dispatch(activateNav('deployments', this.props.params.deployment))
    }
  }

  render () {
    var self = this
    var tabElements = _.map(tabs, function (name, key) {
      var className = ''
      if (self.props.app.deploymentTab === key) {
        className = 'active'
      }
      var link = `/${self.props.params.env}/deployments/${self.props.params.deployment}`
      if (key !== 'home') {
        link += `/${key}`
      }
      return (
        <li key={key} role='presentation' className={className}>
          <Link to={link}>{name}</Link>
        </li>
      )
    })
    return (
      <div>
        <div key='view-header' className='view-header'>
          <ol className='breadcrumb'>
            <li><Link to={`/${this.props.params.env}`}>{this.props.params.env}</Link></li>
            <li><Link to={`/${this.props.params.env}/deployments`}>Deployments</Link></li>
            <li className='active'>{this.props.params.deployment}</li>
          </ol>
          <ul className='nav nav-pills pull-right'>
            {tabElements}
          </ul>
        </div>
        {this.props.children}
      </div>
    )
  }
}
