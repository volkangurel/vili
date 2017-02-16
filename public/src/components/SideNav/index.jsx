import React, { PropTypes } from 'react'
import { Nav } from 'react-bootstrap'
import _ from 'underscore'

import LinkMenuItem from '../LinkMenuItem'

export default class SideNav extends React.Component {
  static propTypes = {
    env: PropTypes.object,
    nav: PropTypes.object
  };

  get navItems () {
    const { env, nav } = this.props
    if (!env || !nav) {
      return
    }
    var items = []
    if (!_.isEmpty(this.props.env.deployments)) {
      items.push(
        <LinkMenuItem key='deployments' to={`/${env.name}/deployments`}
          active={nav.item === 'deployments' && !nav.subItem}>
          Deployments
        </LinkMenuItem>)
      _.map(env.deployments, function (deployment) {
        items.push(
          <LinkMenuItem key={`deployments-${deployment}`} to={`/${env.name}/deployments/${deployment}`} subitem
            active={nav.item === 'deployments' && nav.subItem === deployment}>
            {deployment}
          </LinkMenuItem>)
      })
    }
    if (!_.isEmpty(this.props.env.jobs)) {
      items.push(
        <LinkMenuItem key='jobs' to={`/${env.name}/jobs`}
          active={nav.item === 'jobs' && !nav.subItem}>
          Jobs
        </LinkMenuItem>)
      _.map(env.jobs, function (job) {
        items.push(
          <LinkMenuItem key={`jobs-${job}`} to={`/${env.name}/jobs/${job}`} subitem
            active={nav.item === 'jobs' && nav.subItem === job}>
            {job}
          </LinkMenuItem>)
      })
    }
    items.push(<LinkMenuItem key='configmaps' to={`/${env.name}/configmaps`}
      active={nav.item === 'configmaps'}>Config Maps</LinkMenuItem>)
    items.push(<LinkMenuItem key='nodes' to={`/${env.name}/nodes`}
      active={nav.item === 'nodes'}>Nodes</LinkMenuItem>)
    items.push(<LinkMenuItem key='pods' to={`/${env.name}/pods`}
      active={nav.item === 'pods'}>Pods</LinkMenuItem>)
    return items
  }

  render () {
    return (
      <Nav className='side-nav' stacked>
        {this.navItems}
      </Nav>
    )
  }
}
