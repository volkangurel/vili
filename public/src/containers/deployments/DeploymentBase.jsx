import React, { PropTypes } from 'react'
import { connect } from 'react-redux'
import { RouteHandler, Link } from 'react-router' // eslint-disable-line no-unused-vars
import _ from 'underscore'

import { activateNav } from '../../actions/app'

const tabs = {
  'home': 'Home',
  'rollouts': 'Rollouts',
  'pods': 'Pods',
  'service': 'Service',
  'spec': 'Spec'
}

function mapStateToProps (state) {
  return {
    app: state.app.toJS()
  }
}

@connect(mapStateToProps)
export default class DeploymentBase extends React.Component {
  static propTypes = {
    app: PropTypes.object,
    params: PropTypes.object, // react router provides this
    location: PropTypes.object // react router provides this
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
