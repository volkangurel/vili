import React, { PropTypes } from 'react'
import { connect } from 'react-redux'
import { RouteHandler, Link } from 'react-router' // eslint-disable-line no-unused-vars
import _ from 'underscore'

import { activateNav } from '../../actions/app'

const tabs = {
  'home': 'Home',
  'spec': 'Spec',
  'runs': 'Runs'
}

function mapStateToProps (state) {
  return {
    app: state.app.toJS()
  }
}

@connect(mapStateToProps)
export default class JobBase extends React.Component {
  static propTypes = {
    app: PropTypes.object,
    params: PropTypes.object, // react router provides this
    location: PropTypes.object // react router provides this
  }

  componentDidMount () {
    this.props.dispatch(activateNav('jobs', this.props.params.job))
  }

  componentDidUpdate (prevProps) {
    if (this.props.params.job !== prevProps.params.job) {
      this.props.dispatch(activateNav('jobs', this.props.params.job))
    }
  }

  render () {
    var self = this
    var tabElements = _.map(tabs, function (name, key) {
      var className = ''
      if (self.props.app.jobTab === key) {
        className = 'active'
      }
      var link = `/${self.props.params.env}/jobs/${self.props.params.job}`
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
            <li><Link to={`/${this.props.params.env}/jobs`}>Jobs</Link></li>
            <li className='active'>{this.props.params.job}</li>
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
