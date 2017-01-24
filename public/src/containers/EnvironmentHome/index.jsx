import React, { PropTypes } from 'react'
import { connect } from 'react-redux'
import { Link } from 'react-router'
import _ from 'underscore'

function mapStateToProps (state) {
  return {
    envs: state.envs
  }
}

@connect(mapStateToProps)
export default class EnvironmentHome extends React.Component {
  static propTypes = {
    envs: PropTypes.array
  };

  render () {
    const env = _.findWhere(this.props.envs, {name: this.props.params.env})
    if (!env) {
      return ''
    }
    const items = []
    if (env.migrations) {
      items.push(
        <li key='migrations'><Link to={`/${this.props.params.env}/migrations`}>Migrations</Link></li>)
    }
    if (!_.isEmpty(env.deployments)) {
      items.push(
        <li key='deployments'><Link to={`/${this.props.params.env}/deployments`}>Deployments</Link></li>)
    }
    items.push(
      <li key='configmaps'><Link to={`/${this.props.params.env}/configmaps`}>Config Maps</Link></li>)
    items.push(
      <li key='pods'><Link to={`/${this.props.params.env}/pods`}>Pods</Link></li>)
    items.push(
      <li key='nodes'><Link to={`/${this.props.params.env}/nodes`}>Nodes</Link></li>)
    return (
      <div>
        <div key='header' className='view-header'>
          <ol className='breadcrumb'>
            <li className='active'>{this.props.params.env}</li>
          </ol>
        </div>
        <ul key='list' className='nav nav-pills nav-stacked'>{items}</ul>
      </div>
    )
  }
}
