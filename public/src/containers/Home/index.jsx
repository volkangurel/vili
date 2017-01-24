import React, { PropTypes } from 'react'
import { connect } from 'react-redux'
import { Link } from 'react-router'

import { activateNav } from '../../actions/deployments'

function mapStateToProps (state) {
  return {
    envs: state.envs
  }
}

@connect(mapStateToProps)
export default class Home extends React.Component {
  static propTypes = {
    envs: PropTypes.array
  };

  componentDidMount () {
    this.props.dispatch(activateNav('home'))
  }

  componentDidUpdate () {
    this.props.dispatch(activateNav('home'))
  }

  get renderEnvs () {
    var links = this.props.envs.map(function (env) {
      return <li key={env.name}><Link to={`/${env.name}`}>{env.name}</Link></li>
    })
    return <div>
      <div className='view-header'>
        <ol className='breadcrumb'>
          <li className='active'>Select Environment</li>
        </ol>
      </div>
      <ul className='nav nav-pills nav-stacked'>{links}</ul>
    </div>
  }

  get renderLoggedOut () {
    return (
      <div className='jumbotron'>
        <h1>Welcome to Vili</h1>
        <p>Please log in to view your applications.</p>
        <p><a className='btn btn-primary btn-lg' href='/login' role='button'>Login</a></p>
      </div>
    )
  }

  render () {
    if (!this.props.envs) {
      return this.renderLoggedOut
    }
    return this.renderEnvs
  }

}
