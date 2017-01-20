import React, { PropTypes } from 'react'
import { connect } from 'react-redux'
import TopNav from '../../components/TopNav'
import SideNav from '../../components/SideNav'
// import { httpClient } from '../../utils/apiUtils'
// import { Routes } from '../../routes'

function mapStateToProps (state) {
  return {
    app: state.app.toJS(),
    session: state.session.toJS()
  }
}

@connect(mapStateToProps)
export class App extends React.Component {
  static propTypes = {
    user: PropTypes.object,
    envs: PropTypes.array,
    env: PropTypes.object,
    location: PropTypes.object // react router provides this
  };

  render () {
    return (
      <div className='top-nav container-fluid full-height'>
        <TopNav user={this.props.user} envs={this.props.envs} env={this.props.env} />
        <div className='page-wrapper'>
          <div className='sidebar'>
            <SideNav location={this.props.location} env={this.props.env} />
          </div>
          <div className='content-wrapper'>{this.props.children}</div>
        </div>
      </div>
    )
  }
}
