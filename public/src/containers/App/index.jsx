import React, { PropTypes } from 'react'
import { connect } from 'react-redux'
import _ from 'underscore'

import TopNav from '../../components/TopNav'
import SideNav from '../../components/SideNav'

function mapStateToProps (state) {
  return {
    app: state.app.toJS(),
    user: state.user,
    envs: state.envs,
    defaultEnv: state.defaultEnv
  }
}

@connect(mapStateToProps)
export default class App extends React.Component {
  static propTypes = {
    app: PropTypes.object,
    user: PropTypes.object,
    envs: PropTypes.array,
    defaultEnv: PropTypes.string,
    params: PropTypes.object, // react router provides this
    location: PropTypes.object // react router provides this
  };

  render () {
    const env = _.findWhere(this.props.envs, {name: this.props.params.env})
    return (
      <div className='top-nav container-fluid full-height'>
        <TopNav user={this.props.user} location={this.props.location}
          envs={this.props.envs} env={env} />
        <div className='page-wrapper'>
          <div className='sidebar'>
            <SideNav env={env} nav={this.props.app.nav} />
          </div>
          <div className='content-wrapper'>{this.props.children}</div>
        </div>
      </div>
    )
  }
}
